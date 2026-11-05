import { createMemoryRepository } from '@/features/srs/repository'
import { createScheduler, replay, type SrsCard } from '@/features/srs/scheduler'
import type { Grade, ReviewEvent } from '@/features/srs/types'
import type { PullCursor, SyncRemote } from '@/features/sync/remote'
import { BATCH_SIZE, CURSOR_KEY, OWNER_KEY, PULL_OVERLAP_MS, syncReviews } from '@/features/sync/syncEngine'
import { describe, expect, it } from 'vitest'

const ADA = 'ada'
const BO = 'bo'
const scheduler = await createScheduler()

interface Row {
  event: ReviewEvent
  cursor: PullCursor
}

/** Behaves like the review_logs table: per-user rows, ignored duplicates, and server-stamped receive times. */
function createServer() {
  let clock = Date.parse('2026-11-01T09:00:00Z')
  const rows = new Map<string, Row[]>()
  const cards = new Map<string, Map<string, SrsCard>>()
  const pushes: number[] = []
  let failNextPush = false

  const ordered = (userId: string) =>
    (rows.get(userId) ?? []).toSorted(
      (a, b) => a.cursor.receivedAt.localeCompare(b.cursor.receivedAt) || a.cursor.id.localeCompare(b.cursor.id),
    )

  return {
    rows,
    cards,
    pushes,
    tick(ms: number) {
      clock += ms
    },
    failNextPush() {
      failNextPush = true
    },
    /** Inserts a row as if another transaction committed it with an older timestamp. */
    insertLate(userId: string, event: ReviewEvent, receivedAt: string) {
      rows.set(userId, [...(rows.get(userId) ?? []), { event, cursor: { receivedAt, id: event.id } }])
    },
    remoteFor(userId: string): SyncRemote {
      return {
        async push(events) {
          if (failNextPush) {
            failNextPush = false
            throw new Error('network down')
          }
          pushes.push(events.length)
          // One transaction: every row in a push shares the same receive time.
          const receivedAt = new Date(clock).toISOString()
          const list = rows.get(userId) ?? []
          for (const event of events) {
            if (!list.some((row) => row.event.id === event.id))
              list.push({ event, cursor: { receivedAt, id: event.id } })
          }
          rows.set(userId, list)
        },
        async pull(position, limit) {
          let list = ordered(userId)
          if (position && 'after' in position) {
            const { receivedAt, id } = position.after
            list = list.filter(
              (row) =>
                row.cursor.receivedAt > receivedAt || (row.cursor.receivedAt === receivedAt && row.cursor.id > id),
            )
          } else if (position) {
            list = list.filter((row) => row.cursor.receivedAt >= position.since)
          }
          return list.slice(0, limit)
        },
        async saveCards(saved) {
          const mine = cards.get(userId) ?? new Map<string, SrsCard>()
          for (const card of saved) mine.set(String(card.cardId), card)
          cards.set(userId, mine)
        },
      }
    },
  }
}

type Server = ReturnType<typeof createServer>

let sequence = 0
function review(cardId: string, grade: Grade, reviewedAt: string): ReviewEvent {
  sequence += 1
  return {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    cardId,
    grade,
    reviewedAt,
    answerMode: 'choice',
    correct: grade > 1,
    responseMs: 3000,
  }
}

/** A device with its own local log, signed in as `userId` (or switching accounts later). */
function createDevice(server: Server) {
  const repository = createMemoryRepository()
  let events: ReviewEvent[] = []
  let cards = new Map<string, SrsCard>()
  const rebuild = async () => {
    events = await repository.all()
    cards = replay(scheduler, events)
  }
  return {
    repository,
    get events() {
      return events
    },
    get cards() {
      return cards
    },
    async study(...reviews: ReviewEvent[]) {
      await repository.add(reviews, { synced: false })
      await rebuild()
    },
    sync(userId: string) {
      return syncReviews({
        repository,
        remote: server.remoteFor(userId),
        userId,
        merge: async (incoming) => {
          const added = await repository.add(incoming, { synced: true })
          await rebuild()
          return added.length
        },
        reload: rebuild,
        cards: () => cards,
      })
    },
  }
}

function schedule(cards: ReadonlyMap<string, SrsCard>) {
  return Object.fromEntries(
    [...cards].toSorted(([a], [b]) => a.localeCompare(b)).map(([id, card]) => [id, card.dueAt.toISOString()]),
  )
}

