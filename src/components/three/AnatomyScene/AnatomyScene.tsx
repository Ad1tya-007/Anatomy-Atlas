import { CameraController } from '@/components/three/CameraController/CameraController'
import { MasteryPaint } from '@/components/three/MasteryPaint/MasteryPaint'
import { OrientationIndicator } from '@/components/three/OrientationIndicator/OrientationIndicator'
import { SkeletonModel } from '@/components/three/SkeletonModel/SkeletonModel'
import { useAnatomyStore, type AnatomyState } from '@/store/anatomyStore'
import { createDprMonitor, DPR_STEPS, maxDprStep, sampleFrame } from '@/utils/adaptiveDpr'
import { lookPaint, motionActive, noteLook, tickArrival, tickLook } from '@/utils/specimenMotion'
import type { LookName } from '@/types/anatomy'
import { ContactShadows } from '@react-three/drei'
import { useFrame, useThree, type RootState } from '@react-three/fiber'
import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useRef, useState } from 'react'
import { AmbientLight, Color, DirectionalLight, Fog, HemisphereLight, Quaternion, Vector3 } from 'three'

const LOOK_LIGHTS: Record<
  LookName,
  {
    background: string
    hemisphere: [string, string, number]
    ambient: number
    key: [string, number]
    fill: [string, number]
    back: [string, number]
    rim: [string, number]
  }
> = {
  atlas: {
    background: '#0B0D10',
    hemisphere: ['#d7e0e8', '#2a241f', 0.72],
    ambient: 0.22,
    key: ['#fff7ef', 1.65],
    fill: ['#b9c8d6', 0.42],
    back: ['#f0e2d2', 0.55],
    rim: ['#d5e4ea', 0.35],
  },
  ivory: {
    background: '#141210',
    hemisphere: ['#f0e6d8', '#3a3228', 0.85],
    ambient: 0.28,
    key: ['#fff5ea', 1.95],
    fill: ['#e7d7c3', 0.35],
    back: ['#f3eadf', 0.4],
    rim: ['#f0e6d8', 0.4],
  },
  radiograph: {
    background: '#07080a',
    hemisphere: ['#1a2226', '#050607', 0.15],
    ambient: 0.04,
    key: ['#9eb0b8', 0.22],
    fill: ['#6a7a82', 0.08],
    back: ['#8aa0a8', 0.12],
    rim: ['#d5e4ea', 0.55],
  },
  // Neutral white light so the mastery colors read true.
  mastery: {
    background: '#0d1013',
    hemisphere: ['#ffffff', '#30353a', 0.9],
    ambient: 0.32,
    key: ['#ffffff', 1.45],
    fill: ['#e4e9ee', 0.45],
    back: ['#ffffff', 0.35],
    rim: ['#ffffff', 0.3],
  },
}

const rimDirection = new Vector3()
const cameraTilt = new Quaternion()

