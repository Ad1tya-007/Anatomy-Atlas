import { NEW_CARDS_PER_DAY, newCardsStartedOn, nextDueAt, reviewQueue } from '@/features/srs/queue'
import { createScheduler, replay, type Scheduler } from '@/features/srs/scheduler'
import type { Grade, ReviewEvent } from '@/features/srs/types'
import { beforeAll, describe, expect, it } from 'vitest'

const DAY = 86_400_000
const T0 = new Date('2026-03-02T09:00:00Z')

let scheduler: Scheduler

beforeAll(async () => {
  scheduler = await createScheduler()
})

function event(cardId: string, grade: Grade, at: Date): ReviewEvent {
  return {
    id: `${cardId}@${at.toISOString()}`,
    cardId,
    grade,
    reviewedAt: at.toISOString(),
    answerMode: 'type',
    correct: grade > 1,
    responseMs: 5000,
  }
}

describe('reviewQueue', () => {
  const candidates = ['bone:a', 'bone:b', 'bone:c', 'bone:d']

  it('offers unseen cards when nothing has been studied', () => {
    expect(reviewQueue(candidates, new Map(), [], T0)).toEqual(candidates)
  })

  it('leaves a just-reviewed card out until it falls due, then brings it back', () => {
    const events = [event('bone:a', 3, T0)]
    const cards = replay(scheduler, events)
    const due = cards.get('bone:a')!.dueAt
    expect(reviewQueue(['bone:a'], cards, events, new Date(T0.getTime() + DAY))).toEqual([])
    expect(reviewQueue(['bone:a'], cards, events, new Date(due.getTime() - 1000))).toEqual([])
    expect(reviewQueue(['bone:a'], cards, events, due)).toEqual(['bone:a'])
  })

  it('puts the most overdue card first, then new cards', () => {
    const events = [event('bone:a', 3, T0), event('bone:b', 1, T0)]
    const cards = replay(scheduler, events)
    const later = new Date(T0.getTime() + 60 * DAY)
    // bone:b was forgotten, so it fell due long before bone:a.
    expect(reviewQueue(candidates, cards, events, later)).toEqual(['bone:b', 'bone:a', 'bone:c', 'bone:d'])
  })

  it('stops introducing new cards once the daily limit is reached', () => {
    const many = Array.from({ length: NEW_CARDS_PER_DAY + 5 }, (_, index) => `bone:n${index}`)
    const events = many.slice(0, NEW_CARDS_PER_DAY).map((id) => event(id, 3, T0))
    const cards = replay(scheduler, events)
    expect(newCardsStartedOn(events, T0)).toBe(NEW_CARDS_PER_DAY)
    expect(reviewQueue(many, cards, events, T0)).toEqual([])
    const tomorrow = new Date(T0.getTime() + DAY)
    expect(reviewQueue(many, cards, events, tomorrow)).toEqual(many.slice(NEW_CARDS_PER_DAY))
  })
})

describe('nextDueAt', () => {
  it('returns the earliest future due date, or null', () => {
    expect(nextDueAt(['bone:a'], new Map(), T0)).toBeNull()
    const events = [event('bone:a', 3, T0), event('bone:b', 1, T0)]
    const cards = replay(scheduler, events)
    expect(nextDueAt(['bone:a', 'bone:b'], cards, T0)).toEqual(cards.get('bone:b')!.dueAt)
  })
})
