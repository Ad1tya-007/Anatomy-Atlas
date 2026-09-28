import { applyVisual } from '@/components/three/materials'
import type { MeshInstance } from '@/components/three/skeletonIndex'
import { useAnatomyStore } from '@/store/anatomyStore'
import type { BoneVisual } from '@/utils/anatomy'
import { useLayoutEffect, memo } from 'react'
import type { ThreeEvent } from '@react-three/fiber'

let hoverToken = 0

function BoneMeshComponent({ instance, visual }: { instance: MeshInstance; visual: BoneVisual }) {
  useLayoutEffect(() => {
    applyVisual(instance.material, visual)
  }, [instance.material, visual])

  if (visual === 'hidden') return null

  const select = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    if (instance.boneId === '__unmapped__') return
    const store = useAnatomyStore.getState()
    if (store.studyMode && !store.studyRevealed) return
    if (store.studyMode) store.exitStudy()
    store.selectBone(instance.boneId)
  }

  return (
    <mesh
      geometry={instance.geometry}
      material={instance.material}
      renderOrder={visual === 'selected' ? 2 : 0}
      onClick={select}
      onPointerOver={(event) => {
        event.stopPropagation()
        if (instance.boneId === '__unmapped__') return
        hoverToken += 1
        useAnatomyStore.getState().hoverBone(instance.boneId)
      }}
      onPointerOut={() => {
        const token = ++hoverToken
        requestAnimationFrame(() => {
          if (hoverToken === token) useAnatomyStore.getState().hoverBone(null)
        })
      }}
    />
  )
}

export const BoneMesh = memo(BoneMeshComponent)
