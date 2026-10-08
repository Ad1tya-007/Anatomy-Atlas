import { BoneMesh } from '@/components/three/BoneMesh/BoneMesh'
import { BoneLabel, LandmarkLayer } from '@/components/three/LandmarkMarker/LandmarkMarker'
import { buildSkeleton, MODEL_OFFSET_Y, type SkeletonIndex } from '@/components/three/skeletonIndex'
import { useAnatomyStore } from '@/store/anatomyStore'
import { computeFocus, computeGroupFocus } from '@/utils/camera'
import { selectionHighlight, visualFor } from '@/utils/anatomy'
import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'

const MODEL_URL = '/models/overview-skeleton.glb'

useGLTF.preload(MODEL_URL, '/draco/')

function SelectionFocus({ index }: { index: SkeletonIndex }) {
  const selectedBoneId = useAnatomyStore((state) => state.selectedBoneId)
  const selectedLandmarkId = useAnatomyStore((state) => state.selectedLandmarkId)
  const selectedJointId = useAnatomyStore((state) => state.selectedJointId)
  const jointSide = useAnatomyStore((state) => state.jointSide)
  const compareSides = useAnatomyStore((state) => state.compareSides)
  const focusCamera = useAnatomyStore((state) => state.focusCamera)
  const highlight = useMemo(
    () => selectionHighlight({ selectedBoneId, selectedJointId, jointSide, compareSides }),
    [compareSides, jointSide, selectedBoneId, selectedJointId],
  )
  const frameKey = [...highlight.selectedIds].sort().join('|')

  useEffect(() => {
    if (!selectedBoneId) return
    if (highlight.group) {
      const focus = computeGroupFocus(index, [...highlight.selectedIds], selectedBoneId, compareSides ? 1.18 : 1)
      if (focus) focusCamera(focus.position, focus.target)
      return
    }
    const focus = computeFocus(index, selectedBoneId, selectedLandmarkId)
    if (focus) focusCamera(focus.position, focus.target)
  }, [compareSides, focusCamera, frameKey, highlight, index, selectedBoneId, selectedLandmarkId])

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
  const highlight = useMemo(
    () => selectionHighlight({ selectedBoneId, selectedJointId, jointSide, compareSides }),
    [compareSides, jointSide, selectedBoneId, selectedJointId],
  )

  useEffect(() => {
    useAnatomyStore.getState().setModelState('ready')
    return () => {
      for (const instance of built.instances) instance.material.dispose()
    }
  }, [built])

  const visuals = {
    showBones,
    highlighted: highlight.selectedIds,
    hoveredBoneId,
    isolated,
    classification,
    hasSelection: selectedBoneId !== null,
    group: highlight.group,
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
      <LandmarkLayer index={built.index} />
      <BoneLabel index={built.index} />
    </>
  )
}
