import type { SkeletonIndex } from '@/components/three/skeletonIndex'
import { getJoint, isPairedJoint, jointsForBone, resolveJointBones } from '@/data/joints'
import { useAnatomyStore } from '@/store/anatomyStore'
import { boundsForBone } from '@/components/three/focus'
import { sectionRemovesPoint } from '@/utils/section'
import { spreadNow } from '@/utils/specimenMotion'
import { spreadOffsetForId } from '@/utils/spread'
import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { Box3, BufferAttribute, BufferGeometry, LineBasicMaterial, Plane, Vector3 } from 'three'

function partnerIds(boneId: string, jointId: string | null, jointSide: 'left' | 'right' | null): string[] {
  if (jointId) {
    const joint = getJoint(jointId)
    if (!joint) return []
    const side = jointSide ?? (isPairedJoint(joint) ? 'left' : 'left')
    return resolveJointBones(joint, side).filter((id) => id !== boneId)
  }
  const side = boneId.endsWith('_right') ? 'right' : 'left'
  const ids = new Set<string>()
  for (const joint of jointsForBone(boneId)) {
    for (const id of resolveJointBones(joint, side)) {
      if (id !== boneId) ids.add(id)
    }
  }
  return [...ids]
}

function centerOf(index: SkeletonIndex, boneId: string, target: Vector3): boolean {
  const box = boundsForBone(index, boneId)
  if (!box) return false
  box.getCenter(target)
  const offset = spreadOffsetForId(boneId, spreadNow())
  target.x += offset[0]
  target.y += offset[1]
  target.z += offset[2]
  return true
}

export function ConnectionLines({ index, bounds }: { index: SkeletonIndex; bounds: Box3 }) {
  const selectedBoneId = useAnatomyStore((state) => state.selectedBoneId)
  const selectedJointId = useAnatomyStore((state) => state.selectedJointId)
  const jointSide = useAnatomyStore((state) => state.jointSide)
  const studyMode = useAnatomyStore((state) => state.studyMode)
  const studyRevealed = useAnatomyStore((state) => state.studyRevealed)
  const sectionAxis = useAnatomyStore((state) => state.sectionAxis)
  const sectionAmount = useAnatomyStore((state) => state.sectionAmount)
  const look = useAnatomyStore((state) => state.look)
  const positions = useMemo(() => new BufferAttribute(new Float32Array(96), 3), [])
  const geometry = useMemo(() => new BufferGeometry().setAttribute('position', positions), [positions])
  const material = useMemo(() => new LineBasicMaterial({ color: '#e7d7c3', transparent: true, opacity: 0.55 }), [])
  const plane = useMemo(() => new Plane(), [])
  const origin = useMemo(() => new Vector3(), [])
  const end = useMemo(() => new Vector3(), [])

  useFrame(() => {
    const hidden = !selectedBoneId || (studyMode && !studyRevealed)
    material.color.set(look === 'radiograph' ? '#d5e4ea' : '#e7d7c3')
    material.opacity = look === 'radiograph' ? 0.4 : 0.55
    if (hidden || !centerOf(index, selectedBoneId, origin)) {
      geometry.setDrawRange(0, 0)
      return
    }
    if (sectionRemovesPoint(origin, bounds, sectionAxis, sectionAmount, plane)) {
      geometry.setDrawRange(0, 0)
      return
    }
    const partners = partnerIds(selectedBoneId, selectedJointId, jointSide)
    let count = 0
    for (const id of partners) {
      if (!centerOf(index, id, end)) continue
      if (sectionRemovesPoint(end, bounds, sectionAxis, sectionAmount, plane)) continue
      const slot = count * 2
      if ((slot + 2) * 3 > positions.array.length) break
      positions.setXYZ(slot, origin.x, origin.y, origin.z)
      positions.setXYZ(slot + 1, end.x, end.y, end.z)
      count += 1
    }
    positions.needsUpdate = true
    geometry.setDrawRange(0, count * 2)
    geometry.computeBoundingSphere()
  })

  return <lineSegments geometry={geometry} material={material} raycast={() => null} />
}
