import { getBone } from '@/data/bones'
import { CLASS_LABEL, REGION_LABEL } from '@/data/labels'
import { boneForCard } from '@/features/srs/mastery'
import { compareEvents, type SrsCard } from '@/features/srs/scheduler'
import { addDays, dayKey, startOfDay } from '@/features/srs/time'
import type { ReviewEvent } from '@/features/srs/types'

export interface DayCount {
  day: string
  label: string
  count: number
}

function dayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Reviews per day for the last `days` days, oldest first, ending today. */
export function reviewsPerDay(events: readonly ReviewEvent[], now: Date, days = 30): DayCount[] {
  const counts = new Map<string, number>()
  for (const event of events) {
    const key = dayKey(new Date(event.reviewedAt))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(startOfDay(now), index - days + 1)
    const key = dayKey(date)
    return { day: key, label: dayLabel(date), count: counts.get(key) ?? 0 }
  })
}

export interface RetentionPoint {
  day: string
  label: string
  /** Share of repeat reviews (not first sightings) answered correctly, 0–1. */
  retention: number
  reviews: number
}

/** Daily retention over repeat reviews. A card's first review measures learning, not memory, so it is left out. */
export function retentionByDay(events: readonly ReviewEvent[]): RetentionPoint[] {
  const seen = new Set<string>()
  const byDay = new Map<string, { date: Date; correct: number; total: number }>()
  for (const event of events.toSorted(compareEvents)) {
    if (!seen.has(event.cardId)) {
      seen.add(event.cardId)
      continue
    }
    const date = new Date(event.reviewedAt)
    const key = dayKey(date)
    const entry = byDay.get(key) ?? { date, correct: 0, total: 0 }
    entry.total += 1
    if (event.grade > 1) entry.correct += 1
    byDay.set(key, entry)
  }
  return [...byDay.entries()]
    .toSorted((a, b) => a[0].localeCompare(b[0]))
    .map(([day, entry]) => ({
      day,
      label: dayLabel(entry.date),
      retention: entry.correct / entry.total,
      reviews: entry.total,
    }))
}

/** Cards coming due on each of the next `days` days. Overdue cards count toward today. */
export function dueForecast(cards: ReadonlyMap<string, SrsCard>, now: Date, days = 14): DayCount[] {
  const today = startOfDay(now)
  const buckets = Array.from({ length: days }, (_, index) => {
    const date = addDays(today, index)
    return { day: dayKey(date), label: index === 0 ? 'Today' : dayLabel(date), count: 0 }
  })
  const end = addDays(today, days).getTime()
  for (const card of cards.values()) {
    const due = card.dueAt.getTime()
    if (due >= end) continue
    const index = due < today.getTime() ? 0 : buckets.findIndex((bucket) => bucket.day === dayKey(card.dueAt))
    if (index >= 0) buckets[index]!.count += 1
  }
  return buckets
}

export interface AccuracyRow {
  key: string
  label: string
  correct: number
  total: number
  accuracy: number
}

/** Accuracy grouped by the region or classification of the bone each card belongs to. */
export function accuracyBy(events: readonly ReviewEvent[], group: 'region' | 'classification'): AccuracyRow[] {
  const rows = new Map<string, { correct: number; total: number }>()
  for (const event of events) {
    const bone = getBone(boneForCard(event.cardId))
    if (!bone) continue
    const key = group === 'region' ? bone.region : bone.classification
    const row = rows.get(key) ?? { correct: 0, total: 0 }
    row.total += 1
    if (event.correct) row.correct += 1
    rows.set(key, row)
  }
  const labels: Record<string, string> = group === 'region' ? REGION_LABEL : CLASS_LABEL
  return [...rows.entries()]
    .map(([key, row]) => ({ key, label: labels[key] ?? key, ...row, accuracy: row.correct / row.total }))
    .toSorted((a, b) => a.accuracy - b.accuracy || a.label.localeCompare(b.label))
}

/** Consecutive days with at least one review, ending today, or yesterday if nothing has been reviewed yet today. */
export function streak(events: readonly ReviewEvent[], now: Date): number {
  const days = new Set(events.map((event) => dayKey(new Date(event.reviewedAt))))
  let cursor = startOfDay(now)
  if (!days.has(dayKey(cursor))) cursor = addDays(cursor, -1)
  let count = 0
  while (days.has(dayKey(cursor))) {
    count += 1
    cursor = addDays(cursor, -1)
  }
  return count
}

export interface Summary {
  reviews: number
  studied: number
  dueNow: number
  accuracy: number | null
}

export function summarize(events: readonly ReviewEvent[], cards: ReadonlyMap<string, SrsCard>, now: Date): Summary {
  let dueNow = 0
  for (const card of cards.values()) if (card.dueAt.getTime() <= now.getTime()) dueNow += 1
  const correct = events.filter((event) => event.correct).length
  return {
    reviews: events.length,
    studied: cards.size,
    dueNow,
    accuracy: events.length > 0 ? correct / events.length : null,
  }
}
