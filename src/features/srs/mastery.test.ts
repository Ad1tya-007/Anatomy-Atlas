import { quizBones } from '@/data/bones'
import {
  bandFor,
  boneForCard,
  MASTERY_BANDS,
  masteryByBone,
  masteryByRegion,
  weakestBones,
} from '@/features/srs/mastery'
import { createScheduler, replay, retrievability, type Scheduler } from '@/features/srs/scheduler'
import type { Grade, ReviewEvent } from '@/features/srs/types'
import { buildWeakestWalk } from '@/features/srs/weakestWalk'
import { beforeAll, describe, expect, it } from 'vitest'

const DAY = 86_400_000
const T0 = new Date('2026-03-02T09:00:00Z')
const LATER = new Date(T0.getTime() + 10 * DAY)

let scheduler: Scheduler

beforeAll(async () => {
  scheduler = await createScheduler()
})

function event(cardId: string, grade: Grade, at = T0): ReviewEvent {
  return {
    id: `${cardId}@${at.toISOString()}`,
    cardId,
    grade,
    reviewedAt: at.toISOString(),
    answerMode: 'choice',
    correct: grade > 1,
    responseMs: 2000,
  }
}

describe('boneForCard', () => {
  it('maps bone and landmark cards to their bone', () => {
    expect(boneForCard('bone:femur_left')).toBe('femur_left')
    expect(boneForCard('landmark:femur_left_greater_trochanter')).toBe('femur_left')
    expect(boneForCard('landmark:nope')).toBeNull()
    expect(boneForCard('garbage')).toBeNull()
  })
})

describe('bandFor', () => {
  it('uses inclusive lower bounds', () => {
    expect(bandFor(0).id).toBe('weak')
    expect(bandFor(0.6999).id).toBe('weak')
    expect(bandFor(0.7).id).toBe('fair')
    expect(bandFor(0.85).id).toBe('strong')
    expect(bandFor(0.95).id).toBe('mastered')
    expect(bandFor(1).id).toBe('mastered')
    const mins = MASTERY_BANDS.map((band) => band.min)
    expect(mins).toEqual(mins.toSorted((a, b) => a - b))
  })
})

describe('masteryByBone', () => {
  it('averages the bone card and its landmark cards', () => {
    const cards = replay(scheduler, [event('bone:femur_left', 1), event('landmark:femur_left_greater_trochanter', 4)])
    const mastery = masteryByBone(scheduler, cards, LATER)
    const expected =
      (retrievability(scheduler, cards.get('bone:femur_left'), LATER)! +
        retrievability(scheduler, cards.get('landmark:femur_left_greater_trochanter'), LATER)!) /
      2
    expect(mastery.get('femur_left')).toBeCloseTo(expected, 10)
    expect(mastery.has('femur_right')).toBe(false)
  })

  it('colors each side of a paired bone separately', () => {
    const cards = replay(scheduler, [event('bone:femur_left', 4), event('bone:femur_right', 1)])
    const mastery = masteryByBone(scheduler, cards, LATER)
    expect(mastery.get('femur_left')).toBeGreaterThan(mastery.get('femur_right')!)
  })
})

describe('the heatmap and the dashboard agree', () => {
  it('reports each region as the mean of the per-bone values the heatmap paints', () => {
    const studied = quizBones().filter((_, index) => index % 3 === 0)
    const cards = replay(
      scheduler,
      studied.map((bone, index) => event(`bone:${bone.id}`, ((index % 4) + 1) as Grade)),
    )
    const heatmap = masteryByBone(scheduler, cards, LATER)
    for (const row of masteryByRegion(heatmap)) {
      const values = quizBones()
        .filter((bone) => bone.region === row.region && heatmap.has(bone.id))
        .map((bone) => heatmap.get(bone.id)!)
      expect(row.studied).toBe(values.length)
      expect(row.total).toBe(quizBones().filter((bone) => bone.region === row.region).length)
      const mean = values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length
      expect(row.average === null).toBe(mean === null)
      expect(row.average ?? 0).toBeCloseTo(mean ?? 0, 10)
    }
  })
})

describe('weakest bones', () => {
  it('orders studied quiz bones from weakest and caps the count', () => {
    const mastery = new Map([
      ['femur_left', 0.9],
      ['tibia_left', 0.4],
      ['patella_left', 0.6],
      ['ethmoid', 0.1],
    ])
    // The ethmoid is not part of the quiz, so it never appears in a study walk.
    expect(weakestBones(mastery, 2)).toEqual(['tibia_left', 'patella_left'])
  })

  it('builds a walk only when something has been studied', () => {
    expect(buildWeakestWalk(new Map())).toBeNull()
    const walk = buildWeakestWalk(new Map([['femur_left', 0.42]]))!
    expect(walk.stops).toHaveLength(1)
    expect(walk.stops[0]).toMatchObject({ boneId: 'femur_left' })
    expect(walk.stops[0]!.text).toMatch(/^42% estimated recall\./)
  })
})
