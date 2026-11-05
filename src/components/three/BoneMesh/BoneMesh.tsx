import { applyVisual } from '@/components/three/materials'
import type { MeshInstance } from '@/components/three/skeletonIndex'
import { useAnatomyStore } from '@/store/anatomyStore'
import type { BoneVisual } from '@/utils/anatomy'
import { spreadNow } from '@/utils/specimenMotion'
import { spreadOffsetForId } from '@/utils/spread'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useLayoutEffect, useRef, memo } from 'react'
import type { Mesh } from 'three'

let hoverToken = 0

function BoneMeshComponent({ instance, visual }: { instance: MeshInstance; visual: BoneVisual }) {
  const ref = useRef<Mesh>(null)

  const place = () => {
    applyVisual(instance.material, visual, instance.boneId)
    const offset = spreadOffsetForId(instance.boneId, spreadNow())
    ref.current?.position.set(offset[0], offset[1], offset[2])
  }

  useLayoutEffect(() => {
    place()
  })

  useFrame(() => {
    place()
  })

  if (visual === 'hidden') return null

  const select = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    if (instance.boneId === '__unmapped__') return
    const store = useAnatomyStore.getState()
    if (store.studyMode && !store.studyRevealed && store.studyAnswerMode === 'locate' && store.studyKind === 'bone') {
      store.submitStudyLocate({ boneId: instance.boneId })
      return
    }
    if (store.studyMode && !store.studyRevealed) return
    if (store.studyMode) store.exitStudy()
    store.selectBone(instance.boneId)
  }

  return (
    <mesh
      ref={ref}
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
