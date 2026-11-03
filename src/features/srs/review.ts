import { scopeCardTargets, type StudyConfig } from '@/features/study/engine'
import { nextDueAt, reviewQueue } from '@/features/srs/queue'
import type { SrsCard } from '@/features/srs/scheduler'
import { cardIdFor, parseCardId, type ReviewEvent } from '@/features/srs/types'
import { getLandmark } from '@/data/landmarks'
import type { StudyKind } from '@/types/anatomy'

export interface ReviewTarget {
  boneId: string
  landmarkId: string | null
}

export interface ReviewPick {
  target: ReviewTarget | null
  /** Cards left in today's queue, counting the picked one. */
  remaining: number
  /** When the next card in scope comes due, if the queue is empty. */
  nextDue: Date | null
}

function targetFor(cardId: string): ReviewTarget | null {
  const parsed = parseCardId(cardId)
  if (!parsed) return null
  if (parsed.kind === 'bone') return { boneId: parsed.id, landmarkId: null }
  const record = getLandmark(parsed.id)
  return record ? { boneId: record.boneId, landmarkId: record.landmark.id } : null
}

/** Picks the next card to review in the study scope, skipping the card just answered when another is available. */
export function pickReview(
  config: StudyConfig,
  kind: StudyKind,
  progress: { cards: ReadonlyMap<string, SrsCard>; events: readonly ReviewEvent[] },
  excludeCardId: string | null,
  now: Date,
): ReviewPick {
  const candidates = scopeCardTargets(config, kind).map((target) => cardIdFor(kind, target.boneId, target.landmarkId))
  const queue = reviewQueue(candidates, progress.cards, progress.events, now)
  const choice = queue.find((id) => id !== excludeCardId) ?? queue[0]
  return {
    target: choice ? targetFor(choice) : null,
    remaining: queue.length,
    nextDue: queue.length === 0 ? nextDueAt(candidates, progress.cards, now) : null,
  }
}
