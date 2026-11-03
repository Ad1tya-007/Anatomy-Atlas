import { getBone } from '@/data/bones'
import { weakestBones } from '@/features/srs/mastery'
import type { Walk } from '@/types/anatomy'

export const WEAKEST_WALK_ID = 'weakest-areas'

function firstSentence(text: string): string {
  const end = text.indexOf('. ')
  return end > 0 ? text.slice(0, end + 1) : text
}

/** A guided walk through the bones with the lowest recall, weakest first. Null until something has been studied. */
export function buildWeakestWalk(mastery: ReadonlyMap<string, number>, count = 8): Walk | null {
  const ids = weakestBones(mastery, count)
  if (ids.length === 0) return null
  return {
    id: WEAKEST_WALK_ID,
    title: 'Your weakest areas',
    summary: `The ${ids.length} bone${ids.length === 1 ? '' : 's'} you are most likely to forget right now.`,
    stops: ids.map((boneId) => {
      const bone = getBone(boneId)!
      const recall = Math.round((mastery.get(boneId) ?? 0) * 100)
      return { boneId, text: `${recall}% estimated recall. ${firstSentence(bone.description)}` }
    }),
  }
}
