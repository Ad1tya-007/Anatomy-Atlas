import 'fake-indexeddb/auto'
import { createIndexedDbRepository, createMemoryRepository } from '@/features/srs/repository'
import { setRepository, useSrsStore } from '@/features/srs/srsStore'
import type { ReviewEvent, StudyAnswer } from '@/features/srs/types'
import { beforeEach, describe, expect, it } from 'vitest'

const T0 = new Date('2026-03-02T09:00:00Z')

const femur: StudyAnswer = {
  kind: 'bone',
  boneId: 'femur_left',
  landmarkId: null,
  answerMode: 'type',
  correct: true,
  responseMs: 9000,
  selfGrade: null,
}

beforeEach(() => {
  setRepository(createMemoryRepository())
})

describe('srs store', () => {
  it('records an answer as a graded review and schedules the card', async () => {
    const event = await useSrsStore.getState().record(femur, T0)
    expect(event).toMatchObject({ cardId: 'bone:femur_left', grade: 3, correct: true, responseMs: 9000 })
    const card = useSrsStore.getState().cards.get('bone:femur_left')!
    expect(card.reps).toBe(1)
    expect(card.dueAt.getTime()).toBeGreaterThan(T0.getTime())
  })

  it('files landmark answers under the landmark card', async () => {
    await useSrsStore.getState().record({ ...femur, kind: 'landmark', landmarkId: 'femur_left_greater_trochanter' }, T0)
    expect([...useSrsStore.getState().cards.keys()]).toEqual(['landmark:femur_left_greater_trochanter'])
  })

  it('restores progress after a reload', async () => {
    const repository = createIndexedDbRepository('srs-store-reload')
    setRepository(repository)
    await useSrsStore.getState().record(femur, T0)
    await useSrsStore.getState().record({ ...femur, correct: false }, new Date(T0.getTime() + 60_000))
    const before = useSrsStore.getState().cards.get('bone:femur_left')

    setRepository(createIndexedDbRepository('srs-store-reload'))
    expect(useSrsStore.getState().events).toEqual([])
    await useSrsStore.getState().load()
    expect(useSrsStore.getState().events).toHaveLength(2)
    expect(useSrsStore.getState().cards.get('bone:femur_left')).toEqual(before)
  })

  it('merges events from another device idempotently and replays in time order', async () => {
    await useSrsStore.getState().record(femur, new Date(T0.getTime() + 5 * 86_400_000))
    const remote: ReviewEvent = {
      id: 'remote-1',
      cardId: 'bone:femur_left',
      grade: 1,
      reviewedAt: T0.toISOString(),
      answerMode: 'choice',
      correct: false,
      responseMs: 1000,
    }
    expect(await useSrsStore.getState().merge([remote])).toBe(1)
    expect(await useSrsStore.getState().merge([remote])).toBe(0)
    const card = useSrsStore.getState().cards.get('bone:femur_left')!
    expect(card.reps).toBe(2)
    expect(card.lapses).toBe(0)
    expect(useSrsStore.getState().events).toHaveLength(2)
  })

  it('replays when an answer is older than the card’s last review', async () => {
    await useSrsStore.getState().record(femur, new Date(T0.getTime() + 86_400_000))
    await useSrsStore.getState().record({ ...femur, correct: false }, T0)
    expect(useSrsStore.getState().cards.get('bone:femur_left')!.reps).toBe(2)
  })

  it('reset forgets everything', async () => {
    await useSrsStore.getState().record(femur, T0)
    await useSrsStore.getState().reset()
    expect(useSrsStore.getState().cards.size).toBe(0)
    await useSrsStore.getState().load()
    expect(useSrsStore.getState().events).toEqual([])
  })
})
