import { axialBones } from './content/axial'
import { headBones } from './content/head'
import { lowerBones } from './content/lower'
import { upperBones } from './content/upper'
import type { Bone } from '@/types/anatomy'

export const bones: Bone[] = [...headBones, ...axialBones, ...upperBones, ...lowerBones]

const byId = new Map(bones.map((bone) => [bone.id, bone]))

export function getBone(id: string | null | undefined): Bone | undefined {
  if (!id) return undefined
  return byId.get(id)
}

export function contralateralId(id: string): string | null {
  if (id.endsWith('_left')) return `${id.slice(0, -5)}_right`
  if (id.endsWith('_right')) return `${id.slice(0, -6)}_left`
  return null
}

export function quizBones(): Bone[] {
  return bones.filter((bone) => bone.quiz)
}