function mix(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

function SpecimenLights() {
  const look = useAnatomyStore((state) => state.look)
  const hemi = useRef<HemisphereLight>(null)
  const ambient = useRef<AmbientLight>(null)
  const key = useRef<DirectionalLight>(null)
  const fill = useRef<DirectionalLight>(null)
  const back = useRef<DirectionalLight>(null)
  const rim = useRef<DirectionalLight>(null)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const background = useRef(new Color('#0B0D10'))
  const fromColor = useRef(new Color())
  const toColor = useRef(new Color())

  useEffect(() => {
    noteLook(look, window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [look])

  useFrame((state) => {
    const now = performance.now()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    tickLook(now, reduced)
    tickArrival(now, useAnatomyStore.getState().spread)
    const sample = lookPaint()
    const from = LOOK_LIGHTS[sample.from]
    const to = LOOK_LIGHTS[sample.look]
    const t = sample.blend
    if (hemi.current) {
      hemi.current.color.copy(fromColor.current.set(from.hemisphere[0])).lerp(toColor.current.set(to.hemisphere[0]), t)
      hemi.current.groundColor.set(from.hemisphere[1]).lerp(new Color(to.hemisphere[1]), t)
      hemi.current.intensity = mix(from.hemisphere[2], to.hemisphere[2], t)
    }
    if (ambient.current) ambient.current.intensity = mix(from.ambient, to.ambient, t)
    if (key.current) {
      key.current.color.set(from.key[0]).lerp(new Color(to.key[0]), t)
      key.current.intensity = mix(from.key[1], to.key[1], t)
    }
    if (fill.current) {
      fill.current.color.set(from.fill[0]).lerp(new Color(to.fill[0]), t)
      fill.current.intensity = mix(from.fill[1], to.fill[1], t)
    }
    if (back.current) {
      back.current.color.set(from.back[0]).lerp(new Color(to.back[0]), t)
      back.current.intensity = mix(from.back[1], to.back[1], t)
    }
    if (rim.current) {
      rim.current.color.set(from.rim[0]).lerp(new Color(to.rim[0]), t)
      rim.current.intensity = mix(from.rim[1], to.rim[1], t)
      cameraTilt.copy(camera.quaternion)
      rimDirection.set(-0.85, 0.95, 0.45).applyQuaternion(cameraTilt).normalize().multiplyScalar(4)
      rim.current.position.copy(rimDirection)
    }
    background.current.set(from.background).lerp(new Color(to.background), t)
    if (scene.background instanceof Color) scene.background.copy(background.current)
    if (scene.fog instanceof Fog) scene.fog.color.copy(background.current)
    if (motionActive()) state.invalidate()
  })

  return (
    <>
      <hemisphereLight ref={hemi} args={['#d7e0e8', '#2a241f', 0.72]} />
      <ambientLight ref={ambient} intensity={0.22} />
      <directionalLight ref={key} position={[3.4, 5.8, 4.2]} intensity={1.65} color="#fff7ef" />
      <directionalLight ref={fill} position={[-4.2, 2.4, -2]} intensity={0.42} color="#b9c8d6" />
      <directionalLight ref={back} position={[0.4, 1.8, -4.6]} intensity={0.55} color="#f0e2d2" />
      <directionalLight ref={rim} position={[-2.2, 3.2, 2.4]} intensity={0.35} color="#d5e4ea" />
    </>
  )
}

function shadowSignature(state: AnatomyState): string {
  return [
    state.spread,
    state.showBones,
    state.isolated,
    state.selectedBoneId,
    state.selectedJointId,
    state.compareSides,
    state.modelState,
  ].join('|')
}

/** With frameloop="demand", any store change may change the picture, so it schedules a frame. */
function StoreFrames() {
  const invalidate = useThree((state) => state.invalidate)
  useEffect(() => useAnatomyStore.subscribe(() => invalidate()), [invalidate])
  return null
}

/**
 * The contact shadow re-renders the whole skeleton into a depth target, doubling draw calls. Bones only move with
 * spread, visibility, or the arrival animation, so it renders once after those change; drei resets its frame count on
 * every render of the component.
 */
function GroundShadow() {
  useAnatomyStore(shadowSignature)
  const [moving, setMoving] = useState(true)
  const movingRef = useRef(true)

  useFrame(() => {
    const active = motionActive()
    if (active === movingRef.current) return
    movingRef.current = active
    setMoving(active)
  })

  return (
    <ContactShadows
      position={[0, -0.86, 0]}
      opacity={0.48}
      scale={7}
      blur={2.3}
      far={1.7}
      resolution={512}
      color="#000000"
      frames={moving ? Infinity : 1}
    />
  )
}

function AdaptiveResolution() {
  const setDpr = useThree((state) => state.setDpr)
  const monitor = useRef(createDprMonitor(window.devicePixelRatio))
  const maxStep = useRef(maxDprStep(window.devicePixelRatio))

  useFrame((_, delta) => {
    const next = sampleFrame(monitor.current, delta * 1000, maxStep.current)
    if (next !== null) setDpr(Math.min(window.devicePixelRatio, DPR_STEPS[next]))
  })

  return null
}

function SceneContents() {
  return (
    <>
      <color attach="background" args={['#0B0D10']} />
      <fog attach="fog" args={['#0B0D10', 6.5, 14]} />
      <StoreFrames />
      <AdaptiveResolution />
      <SpecimenLights />
      <MasteryPaint />
      <Suspense fallback={null}>
        <SkeletonModel />
      </Suspense>
      <GroundShadow />
      <CameraController />
      <OrientationIndicator />
    </>
  )
}

function enableClipping(state: RootState) {
  state.gl.localClippingEnabled = true
}

export function AnatomyScene() {
  return (
    <Canvas
      className="h-full w-full touch-none"
      frameloop="demand"
      dpr={[1, 1.75]}
      camera={{ position: [0.85, 0.16, 3.35], fov: 32, near: 0.02, far: 40 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      onCreated={enableClipping}
    >
      <SceneContents />
    </Canvas>
  )
}
