import { CameraController } from '@/components/three/CameraController/CameraController'
import { OrientationIndicator } from '@/components/three/OrientationIndicator/OrientationIndicator'
import { SkeletonModel } from '@/components/three/SkeletonModel/SkeletonModel'
import { ContactShadows } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'

function SceneContents() {
  return (
    <>
      <color attach="background" args={['#0B0D10']} />
      <fog attach="fog" args={['#0B0D10', 6.5, 14]} />
      <hemisphereLight args={['#d7e0e8', '#2a241f', 0.72]} />
      <ambientLight intensity={0.22} />
      <directionalLight position={[3.4, 5.8, 4.2]} intensity={1.65} color="#fff7ef" />
      <directionalLight position={[-4.2, 2.4, -2]} intensity={0.42} color="#b9c8d6" />
      <directionalLight position={[0.4, 1.8, -4.6]} intensity={0.55} color="#f0e2d2" />
      <Suspense fallback={null}>
        <SkeletonModel />
      </Suspense>
      <ContactShadows
        position={[0, -0.86, 0]}
        opacity={0.48}
        scale={7}
        blur={2.3}
        far={1.7}
        resolution={512}
        color="#000000"
      />
      <CameraController />
      <OrientationIndicator />
    </>
  )
}

export function AnatomyScene() {
  return (
    <Canvas
      className="h-full w-full touch-none"
      dpr={[1, 1.75]}
      camera={{ position: [0.85, 0.16, 3.35], fov: 32, near: 0.02, far: 40 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
    >
      <SceneContents />
    </Canvas>
  )
}
