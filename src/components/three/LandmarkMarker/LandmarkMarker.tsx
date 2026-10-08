import type { ResolvedMarker, SkeletonIndex } from '@/components/three/skeletonIndex'
import { getBone } from '@/data/bones'
import { getJoint, jointLandmarkIds } from '@/data/joints'
import { getLandmark } from '@/data/landmarks'
import { useAnatomyStore } from '@/store/anatomyStore'
import { selectionHighlight } from '@/utils/anatomy'
import { Html } from '@react-three/drei'
import { useMemo, useState } from 'react'
import { Vector3 } from 'three'

function Marker({
  marker,
  active,
  showLabel,
  onHover,
}: {
  marker: ResolvedMarker
  active: boolean
  showLabel: boolean
  onHover: (landmarkId: string | null) => void
}) {
  const record = getLandmark(marker.landmarkId)
  const labelPosition = useMemo(() => {
    const normal = new Vector3(...marker.normal)
    return new Vector3(...marker.position).add(normal.multiplyScalar(0.034)).toArray() as [
      number,
      number,
      number,
    ]
  }, [marker])

  if (!record) return null

  const choose = (event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    const store = useAnatomyStore.getState()
    if (store.studyMode && !store.studyRevealed) return
    store.selectLandmark(marker.landmarkId)
  }

  return (
    <group>
      <mesh
        position={marker.position}
        onClick={choose}
        onPointerOver={(event) => {
          event.stopPropagation()
          onHover(marker.landmarkId)
        }}
        onPointerOut={() => onHover(null)}
      >
        <sphereGeometry args={[active ? 0.011 : 0.0075, 16, 16]} />
        <meshStandardMaterial
          color={active ? '#8fb8b2' : '#f3f6f7'}
          emissive={active ? '#2d4a46' : '#000000'}
          emissiveIntensity={active ? 0.45 : 0}
          roughness={0.35}
        />
      </mesh>
      <mesh position={marker.position} onClick={choose}>
        <sphereGeometry args={[0.02, 10, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {showLabel ? (
        <Html position={labelPosition} center distanceFactor={1.35} zIndexRange={[18, 0]}>
          <button
            type="button"
            onClick={() => useAnatomyStore.getState().selectLandmark(marker.landmarkId)}
            className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] leading-4 ${
              active ? 'border-accent bg-panel text-accent' : 'border-line bg-panel/95 text-text'
            }`}
          >
            {record.landmark.name}
          </button>
        </Html>
      ) : null}
    </group>
  )
}

export function LandmarkLayer({ index }: { index: SkeletonIndex }) {
  const selectedBoneId = useAnatomyStore((state) => state.selectedBoneId)
  const selectedLandmarkId = useAnatomyStore((state) => state.selectedLandmarkId)
  const selectedJointId = useAnatomyStore((state) => state.selectedJointId)
  const jointSide = useAnatomyStore((state) => state.jointSide)
  const compareSides = useAnatomyStore((state) => state.compareSides)
  const showLandmarks = useAnatomyStore((state) => state.showLandmarks)
  const showLabels = useAnatomyStore((state) => state.showLabels)
  const studyMode = useAnatomyStore((state) => state.studyMode)
  const studyRevealed = useAnatomyStore((state) => state.studyRevealed)
  const studyKind = useAnatomyStore((state) => state.studyKind)
  const studyLandmarkId = useAnatomyStore((state) => state.studyLandmarkId)
  const [hoveredLandmarkId, setHoveredLandmarkId] = useState<string | null>(null)

  if (!showLandmarks || !selectedBoneId) return null
  if (studyMode && !studyRevealed && studyKind === 'bone') return null

  const highlight = selectionHighlight({ selectedBoneId, selectedJointId, jointSide, compareSides })
  const joint = getJoint(selectedJointId)
  const allowed = joint ? new Set(jointLandmarkIds(joint, jointSide ?? 'left')) : null
  let markers = index.markers.filter((marker) => highlight.selectedIds.has(marker.boneId))
  if (allowed) markers = markers.filter((marker) => allowed.has(marker.landmarkId))
  else if (compareSides && selectedBoneId) markers = markers.filter((marker) => marker.boneId === selectedBoneId)
  const visible =
    studyMode && !studyRevealed && studyKind === 'landmark'
      ? markers.filter((marker) => marker.landmarkId === studyLandmarkId)
      : markers

  return (
    <group>
      {visible.map((marker, markerIndex) => {
        const active =
          marker.landmarkId === selectedLandmarkId || (studyMode && marker.landmarkId === studyLandmarkId)
        return (
          <Marker
            key={`${marker.landmarkId}:${markerIndex}`}
            marker={marker}
            active={active}
            showLabel={showLabels && !(studyMode && !studyRevealed) && (active || marker.landmarkId === hoveredLandmarkId)}
            onHover={setHoveredLandmarkId}
          />
        )
      })}
    </group>
  )
}

export function BoneLabel({ index }: { index: SkeletonIndex }) {
  const selectedBoneId = useAnatomyStore((state) => state.selectedBoneId)
  const selectedJointId = useAnatomyStore((state) => state.selectedJointId)
  const showLabels = useAnatomyStore((state) => state.showLabels)
  const studyMode = useAnatomyStore((state) => state.studyMode)
  const studyRevealed = useAnatomyStore((state) => state.studyRevealed)
  const studyKind = useAnatomyStore((state) => state.studyKind)

  if (!showLabels || !selectedBoneId || selectedJointId) return null
  if (studyMode && !studyRevealed && studyKind === 'bone') return null

  const bone = getBone(selectedBoneId)
  const box = index.bounds.get(selectedBoneId)
  if (!bone || !box) return null
  const center = box.getCenter(new Vector3())

  return (
    <Html
      position={[center.x, box.max.y + 0.07, center.z]}
      center
      distanceFactor={1.7}
      zIndexRange={[12, 0]}
      wrapperClass="pointer-events-none"
    >
      <div className="whitespace-nowrap rounded-full border border-line bg-panel/92 px-2.5 py-1 text-[12px] text-text">
        {bone.displayName}
      </div>
    </Html>
  )
}
