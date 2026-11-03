import { createScheduler, replay, type Scheduler } from '@/features/srs/scheduler'
import { accuracyBy, dueForecast, retentionByDay, reviewsPerDay, streak, summarize } from '@/features/srs/stats'
import type { Grade, ReviewEvent } from '@/features/srs/types'
import { beforeAll, describe, expect, it } from 'vitest'

const DAY = 86_400_000
const NOW = new Date('2026-03-10T15:00:00Z')

let scheduler: Scheduler

beforeAll(async () => {
  scheduler = await createScheduler()
})

function daysAgo(days: number, hour = 10): Date {
  const date = new Date(NOW.getTime() - days * DAY)
  date.setUTCHours(hour, 0, 0, 0)
  return date
}

let seq = 0
function event(cardId: string, grade: Grade, at: Date, correct = grade > 1): ReviewEvent {
  seq += 1
  return { id: `e${seq}`, cardId, grade, reviewedAt: at.toISOString(), answerMode: 'choice', correct, responseMs: 1 }
}

describe('reviewsPerDay', () => {
  it('buckets by day and fills empty days with zero', () => {
    const series = reviewsPerDay(
      [event('bone:a', 3, daysAgo(0)), event('bone:b', 3, daysAgo(0, 8)), event('bone:a', 3, daysAgo(2))],
      NOW,
      5,
    )
    expect(series.map((day) => day.count)).toEqual([0, 0, 1, 0, 2])
    expect(series.at(-1)!.day).toBe('2026-03-10')
  })
})

describe('retentionByDay', () => {
  it('skips first sightings and measures repeat reviews only', () => {
    const points = retentionByDay([
      event('bone:a', 1, daysAgo(3)),
      event('bone:a', 3, daysAgo(1)),
      event('bone:b', 3, daysAgo(1)),
      event('bone:b', 1, daysAgo(0)),
      event('bone:a', 4, daysAgo(0)),
    ])
    expect(points).toEqual([
      expect.objectContaining({ day: '2026-03-09', retention: 1, reviews: 1 }),
      expect.objectContaining({ day: '2026-03-10', retention: 0.5, reviews: 2 }),
    ])
  })
})

describe('dueForecast', () => {
  it('counts overdue cards toward today', () => {
    const events = [event('bone:a', 1, daysAgo(20)), event('bone:b', 3, daysAgo(0))]
    const cards = replay(scheduler, events)
    const forecast = dueForecast(cards, NOW, 14)
    expect(forecast).toHaveLength(14)
    expect(forecast[0]).toMatchObject({ label: 'Today', count: 1 })
    expect(forecast.reduce((sum, day) => sum + day.count, 0)).toBe(2)
  })
})

describe('accuracyBy', () => {
  it('groups by region and by classification, weakest first', () => {
    const events = [
      event('bone:femur_left', 3, daysAgo(0)),
      event('bone:femur_left', 1, daysAgo(0)),
      event('landmark:femur_left_greater_trochanter', 3, daysAgo(0)),
      event('bone:frontal', 1, daysAgo(0)),
    ]
    expect(accuracyBy(events, 'region')).toEqual([
      expect.objectContaining({ key: 'head', correct: 0, total: 1, accuracy: 0 }),
      expect.objectContaining({ key: 'lower-limb', correct: 2, total: 3 }),
    ])
    expect(accuracyBy(events, 'classification').map((row) => row.key)).toEqual(['flat', 'long'])
  })
})

describe('streak', () => {
  it('counts consecutive days ending today', () => {
    expect(
      streak([event('bone:a', 3, daysAgo(0)), event('bone:a', 3, daysAgo(1)), event('bone:a', 3, daysAgo(3))], NOW),
    ).toBe(2)
  })

  it('still counts yesterday when nothing has been reviewed yet today', () => {
    expect(streak([event('bone:a', 3, daysAgo(1)), event('bone:a', 3, daysAgo(2))], NOW)).toBe(2)
  })

  it('is zero after a missed day', () => {
    expect(streak([event('bone:a', 3, daysAgo(2))], NOW)).toBe(0)
    expect(streak([], NOW)).toBe(0)
  })
})

describe('summarize', () => {
  it('reports totals, due cards, and accuracy', () => {
    const events = [event('bone:a', 1, daysAgo(20)), event('bone:b', 3, daysAgo(0))]
    expect(summarize(events, replay(scheduler, events), NOW)).toEqual({
      reviews: 2,
      studied: 2,
      dueNow: 1,
      accuracy: 0.5,
    })
    expect(summarize([], new Map(), NOW).accuracy).toBeNull()
  })
})
