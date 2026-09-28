import { GizmoHelper, Text } from '@react-three/drei'

const LABELS: Array<{ text: string; position: [number, number, number]; color: string }> = [
  { text: 'S', position: [0, 0.78, 0], color: '#f2f4f7' },
  { text: 'I', position: [0, -0.78, 0], color: '#f2f4f7' },
  { text: 'A', position: [0, 0, 0.78], color: '#8fb8b2' },
  { text: 'P', position: [0, 0, -0.78], color: '#8fb8b2' },
  { text: 'L', position: [0.78, 0, 0], color: '#f2f4f7' },
  { text: 'R', position: [-0.78, 0, 0], color: '#f2f4f7' },
]

const ignoreRaycast = () => {
  /* The gizmo is a legend, not a pick target. */
}

export function OrientationIndicator() {
  return (
    <GizmoHelper alignment="bottom-left" margin={[76, 92]}>
      <group>
        <mesh raycast={ignoreRaycast}>
          <cylinderGeometry args={[0.018, 0.018, 1.2, 8]} />
          <meshBasicMaterial color="#8d97a1" />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]} raycast={ignoreRaycast}>
          <cylinderGeometry args={[0.018, 0.018, 1.2, 8]} />
          <meshBasicMaterial color="#8d97a1" />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} raycast={ignoreRaycast}>
          <cylinderGeometry args={[0.018, 0.018, 1.2, 8]} />
          <meshBasicMaterial color="#8fb8b2" />
        </mesh>
        {LABELS.map((label) => (
          <Text
            key={label.text}
            position={label.position}
            fontSize={0.26}
            color={label.color}
            anchorX="center"
            anchorY="middle"
            raycast={ignoreRaycast}
          >
            {label.text}
          </Text>
        ))}
      </group>
    </GizmoHelper>
  )
}
