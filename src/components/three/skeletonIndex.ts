import { bones } from '@/data/bones'
import { meshKey, resolveBoneId } from '@/data/meshMap'
import type { AnchorFrame, Landmark, Side } from '@/types/anatomy'
import type { Bone } from '@/types/anatomy'
import {
  Box3,
  BufferGeometry,
  DoubleSide,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type Material,
  type Object3D,
} from 'three'

export const MODEL_OFFSET_Y = -0.85

const MIRROR = new Matrix4().makeScale(-1, 1, 1)
const mirrorCache = new Map<string, BufferGeometry>()

export interface ResolvedMarker {
  landmarkId: string
  boneId: string
  position: [number, number, number]
  normal: [number, number, number]
}

export interface SkeletonIndex {
  bounds: Map<string, Box3>
  markers: ResolvedMarker[]
}

export interface MeshInstance {
  key: string
  boneId: string
  meshName: string
  side: Side
  geometry: BufferGeometry
  material: MeshStandardMaterial
  worldBox: Box3
}

function mirrorGeometry(name: string, geometry: BufferGeometry): BufferGeometry {
  const cached = mirrorCache.get(name)
  if (cached) return cached
  const cloned = geometry.clone()
  cloned.applyMatrix4(MIRROR)
  mirrorCache.set(name, cloned)
  return cloned
}

function cloneMaterial(source: Material | Material[]): MeshStandardMaterial {
  const src = (Array.isArray(source) ? source[0] : source) as MeshStandardMaterial
  const material = src.clone()
  material.side = DoubleSide
  material.userData.baseColor = material.color.clone()
  material.userData.baseRoughness = material.roughness
  return material
}

function worldBoxOf(geometry: BufferGeometry): Box3 {
  if (!geometry.boundingBox) geometry.computeBoundingBox()
  const box = geometry.boundingBox!.clone()
  box.translate(new Vector3(0, MODEL_OFFSET_Y, 0))
  return box
}

function instanceSide(boneId: string, groupSide: Side, mirrored: boolean): Side {
  if (boneId.endsWith('_left')) return 'left'
  if (boneId.endsWith('_right')) return 'right'
  if (mirrored) return 'left'
  if (groupSide === 'right') return 'right'
  return 'midline'
}

function pushMesh(mesh: Mesh, groupSide: Side, mirrored: boolean, into: MeshInstance[]): void {
  const boneId = resolveBoneId(mesh.name, mirrored ? 'left' : groupSide) ?? '__unmapped__'
  if (boneId === '__unmapped__' && import.meta.env.DEV) {
    console.warn(`Unmapped skeleton mesh: ${mesh.name}`)
  }
  const side = instanceSide(boneId, groupSide, mirrored)
  const geometry = mirrored ? mirrorGeometry(mesh.name, mesh.geometry) : mesh.geometry
  into.push({
    key: `${side}:${mesh.name}:${mirrored ? 'mirror' : 'source'}`,
    boneId,
    meshName: mesh.name,
    side,
    geometry,
    material: cloneMaterial(mesh.material),
    worldBox: worldBoxOf(geometry),
  })
}

function collect(root: Object3D | null, groupSide: Side, mirrored: boolean, into: MeshInstance[]): void {
  if (!root) return
  root.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    pushMesh(mesh, groupSide, mirrored, into)
  })
}

function sidesFor(bone: Bone, landmark: Landmark): Side[] {
  if (landmark.bothSides) return ['right', 'left']
  if (bone.side === 'midline') return ['midline']
  return [bone.side]
}

function boxesFor(bone: Bone, landmark: Landmark, instances: MeshInstance[]): Box3[] {
  const boxes: Box3[] = []
  for (const side of sidesFor(bone, landmark)) {
    let matches = instances.filter((instance) => instance.boneId === bone.id && instance.side === side)
    if (landmark.mesh) {
      const wanted = meshKey(landmark.mesh)
      const named = matches.filter((instance) => meshKey(instance.meshName) === wanted)
      if (named.length > 0) matches = named
    }
    if (matches.length === 0) continue
    const box = new Box3()
    for (const match of matches) box.union(match.worldBox)
    boxes.push(box)
  }
  return boxes
}

function frameFor(bone: Bone, landmark: Landmark): AnchorFrame {
  if (landmark.bothSides) return 'side'
  return bone.anchorFrame
}

function pointOnBox(box: Box3, landmark: Landmark, frame: AnchorFrame, side: Side): { point: Vector3; normal: Vector3 } {
  let u = landmark.anchor.x
  if (frame === 'side' && side === 'right') u = 1 - landmark.anchor.x
  const point = new Vector3(
    box.min.x + (box.max.x - box.min.x) * u,
    box.min.y + (box.max.y - box.min.y) * landmark.anchor.y,
    box.min.z + (box.max.z - box.min.z) * landmark.anchor.z,
  )
  const normal = point.clone().sub(box.getCenter(new Vector3()))
  if (normal.lengthSq() < 1e-8) normal.set(0, 0, 1)
  normal.normalize()
  const reach = Math.min(0.012, box.getSize(new Vector3()).length() * 0.035)
  point.add(normal.clone().multiplyScalar(reach))
  return { point, normal }
}

function buildIndex(instances: MeshInstance[]): SkeletonIndex {
  const bounds = new Map<string, Box3>()
  for (const instance of instances) {
    if (instance.boneId === '__unmapped__') continue
    const existing = bounds.get(instance.boneId)
    if (existing) existing.union(instance.worldBox)
    else bounds.set(instance.boneId, instance.worldBox.clone())
  }

  for (const bone of bones) {
    if (!bone.compositeOf?.length) continue
    const box = new Box3()
    let found = false
    for (const id of bone.compositeOf) {
      const part = bounds.get(id)
      if (!part) continue
      box.union(part)
      found = true
    }
    if (found) bounds.set(bone.id, box)
  }

  const markers: ResolvedMarker[] = []
  for (const bone of bones) {
    for (const landmark of bone.landmarks) {
      const boxes = boxesFor(bone, landmark, instances)
      const sides = sidesFor(bone, landmark)
      if (boxes.length === 0 && import.meta.env.DEV) {
        console.warn(`No mesh placement for landmark ${landmark.id}`)
      }
      boxes.forEach((box, index) => {
        const side = sides[index] ?? bone.side
        const { point, normal } = pointOnBox(box, landmark, frameFor(bone, landmark), side)
        markers.push({
          landmarkId: landmark.id,
          boneId: bone.id,
          position: point.toArray() as [number, number, number],
          normal: normal.toArray() as [number, number, number],
        })
      })
    }
  }

  return { bounds, markers }
}

export function buildSkeleton(scene: Object3D): { instances: MeshInstance[]; index: SkeletonIndex } {
  const instances: MeshInstance[] = []
  const midline = scene.getObjectByName('Bones') ?? null
  const right = scene.getObjectByName('Bones_right') ?? null
  const cartilage = scene.getObjectByName('Cartilages_right') ?? null
  collect(midline, 'midline', false, instances)
  collect(right, 'right', false, instances)
  collect(cartilage, 'right', false, instances)
  collect(right, 'right', true, instances)
  collect(cartilage, 'right', true, instances)
  return { instances, index: buildIndex(instances) }
}
