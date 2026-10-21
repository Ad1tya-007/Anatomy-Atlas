import { getBone } from '@/data/bones'
import type { AnatomicalRegion, Bone, Vec3 } from '@/types/anatomy'

/** Lateral magnitude, then Y, then Z, at spread = 1. Lateral is +X on the skeleton’s left. */
const REGION_OFFSET: Record<AnatomicalRegion, readonly [number, number, number]> = {
  head: [0, 0.22, 0],
  'vertebral-column': [0, 0.06, 0.04],
  thorax: [0, 0, 0],
  'shoulder-girdle': [0.12, 0, 0],
  'upper-limb': [0.24, -0.04, 0],
  pelvis: [0, -0.08, 0],
  'lower-limb': [0.16, -0.18, 0],
}

export function spreadOffset(bone: Bone, amount: number): Vec3 {
  const t = Math.min(1, Math.max(0, amount))
  if (t === 0) return [0, 0, 0]
  const [lateral, y, z] = REGION_OFFSET[bone.region]
  const sign = bone.side === 'left' ? 1 : bone.side === 'right' ? -1 : 0
  return [lateral * sign * t, y * t, z * t]
}

export function spreadOffsetForId(boneId: string, amount: number): Vec3 {
  if (amount === 0) return [0, 0, 0]
  const bone = getBone(boneId)
  if (!bone) return [0, 0, 0]
  return spreadOffset(bone, amount)
}
