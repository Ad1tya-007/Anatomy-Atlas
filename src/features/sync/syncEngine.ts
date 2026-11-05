import type { ReviewRepository } from '@/features/srs/repository'
import type { SrsCard } from '@/features/srs/scheduler'
import type { ReviewEvent } from '@/features/srs/types'
import type { PullCursor, SyncRemote } from '@/features/sync/remote'

/** The account whose review log this device holds. Missing while studying as a guest. */
export const OWNER_KEY = 'sync.owner'
/** The last server position this device has pulled. */
export const CURSOR_KEY = 'sync.cursor'

export const BATCH_SIZE = 500
/**
 * The server stamps rows with its transaction start time, so a slow upload can commit rows slightly older than
 * ones already pulled. Each pull re-reads this window; replays are idempotent, so the overlap costs nothing.
 */
export const PULL_OVERLAP_MS = 5 * 60_000

export interface SyncTarget {
  repository: ReviewRepository
  remote: SyncRemote
  userId: string
  /** Adds pulled events to the local log and rebuilds cards. Returns how many were new. */
  merge: (events: readonly ReviewEvent[]) => Promise<number>
  /** Re-reads the local log after it was cleared. */
  reload: () => Promise<void>
  /** Current card state, read after merging. */
  cards: () => ReadonlyMap<string, SrsCard>
}

export interface SyncResult {
  pushed: number
  pulled: number
  /** The device held another account's progress, which was cleared first. */
  replacedOtherAccount: boolean
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let start = 0; start < items.length; start += size) out.push(items.slice(start, start + size))
  return out
}

function later(a: PullCursor | undefined, b: PullCursor): PullCursor {
  if (!a) return b
  const order = Date.parse(a.receivedAt) - Date.parse(b.receivedAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  return order >= 0 ? a : b
}

/**
 * One round of offline-first sync: push the outbox, pull everything new, merge, replay.
 *
 * Guest progress has no owner, so the first sync after signing in uploads it into the account. Progress that
 * belongs to a different account is already on the server (sign-out syncs first), so it is cleared.
 */
export async function syncReviews(target: SyncTarget): Promise<SyncResult> {
  const { repository, remote, userId } = target
  const owner = await repository.getMeta<string>(OWNER_KEY)
  const replacedOtherAccount = owner !== undefined && owner !== userId
  if (replacedOtherAccount) {
    await repository.clear()
    await target.reload()
  }
  if (owner !== userId) await repository.setMeta(OWNER_KEY, userId)

  const outbox = await repository.unsynced()
  for (const batch of chunks(outbox, BATCH_SIZE)) {
    await remote.push(batch)
    await repository.markSynced(batch.map((event) => event.id))
  }

  const saved = await repository.getMeta<PullCursor>(CURSOR_KEY)
  let position: Parameters<SyncRemote['pull']>[0] = saved
    ? { since: new Date(Date.parse(saved.receivedAt) - PULL_OVERLAP_MS).toISOString() }
    : null
  let cursor = saved
  const pulled: ReviewEvent[] = []
  for (;;) {
    const page = await remote.pull(position, BATCH_SIZE)
    for (const item of page) {
      pulled.push(item.event)
      cursor = later(cursor, item.cursor)
    }
    if (page.length < BATCH_SIZE) break
    position = { after: page.at(-1)!.cursor }
  }

  const added = await target.merge(pulled)
  if (cursor) await repository.setMeta(CURSOR_KEY, cursor)

  const touched = new Set([...outbox, ...pulled].map((event) => event.cardId))
  const cards = target.cards()
  const changed = [...touched].flatMap((cardId) => cards.get(cardId) ?? [])
  for (const batch of chunks(changed, BATCH_SIZE)) await remote.saveCards(batch)

  return { pushed: outbox.length, pulled: added, replacedOtherAccount }
}
