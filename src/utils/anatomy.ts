import { getBone } from '@/data/bones'
import type { BoneClassification } from '@/types/anatomy'

export type BoneVisual =
  | 'hidden'
  | 'ghost'
  | 'selected'
  | 'hover'
  | 'emphasized'
  | 'subdued'
  | 'default'

export function highlightedIds(selectedBoneId: string | null): Set<string> {
  if (!selectedBoneId) return new Set()
  const bone = getBone(selectedBoneId)
  if (bone?.compositeOf?.length) return new Set(bone.compositeOf)
  return new Set([selectedBoneId])
}

export function visualFor(
  boneId: string,
  options: {
    showBones: boolean
    highlighted: Set<string>
    hoveredBoneId: string | null
    isolated: boolean
    classification: BoneClassification | 'all'
    hasSelection: boolean
  },
): BoneVisual {
  if (!options.showBones) return 'hidden'
  if (boneId === '__unmapped__') {
    if (options.isolated) return 'ghost'
    if (options.hasSelection || options.classification !== 'all') return 'subdued'
    return 'default'
  }
  if (options.highlighted.has(boneId)) return 'selected'
  if (options.hoveredBoneId === boneId) return 'hover'
  if (options.isolated) return 'ghost'
  if (options.classification !== 'all') {
    const bone = getBone(boneId)
    return bone?.classification === options.classification ? 'emphasized' : 'subdued'
  }
  if (options.hasSelection) return 'subdued'
  return 'default'
}
