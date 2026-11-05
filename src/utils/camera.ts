import { REGION_FOCUS } from '@/data/regions'
import type { CameraPresetName, Vec3 } from '@/types/anatomy'

export const CAMERA_PRESETS: Record<CameraPresetName, { position: Vec3; target: Vec3 }> = {
  default: { position: [0.85, 0.16, 3.35], target: [0, 0.04, 0] },
  front: { position: [0, 0.1, 3.45], target: [0, 0.04, 0] },
  back: { position: [0, 0.1, -3.45], target: [0, 0.04, 0] },
  left: { position: [3.45, 0.1, 0.04], target: [0, 0.04, 0] },
  right: { position: [-3.45, 0.1, 0.04], target: [0, 0.04, 0] },
  top: { position: [0.02, 3.2, 0.55], target: [0, 0.04, 0] },
}

export function regionFocus(regionId: string): { position: Vec3; target: Vec3 } | null {
  return REGION_FOCUS[regionId] ?? null
}
