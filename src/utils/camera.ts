import { getBone } from '@/data/bones'
import { REGION_FOCUS } from '@/data/regions'
import type { CameraPresetName, Vec3 } from '@/types/anatomy'
import * as THREE from 'three'
import type { SkeletonIndex } from '@/components/three/skeletonIndex'

export const CAMERA_PRESETS: Record<CameraPresetName, { position: Vec3; target: Vec3 }> = {
  default: { position: [0.85, 0.16, 3.35], target: [0, 0.04, 0] },
  front: { position: [0, 0.1, 3.45], target: [0, 0.04, 0] },
  back: { position: [0, 0.1, -3.45], target: [0, 0.04, 0] },
  left: { position: [3.45, 0.1, 0.04], target: [0, 0.04, 0] },
  right: { position: [-3.45, 0.1, 0.04], target: [0, 0.04, 0] },
  top: { position: [0.02, 3.2, 0.55], target: [0, 0.04, 0] },
}

const POSTERIOR = ['scapula', 'occipital', 'sacrum', 'coccyx']

function viewDirection(boneId: string): THREE.Vector3 {
  const side = boneId.endsWith('_left') ? 1 : boneId.endsWith('_right') ? -1 : 0.28
  const posterior = POSTERIOR.some((name) => boneId.includes(name))
  if (posterior) return new THREE.Vector3(side * 0.42, 0.2, -1).normalize()
  return new THREE.Vector3(side * 0.62, 0.26, 1).normalize()
}

export function boundsForBone(index: SkeletonIndex, boneId: string): THREE.Box3 | null {
  const direct = index.bounds.get(boneId)
  if (direct) return direct
  const bone = getBone(boneId)
  if (!bone?.compositeOf?.length) return null
  const box = new THREE.Box3()
  let found = false
  for (const id of bone.compositeOf) {
    const part = index.bounds.get(id)
    if (!part) continue
    box.union(part)
    found = true
  }
  return found ? box : null
}

export function computeGroupFocus(
  index: SkeletonIndex,
  boneIds: string[],
  primaryId: string,
  margin = 1,
): { position: Vec3; target: Vec3 } | null {
  const box = new THREE.Box3()
  let found = false
  for (const id of boneIds) {
    const part = boundsForBone(index, id)
    if (!part) continue
    box.union(part)
    found = true
  }
  if (!found) return null
  const size = box.getSize(new THREE.Vector3())
  const radius = Math.max(size.x, size.y, size.z)
  const distance = THREE.MathUtils.clamp((radius * 2.5 + 0.12) * margin, 0.32, 4.6)
  const target = box.getCenter(new THREE.Vector3())
  const position = target.clone().add(viewDirection(primaryId).multiplyScalar(distance))
  return {
    position: position.toArray() as Vec3,
    target: target.toArray() as Vec3,
  }
}

export function computeFocus(
  index: SkeletonIndex,
  boneId: string,
  landmarkId: string | null,
): { position: Vec3; target: Vec3 } | null {
  const box = boundsForBone(index, boneId)
  if (!box) return null
  const size = box.getSize(new THREE.Vector3())
  const radius = Math.max(size.x, size.y, size.z)
  let distance = THREE.MathUtils.clamp(radius * 2.35 + 0.08, 0.26, 2.8)
  let target = box.getCenter(new THREE.Vector3())

  if (landmarkId) {
    const marker = index.markers.find((item) => item.landmarkId === landmarkId)
    if (marker) {
      target = new THREE.Vector3(...marker.position)
      distance = THREE.MathUtils.clamp(distance * 0.58, 0.2, 1.4)
    }
  }

  const position = target.clone().add(viewDirection(boneId).multiplyScalar(distance))
  return {
    position: position.toArray() as Vec3,
    target: target.toArray() as Vec3,
  }
}

export function regionFocus(regionId: string): { position: Vec3; target: Vec3 } | null {
  return REGION_FOCUS[regionId] ?? null
}
