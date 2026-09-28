import { BoneMesh } from '@/components/three/BoneMesh/BoneMesh'
import { BoneLabel, LandmarkLayer } from '@/components/three/LandmarkMarker/LandmarkMarker'
import { buildSkeleton, MODEL_OFFSET_Y, type SkeletonIndex } from '@/components/three/skeletonIndex'
import { useAnatomyStore } from '@/store/anatomyStore'
import { computeFocus } from '@/utils/camera'
import { highlightedIds, visualFor } from '@/utils/anatomy'
import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'

const MODEL_URL = '/models/overview-skeleton.glb'

useGLTF.preload(MODEL_URL, '/draco/')

function SelectionFocus({ index }: { index: SkeletonIndex }) {
  const selectedBoneId = useAnatomyStore((state) => state.selectedBoneId)
  const selectedLandmarkId = useAnatomyStore((state) => state.selectedLandmarkId)
  const focusCamera = useAnatomyStore((state) => state.focusCamera)

  useEffect(() => {
    if (!selectedBoneId) return
    const focus = computeFocus(index, selectedBoneId, selectedLandmarkId)
    if (focus) focusCamera(focus.position, focus.target)
  }, [focusCamera, index, selectedBoneId, selectedLandmarkId])

  return null
}

export function SkeletonModel() {
  const gltf = useGLTF(MODEL_URL, '/draco/')
  const built = useMemo(() => buildSkeleton(gltf.scene), [gltf.scene])
  const selectedBoneId = useAnatomyStore((state) => state.selectedBoneId)
  const hoveredBoneId = useAnatomyStore((state) => state.hoveredBoneId)
  const isolated = useAnatomyStore((state) => state.isolated)
  const classification = useAnatomyStore((state) => state.classification)
  const showBones = useAnatomyStore((state) => state.showBones)
  const highlighted = useMemo(() => highlightedIds(selectedBoneId), [selectedBoneId])

  useEffect(() => {
    useAnatomyStore.getState().setModelState('ready')
    return () => {
      for (const instance of built.instances) instance.material.dispose()
    }
  }, [built])

  const visuals = {
    showBones,
    highlighted,
    hoveredBoneId,
    isolated,
    classification,
    hasSelection: selectedBoneId !== null,
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
