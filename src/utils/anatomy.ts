import { contralateralId, getBone } from '@/data/bones'
import { getJoint, isPairedJoint, resolveJointBones } from '@/data/joints'
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

export interface SelectionHighlight {
  /** Bone ids drawn with the selected treatment. */
  selectedIds: Set<string>
  /** Joint members, or a bone and its partner, subdue everything else. */
  group: boolean
}

export function selectionHighlight(input: {
  selectedBoneId: string | null
  selectedJointId: string | null
  jointSide: 'left' | 'right' | null
  compareSides: boolean
}): SelectionHighlight {
  if (input.selectedJointId) {
    const joint = getJoint(input.selectedJointId)
    if (joint) {
      const ids = resolveJointBones(joint, input.jointSide ?? (isPairedJoint(joint) ? 'left' : 'left'))
      if (ids.length > 0) return { selectedIds: new Set(ids), group: true }
    }
  }
  const selected = highlightedIds(input.selectedBoneId)
  if (input.compareSides && input.selectedBoneId) {
    const partner = contralateralId(input.selectedBoneId)
    if (partner && getBone(partner)) {
      for (const id of highlightedIds(partner)) selected.add(id)
      return { selectedIds: selected, group: true }
    }
  }
  return { selectedIds: selected, group: false }
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
    /** Joint or compare: non-members use the subdued treatment. */
    group?: boolean
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
  if (options.group) return 'subdued'
  if (options.classification !== 'all') {
    const bone = getBone(boneId)
    return bone?.classification === options.classification ? 'emphasized' : 'subdued'
  }
  if (options.hasSelection) return 'subdued'
  return 'default'
}
