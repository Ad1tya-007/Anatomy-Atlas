import { gradeAnswer } from '@/features/srs/grading'
import { createScheduler, previewDue, replay, retrievability, type Scheduler } from '@/features/srs/scheduler'
import type { Grade, ReviewEvent } from '@/features/srs/types'
import { shuffle } from '@/features/study/engine'
import { seededRng } from '@/test/rng'
import { beforeAll, describe, expect, it } from 'vitest'

const DAY = 86_400_000
const T0 = new Date('2026-03-02T09:00:00Z')

let scheduler: Scheduler

beforeAll(async () => {
  scheduler = await createScheduler()
})

function event(cardId: string, grade: Grade, at: Date, id = `${cardId}@${at.toISOString()}`): ReviewEvent {
  return { id, cardId, grade, reviewedAt: at.toISOString(), answerMode: 'choice', correct: grade > 1, responseMs: 3000 }
}

describe('gradeAnswer', () => {
  it.each([
    ['choice', true, 2000, 3],
    ['choice', true, 9000, 2],
    ['choice', false, 1000, 1],
    ['type', true, 4000, 4],
    ['type', true, 12_000, 3],
    ['type', true, 20_000, 2],
    ['locate', true, 3000, 4],
    ['locate', true, 7000, 3],
    ['locate', false, 2000, 1],
  ] as const)('%s, correct=%s, %ims → grade %i', (answerMode, correct, responseMs, expected) => {
    expect(gradeAnswer({ answerMode, correct, responseMs, selfGrade: null })).toBe(expected)
  })

  it('uses the self-grade in reveal mode', () => {
    expect(gradeAnswer({ answerMode: 'reveal', correct: true, responseMs: 1000, selfGrade: 2 })).toBe(2)
    expect(gradeAnswer({ answerMode: 'reveal', correct: false, responseMs: 1000, selfGrade: null })).toBe(1)
  })

  it('treats a missing response time as Good', () => {
    expect(gradeAnswer({ answerMode: 'type', correct: true, responseMs: null, selfGrade: null })).toBe(3)
  })
})

describe('scheduling with a fixed clock', () => {
  it('schedules a Good first answer more than a day out', () => {
    const card = replay(scheduler, [event('bone:femur_left', 3, T0)]).get('bone:femur_left')!
    expect(card.dueAt.getTime()).toBeGreaterThan(T0.getTime() + DAY)
  })

  it('brings a forgotten card back sooner than a remembered one', () => {
    const good = replay(scheduler, [event('bone:a', 3, T0)]).get('bone:a')!
    const again = replay(scheduler, [event('bone:a', 1, T0)]).get('bone:a')!
    expect(again.dueAt.getTime()).toBeLessThan(good.dueAt.getTime())
  })

  it('grows the interval with each successful review', () => {
    let at = T0
    const events: ReviewEvent[] = []
    const intervals: number[] = []
    for (let step = 0; step < 4; step += 1) {
      events.push(event('bone:femur_left', 3, at))
      const card = replay(scheduler, events).get('bone:femur_left')!
      intervals.push(card.dueAt.getTime() - at.getTime())
      at = card.dueAt
    }
    for (let step = 1; step < intervals.length; step += 1) expect(intervals[step]).toBeGreaterThan(intervals[step - 1]!)
  })

  it('orders previewed due dates Again < Hard < Good < Easy', () => {
    const due = previewDue(scheduler, undefined, 'bone:femur_left', T0)
    const times = ([1, 2, 3, 4] as const).map((grade) => due.get(grade)!.getTime())
    expect(times).toEqual(times.toSorted((a, b) => a - b))
    expect(new Set(times).size).toBe(4)
  })
})

describe('replay', () => {
  const history = [
    event('bone:femur_left', 3, T0),
    event('bone:femur_left', 1, new Date(T0.getTime() + 5 * DAY)),
    event('landmark:femur_left_greater_trochanter', 4, new Date(T0.getTime() + DAY)),
    event('bone:femur_left', 3, new Date(T0.getTime() + 6 * DAY)),
    event('bone:tibia_left', 2, new Date(T0.getTime() + 2 * DAY)),
  ]

  it('produces identical cards whatever order the events arrive in', () => {
    const expected = replay(scheduler, history)
    for (const seed of [1, 2, 3, 4, 5]) {
      const cards = replay(scheduler, shuffle(history, seededRng(seed)))
      expect([...cards.entries()]).toEqual([...expected.entries()])
    }
  })

  it('counts every review and lapse', () => {
    const femur = replay(scheduler, history).get('bone:femur_left')!
    expect(femur.reps).toBe(3)
    expect(femur.lapses).toBe(1)
  })
})

describe('retrievability', () => {
  it('is null before the first review and decays over time', () => {
    expect(retrievability(scheduler, undefined, T0)).toBeNull()
    const card = replay(scheduler, [event('bone:femur_left', 3, T0)]).get('bone:femur_left')!
    const soon = retrievability(scheduler, card, new Date(T0.getTime() + DAY))!
    const later = retrievability(scheduler, card, new Date(T0.getTime() + 30 * DAY))!
    expect(soon).toBeGreaterThan(later)
    expect(soon).toBeLessThanOrEqual(1)
    expect(later).toBeGreaterThan(0)
  })

  it('is about the desired retention when the card falls due', () => {
    const card = replay(scheduler, [event('bone:femur_left', 3, T0)]).get('bone:femur_left')!
    expect(retrievability(scheduler, card, card.dueAt)).toBeCloseTo(0.9, 1)
  })
})
