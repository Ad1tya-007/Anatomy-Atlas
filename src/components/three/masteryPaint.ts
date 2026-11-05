import { bandFor, UNSTUDIED_COLOR } from '@/features/srs/mastery'
import { Color } from 'three'

const unstudied = new Color(UNSTUDIED_COLOR)
const bandColors = new Map<string, Color>()
const byBone = new Map<string, Color>()

function colorFor(value: number): Color {
  const band = bandFor(value)
  let color = bandColors.get(band.id)
  if (!color) {
    color = new Color(band.color)
    bandColors.set(band.id, color)
  }
  return color
}

/** Replaces the per-bone mastery colors. Bones without a value render as unstudied. */
export function setMasteryValues(values: ReadonlyMap<string, number>): void {
  byBone.clear()
  for (const [boneId, value] of values) byBone.set(boneId, colorFor(value))
}

export function masteryColorFor(boneId: string | undefined): Color {
  return (boneId && byBone.get(boneId)) || unstudied
}
