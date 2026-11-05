import 'fake-indexeddb/auto'
import { createIndexedDbRepository, createMemoryRepository, type ReviewRepository } from '@/features/srs/repository'
import type { ReviewEvent } from '@/features/srs/types'
import { describe, expect, it } from 'vitest'

function event(id: string): ReviewEvent {
  return {
    id,
    cardId: 'bone:femur_left',
    grade: 3,
    reviewedAt: '2026-03-01T10:00:00.000Z',
    answerMode: 'choice',
    correct: true,
    responseMs: 2000,
  }
}

let dbCount = 0

describe.each([
  ['IndexedDB', () => createIndexedDbRepository(`test-${(dbCount += 1)}`)],
  ['memory', () => createMemoryRepository()],
] as Array<[string, () => ReviewRepository]>)('%s repository', (_name, make) => {
  it('stores each event once, however often it is added', async () => {
    const repository = make()
    expect(await repository.add([event('a'), event('b')], { synced: false })).toHaveLength(2)
    expect(await repository.add([event('a'), event('c')], { synced: true })).toEqual([event('c')])
    expect((await repository.all()).map((item) => item.id).toSorted()).toEqual(['a', 'b', 'c'])
  })

  it('returns plain events without sync bookkeeping', async () => {
    const repository = make()
    await repository.add([event('a')], { synced: false })
    expect(await repository.all()).toEqual([event('a')])
  })

  it('tracks which events still need to be uploaded', async () => {
    const repository = make()
    await repository.add([event('local-1'), event('local-2')], { synced: false })
    await repository.add([event('remote')], { synced: true })
    expect((await repository.unsynced()).map((item) => item.id).toSorted()).toEqual(['local-1', 'local-2'])
    await repository.markSynced(['local-1', 'missing'])
    expect((await repository.unsynced()).map((item) => item.id)).toEqual(['local-2'])
  })

  it('stores metadata and clears everything', async () => {
    const repository = make()
    await repository.setMeta('cursor', '2026-03-01T00:00:00Z')
    expect(await repository.getMeta('cursor')).toBe('2026-03-01T00:00:00Z')
    await repository.add([event('a')], { synced: false })
    await repository.clear()
    expect(await repository.all()).toEqual([])
    expect(await repository.getMeta('cursor')).toBeUndefined()
  })
})

describe('IndexedDB persistence', () => {
  it('keeps events across separate connections, like a page reload', async () => {
    const first = createIndexedDbRepository('reload-test')
    await first.add([event('kept')], { synced: false })
    const second = createIndexedDbRepository('reload-test')
    expect(await second.all()).toEqual([event('kept')])
    expect(await second.unsynced()).toEqual([event('kept')])
  })
})
