import { BoneMesh } from '@/components/three/BoneMesh/BoneMesh'
import { ConnectionLines } from '@/components/three/ConnectionLines/ConnectionLines'
import { BoneLabel, LandmarkLayer } from '@/components/three/LandmarkMarker/LandmarkMarker'
import { buildSkeleton, MODEL_OFFSET_Y, type SkeletonIndex } from '@/components/three/skeletonIndex'
import { useAnatomyStore } from '@/store/anatomyStore'
import { computeFocus, computeGroupFocus } from '@/utils/camera'
import { writeSectionPlane } from '@/utils/section'
import { beginArrival } from '@/utils/specimenMotion'
import { selectionHighlight, visualFor } from '@/utils/anatomy'
import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import { Box3, Plane, type MeshStandardMaterial } from 'three'

const MODEL_URL = '/models/overview-skeleton.glb'

useGLTF.preload(MODEL_URL, '/draco/')

function SelectionFocus({ index }: { index: SkeletonIndex }) {
  const selectedBoneId = useAnatomyStore((state) => state.selectedBoneId)
  const selectedLandmarkId = useAnatomyStore((state) => state.selectedLandmarkId)
  const selectedJointId = useAnatomyStore((state) => state.selectedJointId)
  const jointSide = useAnatomyStore((state) => state.jointSide)
  const compareSides = useAnatomyStore((state) => state.compareSides)
  const spread = useAnatomyStore((state) => state.spread)
  const focusCamera = useAnatomyStore((state) => state.focusCamera)
  const highlight = useMemo(
    () => selectionHighlight({ selectedBoneId, selectedJointId, jointSide, compareSides }),
    [compareSides, jointSide, selectedBoneId, selectedJointId],
  )
  const frameKey = [...highlight.selectedIds].sort().join('|')

  useEffect(() => {
    if (!selectedBoneId) return
    if (highlight.group) {
      const focus = computeGroupFocus(index, [...highlight.selectedIds], selectedBoneId, compareSides ? 1.18 : 1, spread)
      if (focus) focusCamera(focus.position, focus.target)
      return
    }
    const focus = computeFocus(index, selectedBoneId, selectedLandmarkId, spread)
    if (focus) focusCamera(focus.position, focus.target)
  }, [compareSides, focusCamera, frameKey, highlight, index, selectedBoneId, selectedLandmarkId, spread])

  return null
}

export function SkeletonModel() {
  const gltf = useGLTF(MODEL_URL, '/draco/')
  const built = useMemo(() => buildSkeleton(gltf.scene), [gltf.scene])
  const selectedBoneId = useAnatomyStore((state) => state.selectedBoneId)
  const selectedJointId = useAnatomyStore((state) => state.selectedJointId)
  const jointSide = useAnatomyStore((state) => state.jointSide)
  const compareSides = useAnatomyStore((state) => state.compareSides)
  const hoveredBoneId = useAnatomyStore((state) => state.hoveredBoneId)
  const isolated = useAnatomyStore((state) => state.isolated)
  const classification = useAnatomyStore((state) => state.classification)
  const showBones = useAnatomyStore((state) => state.showBones)
  const locatePulseBoneId = useAnatomyStore((state) => state.locatePulseBoneId)
  const studyMode = useAnatomyStore((state) => state.studyMode)
  const studyRevealed = useAnatomyStore((state) => state.studyRevealed)
  const studyAnswerMode = useAnatomyStore((state) => state.studyAnswerMode)
  const studyKind = useAnatomyStore((state) => state.studyKind)
  const studyLandmarkId = useAnatomyStore((state) => state.studyLandmarkId)
  const highlight = useMemo(
    () => selectionHighlight({ selectedBoneId, selectedJointId, jointSide, compareSides }),
    [compareSides, jointSide, selectedBoneId, selectedJointId],
  )

  const bounds = useMemo(() => {
    const box = new Box3()
    for (const part of built.index.bounds.values()) box.union(part)
    return box
  }, [built.index])
  const materials = useMemo(() => built.instances.map((instance) => instance.material), [built.instances])
  const skips = useRef(0)

  useEffect(() => {
    useAnatomyStore.getState().setModelState('ready')
    beginArrival(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    return () => {
      for (const instance of built.instances) instance.material.dispose()
    }
  }, [built])

  useEffect(() => {
    if (!studyMode || studyRevealed || studyAnswerMode !== 'locate' || studyKind !== 'landmark') {
      skips.current = 0
      return
    }
    if (!studyLandmarkId) return
    const exists = built.index.markers.some((marker) => marker.landmarkId === studyLandmarkId)
    if (exists) {
      skips.current = 0
      return
    }
    if (skips.current > 12) return
    skips.current += 1
    useAnatomyStore.getState().nextStudy()
  }, [built.index, studyAnswerMode, studyKind, studyLandmarkId, studyMode, studyRevealed])

  const visuals = {
    showBones,
    highlighted: highlight.selectedIds,
    hoveredBoneId,
    isolated,
    classification,
    hasSelection: selectedBoneId !== null,
    group: highlight.group,
    pulseBoneId: locatePulseBoneId,
  }

  return (
    <>
      <group position={[0, MODEL_OFFSET_Y, 0]}>
        {built.instances.map((instance) => (
          <BoneMesh
            key={instance.key}
            instance={instance}
            visual={visualFor(instance.boneId, visuals)}
          />
        ))}
      </group>
      <SelectionFocus index={built.index} />
      <LandmarkLayer index={built.index} bounds={bounds} />
      <BoneLabel index={built.index} />
      <ConnectionLines index={built.index} bounds={bounds} />
      <SectionClip materials={materials} bounds={bounds} />
    </>
  )
}

function SectionClip({ materials, bounds }: { materials: MeshStandardMaterial[]; bounds: Box3 }) {
  const axis = useAnatomyStore((state) => state.sectionAxis)
  const amount = useAnatomyStore((state) => state.sectionAmount)
  const plane = useMemo(() => new Plane(), [])

  useEffect(() => {
    const on = writeSectionPlane(plane, bounds, axis, amount)
    for (const material of materials) {
      if (on) {
        if (material.clippingPlanes?.[0] !== plane) {
          material.clippingPlanes = [plane]
          material.needsUpdate = true
        }
      } else if (material.clippingPlanes?.length) {
        material.clippingPlanes = []
        material.needsUpdate = true
      }
    }
  }, [amount, axis, bounds, materials, plane])

  return null
}
