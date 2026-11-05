import { bones, getBone } from '@/data/bones'
import { retrievability, type Scheduler, type SrsCard } from '@/features/srs/scheduler'
import { parseCardId } from '@/features/srs/types'
import { REGION_LABEL } from '@/data/labels'
import { getLandmark } from '@/data/landmarks'

export interface MasteryBand {
  id: 'weak' | 'fair' | 'strong' | 'mastered'
  label: string
  min: number
  color: string
}

/** Ordered from weakest. A value belongs to the last band whose `min` it reaches. */
export const MASTERY_BANDS: MasteryBand[] = [
  { id: 'weak', label: 'Weak', min: 0, color: '#d1495b' },
  { id: 'fair', label: 'Fair', min: 0.7, color: '#e59f3c' },
  { id: 'strong', label: 'Strong', min: 0.85, color: '#c9c24a' },
  { id: 'mastered', label: 'Mastered', min: 0.95, color: '#4fae74' },
]

export const UNSTUDIED_COLOR = '#5c6670'

export function bandFor(value: number): MasteryBand {
  let band = MASTERY_BANDS[0]!
  for (const candidate of MASTERY_BANDS) if (value >= candidate.min) band = candidate
  return band
}

/** The bone a card belongs to: the bone itself, or the bone a landmark sits on. */
export function boneForCard(cardId: string): string | null {
  const parsed = parseCardId(cardId)
  if (!parsed) return null
  if (parsed.kind === 'bone') return getBone(parsed.id) ? parsed.id : null
  return getLandmark(parsed.id)?.boneId ?? null
}

/**
 * Mastery per bone: the mean recall probability of every reviewed card on that bone (the bone and its landmarks).
 * The heatmap and the dashboard both read this, so they always agree.
 */
export function masteryByBone(
  scheduler: Scheduler,
  cards: ReadonlyMap<string, SrsCard>,
  now: Date,
): Map<string, number> {
  const totals = new Map<string, { sum: number; count: number }>()
  for (const [cardId, card] of cards) {
    const boneId = boneForCard(cardId)
    const value = retrievability(scheduler, card, now)
    if (!boneId || value === null) continue
    const entry = totals.get(boneId) ?? { sum: 0, count: 0 }
    entry.sum += value
    entry.count += 1
    totals.set(boneId, entry)
  }
  const mastery = new Map<string, number>()
  for (const [boneId, entry] of totals) mastery.set(boneId, entry.sum / entry.count)
  return mastery
}

export interface RegionMastery {
  region: string
  label: string
  /** Mean mastery of the studied quiz bones in the region, or null if none are studied. */
  average: number | null
  studied: number
  total: number
}

/** Per-region summary of the same per-bone values the heatmap paints. */
export function masteryByRegion(mastery: ReadonlyMap<string, number>): RegionMastery[] {
  const rows = new Map<string, RegionMastery & { sum: number }>()
  for (const bone of bones) {
    if (!bone.quiz) continue
    const row = rows.get(bone.region) ?? {
      region: bone.region,
      label: REGION_LABEL[bone.region],
      average: null,
      studied: 0,
      total: 0,
      sum: 0,
    }
    row.total += 1
    const value = mastery.get(bone.id)
    if (value !== undefined) {
      row.studied += 1
      row.sum += value
    }
    rows.set(bone.region, row)
  }
  return [...rows.values()].map(({ sum, ...row }) => ({
    ...row,
    average: row.studied > 0 ? sum / row.studied : null,
  }))
}

/** The `count` bones with the lowest mastery, weakest first. Unstudied bones are not included. */
export function weakestBones(mastery: ReadonlyMap<string, number>, count = 8): string[] {
  return [...mastery.entries()]
    .filter(([boneId]) => getBone(boneId)?.quiz)
    .toSorted((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .slice(0, count)
    .map(([boneId]) => boneId)
}
