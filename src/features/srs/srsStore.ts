import { gradeAnswer } from '@/features/srs/grading'
import { createDefaultRepository, type ReviewRepository } from '@/features/srs/repository'
import { applyReview, getScheduler, replay, type Scheduler, type SrsCard } from '@/features/srs/scheduler'
import { cardIdFor, type ReviewEvent, type StudyAnswer } from '@/features/srs/types'
import { create } from 'zustand'

interface SrsState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  events: ReviewEvent[]
  cards: Map<string, SrsCard>
  scheduler: Scheduler | null
  load: () => Promise<void>
  /** Re-reads the log from storage, for when something else changed it. */
  reload: () => Promise<void>
  record: (answer: StudyAnswer, at?: Date) => Promise<ReviewEvent | null>
  /** Adds events from another device. Returns how many were new. */
  merge: (events: readonly ReviewEvent[]) => Promise<number>
  reset: () => Promise<void>
}

let repository: ReviewRepository = createDefaultRepository()
let loading: Promise<void> | null = null

export function getRepository(): ReviewRepository {
  return repository
}

/** Swaps the storage backend and forgets loaded state. Used by tests. */
export function setRepository(next: ReviewRepository): void {
  repository = next
  loading = null
  useSrsStore.setState({ status: 'idle', events: [], cards: new Map(), scheduler: null })
}

function newId(): string {
  return crypto.randomUUID()
}

export const useSrsStore = create<SrsState>((set, get) => ({
  status: 'idle',
  events: [],
  cards: new Map(),
  scheduler: null,

  load: () => {
    loading ??= (async () => {
      set({ status: 'loading' })
      try {
        const [scheduler, events] = await Promise.all([getScheduler(), repository.all()])
        set({ status: 'ready', scheduler, events, cards: replay(scheduler, events) })
      } catch (error) {
        console.error('Could not load study progress', error)
        set({ status: 'error' })
      }
    })()
    return loading
  },

  reload: () => {
    loading = null
    return get().load()
  },

  record: async (answer, at = new Date()) => {
    await get().load()
    const { scheduler, status } = get()
    if (!scheduler || status !== 'ready') return null
    const event: ReviewEvent = {
      id: newId(),
      cardId: cardIdFor(answer.kind, answer.boneId, answer.landmarkId),
      grade: gradeAnswer(answer),
      reviewedAt: at.toISOString(),
      answerMode: answer.answerMode,
      correct: answer.correct,
      responseMs: answer.responseMs === null ? null : Math.max(0, Math.round(answer.responseMs)),
    }
    await repository.add([event], { synced: false })
    const state = get()
    const events = [...state.events, event]
    const current = state.cards.get(event.cardId)
    let cards: Map<string, SrsCard>
    if (current?.lastReviewAt && current.lastReviewAt > at) {
      cards = replay(scheduler, events)
    } else {
      cards = new Map(state.cards)
      cards.set(event.cardId, applyReview(scheduler, current, event.cardId, event.grade, at))
    }
    set({ events, cards })
    return event
  },

  merge: async (incoming) => {
    await get().load()
    const { scheduler } = get()
    if (!scheduler) return 0
    const added = await repository.add(incoming, { synced: true })
    if (added.length === 0) return 0
    const events = [...get().events, ...added]
    set({ events, cards: replay(scheduler, events) })
    return added.length
  },

  reset: async () => {
    await repository.clear()
    set({ events: [], cards: new Map() })
  },
}))
