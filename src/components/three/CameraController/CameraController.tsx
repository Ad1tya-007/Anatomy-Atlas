import { useAnatomyStore } from '@/store/anatomyStore'
import type { Vec3 } from '@/types/anatomy'
import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { Vector3, type OrthographicCamera, type PerspectiveCamera } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

const HOME_POSITION = new Vector3(0.85, 0.16, 3.35)
const HOME_TARGET = new Vector3(0, 0.04, 0)
const SETTLE_MS = 250
const MOVE_EPSILON = 1e-4

export function CameraController() {
  const camera = useThree((state) => state.camera)
  const request = useAnatomyStore((state) => state.cameraRequest)
  const controls = useRef<OrbitControlsImpl>(null)
  const goalPosition = useRef(HOME_POSITION.clone())
  const goalTarget = useRef(HOME_TARGET.clone())
  const animating = useRef(false)
  const lastPosition = useRef(new Vector3())
  const lastTarget = useRef(new Vector3())
  const movedAt = useRef<number | null>(null)

  useLayoutEffect(() => {
    camera.position.copy(HOME_POSITION)
    camera.lookAt(HOME_TARGET)
    camera.updateProjectionMatrix()
    const orbit = controls.current
    if (!orbit) return
    orbit.target.copy(HOME_TARGET)
    orbit.update()
  }, [camera])

  useEffect(() => {
    if (request.id === 0) return
    if (request.position && request.target) {
      goalPosition.current.set(...request.position)
      goalTarget.current.set(...request.target)
      animating.current = true
    }
  }, [request])

  useFrame((state, delta) => {
    const orbit = controls.current
    if (!orbit || !animating.current) return
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const alpha = 1 - Math.exp(-delta * (reduce ? 26 : 4.4))
    const perspective = state.camera as PerspectiveCamera | OrthographicCamera
    perspective.position.lerp(goalPosition.current, alpha)
    orbit.target.lerp(goalTarget.current, alpha)
    orbit.update()
    if (
      perspective.position.distanceTo(goalPosition.current) < 0.01 &&
      orbit.target.distanceTo(goalTarget.current) < 0.01
    ) {
      perspective.position.copy(goalPosition.current)
      orbit.target.copy(goalTarget.current)
      animating.current = false
      orbit.update()
    }
  }, 1)

  useFrame((state) => {
    const orbit = controls.current
    if (!orbit) return
    const { camera: view } = state
    const now = performance.now()
    const moved =
      view.position.distanceToSquared(lastPosition.current) > MOVE_EPSILON ** 2 ||
      orbit.target.distanceToSquared(lastTarget.current) > MOVE_EPSILON ** 2
    if (moved) {
      lastPosition.current.copy(view.position)
      lastTarget.current.copy(orbit.target)
      movedAt.current = now
      return
    }
    if (movedAt.current === null || now - movedAt.current < SETTLE_MS) return
    movedAt.current = null
    useAnatomyStore.getState().setCameraPose({
      position: view.position.toArray() as Vec3,
      target: orbit.target.toArray() as Vec3,
    })
  }, 2)

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={0.16}
      maxDistance={8}
      maxPolarAngle={Math.PI - 0.05}
      target={[0, 0.04, 0]}
      onStart={() => {
        animating.current = false
      }}
    />
  )
}