describe('syncReviews', () => {
  it('uploads the outbox once', async () => {
    const server = createServer()
    const phone = createDevice(server)
    await phone.study(
      review('bone:femur_left', 3, '2026-11-01T08:00:00Z'),
      review('bone:tibia_left', 1, '2026-11-01T08:01:00Z'),
    )

    expect(await phone.sync(ADA)).toEqual({ pushed: 2, pulled: 0, replacedOtherAccount: false })
    expect(await phone.repository.unsynced()).toEqual([])
    expect(await phone.sync(ADA)).toEqual({ pushed: 0, pulled: 0, replacedOtherAccount: false })
    expect(server.rows.get(ADA)).toHaveLength(2)
  })

  it('brings two devices that studied offline to the same schedule', async () => {
    const server = createServer()
    const phone = createDevice(server)
    const laptop = createDevice(server)
    await phone.study(
      review('bone:femur_left', 3, '2026-11-01T08:00:00Z'),
      review('bone:femur_left', 4, '2026-11-02T08:00:00Z'),
    )
    await laptop.study(
      review('bone:femur_left', 1, '2026-11-01T20:00:00Z'),
      review('landmark:greater_trochanter', 3, '2026-11-01T21:00:00Z'),
    )

    await phone.sync(ADA)
    server.tick(1000)
    await laptop.sync(ADA)
    server.tick(1000)
    await phone.sync(ADA)

    expect(phone.events).toHaveLength(4)
    expect(schedule(phone.cards)).toEqual(schedule(laptop.cards))
    // The merged femur history interleaves both devices in review order.
    expect(phone.cards.get('bone:femur_left')!.reps).toBe(3)
  })

  it('adds guest progress to the account on first sign-in', async () => {
    const server = createServer()
    const guest = createDevice(server)
    await guest.study(review('bone:patella_left', 3, '2026-11-01T08:00:00Z'))
    expect(await guest.repository.getMeta(OWNER_KEY)).toBeUndefined()

    await guest.sync(ADA)

    expect(await guest.repository.getMeta(OWNER_KEY)).toBe(ADA)
    expect(server.rows.get(ADA)?.map((row) => row.event.cardId)).toEqual(['bone:patella_left'])
  })

  it('never uploads one account’s progress into another', async () => {
    const server = createServer()
    const shared = createDevice(server)
    await shared.study(review('bone:femur_left', 3, '2026-11-01T08:00:00Z'))
    await shared.sync(ADA)
    await server.remoteFor(BO).push([review('bone:ulna_left', 3, '2026-11-01T09:00:00Z')])

    const result = await shared.sync(BO)

    expect(result.replacedOtherAccount).toBe(true)
    expect(server.rows.get(BO)?.map((row) => row.event.cardId)).toEqual(['bone:ulna_left'])
    expect(shared.events.map((event) => event.cardId)).toEqual(['bone:ulna_left'])
    expect(await shared.repository.getMeta(OWNER_KEY)).toBe(BO)
  })

  it('pages through more events than one request returns, even when they share a timestamp', async () => {
    const server = createServer()
    const phone = createDevice(server)
    const laptop = createDevice(server)
    const many = Array.from({ length: BATCH_SIZE * 2 + 7 }, (_, index) =>
      review(`bone:femur_left`, 3, new Date(Date.parse('2026-10-01T00:00:00Z') + index * 86_400_000).toISOString()),
    )
    await phone.study(...many)

    await phone.sync(ADA)
    expect(server.pushes).toEqual([BATCH_SIZE, BATCH_SIZE, 7])
    expect(new Set(server.rows.get(ADA)!.map((row) => row.cursor.receivedAt)).size).toBe(1)

    expect((await laptop.sync(ADA)).pulled).toBe(many.length)
    expect(schedule(laptop.cards)).toEqual(schedule(phone.cards))
  })

  it('still pulls a row that committed late with an older timestamp', async () => {
    const server = createServer()
    const laptop = createDevice(server)
    await server.remoteFor(ADA).push([review('bone:femur_left', 3, '2026-11-01T08:00:00Z')])
    await laptop.sync(ADA)
    const cursor = await laptop.repository.getMeta<PullCursor>(CURSOR_KEY)

    const late = review('bone:tibia_left', 3, '2026-11-01T08:05:00Z')
    server.insertLate(ADA, late, new Date(Date.parse(cursor!.receivedAt) - PULL_OVERLAP_MS / 2).toISOString())

    expect((await laptop.sync(ADA)).pulled).toBe(1)
    expect(laptop.cards.has('bone:tibia_left')).toBe(true)
  })

  it('keeps events in the outbox when an upload fails', async () => {
    const server = createServer()
    const phone = createDevice(server)
    await phone.study(review('bone:femur_left', 3, '2026-11-01T08:00:00Z'))

    server.failNextPush()
    await expect(phone.sync(ADA)).rejects.toThrow('network down')
    expect(await phone.repository.unsynced()).toHaveLength(1)

    expect((await phone.sync(ADA)).pushed).toBe(1)
    expect(await phone.repository.unsynced()).toEqual([])
  })

  it('saves a snapshot of every card it touched', async () => {
    const server = createServer()
    const phone = createDevice(server)
    await phone.study(
      review('bone:femur_left', 3, '2026-11-01T08:00:00Z'),
      review('bone:tibia_left', 2, '2026-11-01T08:01:00Z'),
    )

    await phone.sync(ADA)

    const saved = server.cards.get(ADA)!
    expect([...saved.keys()].toSorted()).toEqual(['bone:femur_left', 'bone:tibia_left'])
    expect(saved.get('bone:femur_left')!.dueAt).toEqual(phone.cards.get('bone:femur_left')!.dueAt)
  })
})
