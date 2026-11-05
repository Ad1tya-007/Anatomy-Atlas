import type { Grade, ReviewEvent } from '@/features/srs/types'
import { DefaultScheduler } from 'ts-fsrs'

export const DESIRED_RETENTION = 0.9

/** Fuzz is off so replaying the same events always produces the same cards on every device. */
export function createScheduler() {
  return DefaultScheduler({ version: 'FSRS-7', enableFuzz: false, desiredRetention: DESIRED_RETENTION })
}

export type Scheduler = Awaited<ReturnType<typeof createScheduler>>
export type SrsCard = ReturnType<Scheduler['review']>['card']

let shared: Promise<Scheduler> | null = null

export function getScheduler(): Promise<Scheduler> {
  shared ??= createScheduler()
  return shared
}

export function compareEvents(a: ReviewEvent, b: ReviewEvent): number {
  if (a.reviewedAt !== b.reviewedAt) return a.reviewedAt < b.reviewedAt ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export function applyReview(scheduler: Scheduler, card: SrsCard | undefined, cardId: string, grade: Grade, at: Date) {
  const current = card ?? scheduler.newCard({ now: at, cardId })
  return scheduler.review({ card: current, grade, now: at }).card
}

/** Rebuilds every card from the review history. Order is by time, then id, so the result is deterministic. */
export function replay(scheduler: Scheduler, events: readonly ReviewEvent[]): Map<string, SrsCard> {
  const cards = new Map<string, SrsCard>()
  for (const event of events.toSorted(compareEvents)) {
    cards.set(
      event.cardId,
      applyReview(scheduler, cards.get(event.cardId), event.cardId, event.grade, new Date(event.reviewedAt)),
    )
  }
  return cards
}

/** When each grade would schedule the card next, for labeling the self-grade buttons. */
export function previewDue(
  scheduler: Scheduler,
  card: SrsCard | undefined,
  cardId: string,
  now: Date,
): Map<Grade, Date> {
  const current = card ?? scheduler.newCard({ now, cardId })
  const due = new Map<Grade, Date>()
  for (const item of scheduler.preview({ card: current, now })) {
    if (item.grade >= 1 && item.grade <= 4) due.set(item.grade as Grade, item.card.dueAt)
  }
  return due
}

/** Probability of recalling the card at `now`, or null for a card that has never been reviewed. */
export function retrievability(scheduler: Scheduler, card: SrsCard | undefined, now: Date): number | null {
  if (!card?.lastReviewAt) return null
  const elapsed = Math.max(0, scheduler.chrono.difference(card.lastReviewAt, now))
  const value = scheduler.model.forgettingCurve(card, elapsed)
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : null
}
