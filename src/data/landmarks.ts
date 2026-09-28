import { bones } from './bones'
import type { Landmark } from '@/types/anatomy'

export interface LandmarkRecord {
  landmark: Landmark
  boneId: string
  boneName: string
  displayName: string
}

export const allLandmarks: LandmarkRecord[] = bones.flatMap((bone) =>
  bone.landmarks.map((landmark) => ({
    landmark,
    boneId: bone.id,
    boneName: bone.name,
    displayName: bone.displayName,
  })),
)

export function getLandmark(id: string | null | undefined): LandmarkRecord | undefined {
  if (!id) return undefined
  return allLandmarks.find((record) => record.landmark.id === id)
}
