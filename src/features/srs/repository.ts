import type { ReviewEvent } from '@/features/srs/types'
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

/** Local review storage. Unsynced events double as the sync outbox. */
export interface ReviewRepository {
  all(): Promise<ReviewEvent[]>
  /** Stores events whose ids are not stored yet and returns those. Re-adding an event is a no-op. */
  add(events: readonly ReviewEvent[], options: { synced: boolean }): Promise<ReviewEvent[]>
  unsynced(): Promise<ReviewEvent[]>
  markSynced(ids: readonly string[]): Promise<void>
  getMeta<T>(key: string): Promise<T | undefined>
  setMeta(key: string, value: unknown): Promise<void>
  clear(): Promise<void>
}

type StoredReview = ReviewEvent & { synced: 0 | 1 }

interface AtlasDB extends DBSchema {
  reviews: { key: string; value: StoredReview; indexes: { synced: number } }
  meta: { key: string; value: unknown }
}

const DB_NAME = 'anatomy-atlas'

function strip(stored: StoredReview): ReviewEvent {
  const { synced: _synced, ...event } = stored
  return event
}

export function createIndexedDbRepository(name = DB_NAME): ReviewRepository {
  let db: Promise<IDBPDatabase<AtlasDB>> | null = null
  const open = () => {
    db ??= openDB<AtlasDB>(name, 1, {
      upgrade(database) {
        const reviews = database.createObjectStore('reviews', { keyPath: 'id' })
        reviews.createIndex('synced', 'synced')
        database.createObjectStore('meta')
      },
    })
    return db
  }
  return {
    async all() {
      return (await (await open()).getAll('reviews')).map(strip)
    },
    async add(events, { synced }) {
      const tx = (await open()).transaction('reviews', 'readwrite')
      const added: ReviewEvent[] = []
      for (const event of events) {
        if (await tx.store.getKey(event.id)) continue
        await tx.store.put({ ...event, synced: synced ? 1 : 0 })
        added.push(event)
      }
      await tx.done
      return added
    },
    async unsynced() {
      return (await (await open()).getAllFromIndex('reviews', 'synced', 0)).map(strip)
    },
    async markSynced(ids) {
      const tx = (await open()).transaction('reviews', 'readwrite')
      for (const id of ids) {
        const stored = await tx.store.get(id)
        if (stored && stored.synced === 0) await tx.store.put({ ...stored, synced: 1 })
      }
      await tx.done
    },
    async getMeta<T>(key: string) {
      return (await (await open()).get('meta', key)) as T | undefined
    },
    async setMeta(key, value) {
      await (await open()).put('meta', value, key)
    },
    async clear() {
      const database = await open()
      await database.clear('reviews')
      await database.clear('meta')
    },
  }
}

export function createMemoryRepository(): ReviewRepository {
  const reviews = new Map<string, StoredReview>()
  const meta = new Map<string, unknown>()
  return {
    async all() {
      return [...reviews.values()].map(strip)
    },
    async add(events, { synced }) {
      const added: ReviewEvent[] = []
      for (const event of events) {
        if (reviews.has(event.id)) continue
        reviews.set(event.id, { ...event, synced: synced ? 1 : 0 })
        added.push(event)
      }
      return added
    },
    async unsynced() {
      return [...reviews.values()].filter((review) => review.synced === 0).map(strip)
    },
    async markSynced(ids) {
      for (const id of ids) {
        const stored = reviews.get(id)
        if (stored) stored.synced = 1
      }
    },
    async getMeta<T>(key: string) {
      return meta.get(key) as T | undefined
    },
    async setMeta(key, value) {
      meta.set(key, value)
    },
    async clear() {
      reviews.clear()
      meta.clear()
    },
  }
}

export function createDefaultRepository(): ReviewRepository {
  return typeof indexedDB === 'undefined' ? createMemoryRepository() : createIndexedDbRepository()
}
