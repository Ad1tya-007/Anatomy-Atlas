import type { ResolvedMarker, SkeletonIndex } from '@/components/three/skeletonIndex'
import { getBone } from '@/data/bones'
import { getJoint, jointLandmarkIds } from '@/data/joints'
import { getLandmark } from '@/data/landmarks'
import { REGION_LABEL } from '@/data/labels'
import { useAnatomyStore } from '@/store/anatomyStore'
import { selectionHighlight } from '@/utils/anatomy'
import { sectionRemovesPoint } from '@/utils/section'
import { spreadNow } from '@/utils/specimenMotion'
import { spreadOffsetForId } from '@/utils/spread'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { Box3, Plane, Vector3, type Group } from 'three'

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
  const group = useRef<Group>(null)
  const labelPosition = useMemo(() => {
    const normal = new Vector3(...marker.normal)
    return normal.multiplyScalar(0.034).toArray() as [number, number, number]
  }, [marker])

  useFrame(() => {
    const offset = spreadOffsetForId(marker.boneId, spreadNow())
    group.current?.position.set(
      marker.position[0] + offset[0],
      marker.position[1] + offset[1],
      marker.position[2] + offset[2],
    )
  })

  if (!record) return null

  const choose = (event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    const store = useAnatomyStore.getState()
    if (
      store.studyMode &&
      !store.studyRevealed &&
      store.studyAnswerMode === 'locate' &&
      store.studyKind === 'landmark'
    ) {
      store.submitStudyLocate({ landmarkId: marker.landmarkId })
      return
    }
    if (store.studyMode && !store.studyRevealed) return
    store.selectLandmark(marker.landmarkId)
  }

  return (
    <group ref={group}>
      <mesh
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
      <mesh onClick={choose}>
        <sphereGeometry args={[0.02, 10, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {showLabel ? (
        <Html position={labelPosition} center distanceFactor={1.35} zIndexRange={[18, 0]}>
          <button
            type="button"
            onClick={() => {
              const store = useAnatomyStore.getState()
              if (
                store.studyMode &&
                !store.studyRevealed &&
                store.studyAnswerMode === 'locate' &&
                store.studyKind === 'landmark'
              ) {
                store.submitStudyLocate({ landmarkId: marker.landmarkId })
                return
              }
              store.selectLandmark(marker.landmarkId)
            }}
            className={`atlas-placard px-2 py-0.5 text-[11px] leading-4 whitespace-nowrap ${
              active ? 'ring-1 ring-primary' : ''
            }`}
          >
            {record.landmark.name}
          </button>
        </Html>
      ) : null}
    </group>
  )
}

function keptMarker(
  position: [number, number, number],
  bounds: Box3,
  plane: Plane,
  axis: 'off' | 'sagittal' | 'coronal' | 'transverse',
  amount: number,
): boolean {
  if (axis === 'off') return true
  return !sectionRemovesPoint(new Vector3(...position), bounds, axis, amount, plane)
}

export function LandmarkLayer({ index, bounds }: { index: SkeletonIndex; bounds: Box3 }) {
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
  const studyAnswerMode = useAnatomyStore((state) => state.studyAnswerMode)
  const studyLandmarkId = useAnatomyStore((state) => state.studyLandmarkId)
  const locateIds = useAnatomyStore((state) => state.studyLocateLandmarkIds)
  const sectionAxis = useAnatomyStore((state) => state.sectionAxis)
  const sectionAmount = useAnatomyStore((state) => state.sectionAmount)
  const [hoveredLandmarkId, setHoveredLandmarkId] = useState<string | null>(null)
  const plane = useMemo(() => new Plane(), [])

  const visibleMarkers = (markers: ResolvedMarker[]) =>
    markers.filter((marker) => keptMarker(marker.position, bounds, plane, sectionAxis, sectionAmount))

  if (studyMode && !studyRevealed && studyAnswerMode === 'locate') {
    if (studyKind !== 'landmark') return null
    const allowed = new Set(locateIds)
    const markers = visibleMarkers(index.markers.filter((marker) => allowed.has(marker.landmarkId)))
    return (
      <group>
        {markers.map((marker, markerIndex) => (
          <Marker
            key={`${marker.landmarkId}:${markerIndex}`}
            marker={marker}
            active={false}
            showLabel={false}
            onHover={setHoveredLandmarkId}
          />
        ))}
      </group>
    )
  }

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
      {visibleMarkers(visible).map((marker, markerIndex) => {
        const active = marker.landmarkId === selectedLandmarkId || (studyMode && marker.landmarkId === studyLandmarkId)
        return (
          <Marker
            key={`${marker.landmarkId}:${markerIndex}`}
            marker={marker}
            active={active}
            showLabel={
              showLabels && !(studyMode && !studyRevealed) && (active || marker.landmarkId === hoveredLandmarkId)
            }
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
  const studyAnswerMode = useAnatomyStore((state) => state.studyAnswerMode)
  const group = useRef<Group>(null)

  const bone = getBone(selectedBoneId)
  const box = selectedBoneId ? index.bounds.get(selectedBoneId) : undefined
  const base = useMemo(() => {
    if (!box) return null
    const center = box.getCenter(new Vector3())
    return [center.x, box.max.y + 0.07, center.z] as [number, number, number]
  }, [box])

  useFrame(() => {
    if (!group.current || !base || !selectedBoneId) return
    const offset = spreadOffsetForId(selectedBoneId, spreadNow())
    group.current.position.set(base[0] + offset[0], base[1] + offset[1], base[2] + offset[2])
  })

  if (!showLabels || !selectedBoneId || !bone || !base || selectedJointId) return null
  if (studyMode && !studyRevealed && (studyKind === 'bone' || studyAnswerMode === 'locate')) return null

  return (
    <group ref={group}>
      <Html center distanceFactor={1.7} zIndexRange={[12, 0]} wrapperClass="pointer-events-none">
        <div className="pointer-events-none flex w-max flex-col items-center">
          <div className="atlas-placard w-max px-3 py-2 text-center whitespace-nowrap">
            <div className="kicker">{REGION_LABEL[bone.region]}</div>
            <div className="mt-1 font-specimen text-sm leading-none">{bone.name}</div>
          </div>
          <div className="h-2.5 w-px bg-specimen" />
        </div>
      </Html>
    </group>
  )
}
