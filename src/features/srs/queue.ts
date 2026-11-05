import type { SrsCard } from '@/features/srs/scheduler'
import type { ReviewEvent } from '@/features/srs/types'
import { dayKey } from '@/features/srs/time'

/** New cards introduced per day in review mode, the same default idea as Anki's daily limit. */
export const NEW_CARDS_PER_DAY = 15

/** Cards introduced today, counted by the day of their first review. */
export function newCardsStartedOn(events: readonly ReviewEvent[], now: Date): number {
  const first = new Map<string, string>()
  for (const event of events) {
    const seen = first.get(event.cardId)
    if (!seen || event.reviewedAt < seen) first.set(event.cardId, event.reviewedAt)
  }
  const today = dayKey(now)
  let count = 0
  for (const reviewedAt of first.values()) if (dayKey(new Date(reviewedAt)) === today) count += 1
  return count
}

/**
 * The review order for a set of candidate cards: due cards first (most overdue first), then unseen cards up to the
 * daily new-card limit, in the order given.
 */
export function reviewQueue(
  candidates: readonly string[],
  cards: ReadonlyMap<string, SrsCard>,
  events: readonly ReviewEvent[],
  now: Date,
  newPerDay = NEW_CARDS_PER_DAY,
): string[] {
  const due: Array<{ id: string; at: number }> = []
  const fresh: string[] = []
  for (const id of candidates) {
    const card = cards.get(id)
    if (!card) fresh.push(id)
    else if (card.dueAt.getTime() <= now.getTime()) due.push({ id, at: card.dueAt.getTime() })
  }
  const allowance = Math.max(0, newPerDay - newCardsStartedOn(events, now))
  return [...due.toSorted((a, b) => a.at - b.at).map((item) => item.id), ...fresh.slice(0, allowance)]
}

/** When the next card in the set becomes due, or null if none has been reviewed. */
export function nextDueAt(candidates: readonly string[], cards: ReadonlyMap<string, SrsCard>, now: Date): Date | null {
  let next: Date | null = null
  for (const id of candidates) {
    const card = cards.get(id)
    if (!card || card.dueAt.getTime() <= now.getTime()) continue
    if (!next || card.dueAt < next) next = card.dueAt
  }
  return next
}
