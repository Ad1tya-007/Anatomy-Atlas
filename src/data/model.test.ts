import { bones, getBone } from '@/data/bones'
import { meshKey, resolveBoneId } from '@/data/meshMap'
import type { Bone, Landmark, Side } from '@/types/anatomy'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const MODEL_PATH = fileURLToPath(new URL('../../public/models/overview-skeleton.glb', import.meta.url))

interface GltfNode {
  name?: string
  mesh?: number
  children?: number[]
}

interface ModelMesh {
  boneId: string | null
  meshName: string
  side: Side
}

/** Reads the JSON chunk of a binary glTF. Names and hierarchy live there, so Draco decoding is not needed. */
function readGltfJson(path: string): { nodes: GltfNode[] } {
  const buffer = readFileSync(path)
  if (buffer.toString('utf8', 0, 4) !== 'glTF') throw new Error(`${path} is not a binary glTF file`)
  const length = buffer.readUInt32LE(12)
  if (buffer.toString('utf8', 16, 20) !== 'JSON') throw new Error('The first GLB chunk is not JSON')
  return JSON.parse(buffer.toString('utf8', 20, 20 + length))
}

/** Matches three.js `PropertyBinding.sanitizeNodeName`, which GLTFLoader applies to every node name. */
function sanitizeNodeName(name: string): string {
  return name.replace(/\s/g, '_').replace(/[[\].:/]/g, '')
}

function instanceSide(boneId: string, groupSide: Side, mirrored: boolean): Side {
  if (boneId.endsWith('_left')) return 'left'
  if (boneId.endsWith('_right')) return 'right'
  if (mirrored) return 'left'
  if (groupSide === 'right') return 'right'
  return 'midline'
}

/** Mirrors `buildSkeleton`: midline bones, right-sided bones, and a mirrored copy of the right side as the left. */
function loadModelMeshes(): ModelMesh[] {
  const { nodes } = readGltfJson(MODEL_PATH)
  const group = (name: string) => nodes.find((node) => node.name === name)
  const meshes: ModelMesh[] = []
  const collect = (root: GltfNode | undefined, groupSide: Side, mirrored: boolean) => {
    if (!root) return
    const visit = (node: GltfNode) => {
      if (node.mesh !== undefined) {
        const meshName = sanitizeNodeName(node.name ?? '')
        const boneId = resolveBoneId(meshName, mirrored ? 'left' : groupSide)
        meshes.push({ boneId, meshName, side: boneId ? instanceSide(boneId, groupSide, mirrored) : groupSide })
      }
      for (const child of node.children ?? []) visit(nodes[child]!)
    }
    visit(root)
  }
  collect(group('Bones'), 'midline', false)
  collect(group('Bones_right'), 'right', false)
  collect(group('Cartilages_right'), 'right', false)
  collect(group('Bones_right'), 'right', true)
  collect(group('Cartilages_right'), 'right', true)
  return meshes
}

function landmarkSides(bone: Bone, landmark: Landmark): Side[] {
  if (landmark.bothSides) return ['right', 'left']
  if (bone.side === 'midline') return ['midline']
  return [bone.side]
}

describe('3D model integrity', () => {
  const meshes = loadModelMeshes()
  const byBone = new Map<string, ModelMesh[]>()
  for (const mesh of meshes) {
    if (!mesh.boneId) continue
    byBone.set(mesh.boneId, [...(byBone.get(mesh.boneId) ?? []), mesh])
  }

  it('contains the expected mesh groups', () => {
    expect(meshes.length).toBeGreaterThan(100)
  })

  it('maps every mesh to a bone in the atlas', () => {
    const unmapped = meshes.filter((mesh) => !mesh.boneId || !getBone(mesh.boneId)).map((mesh) => mesh.meshName)
    expect(unmapped).toEqual([])
  })

  it('has geometry for every bone that is not a composite of other bones', () => {
    const missing = bones.filter((bone) => !bone.compositeOf?.length && !byBone.has(bone.id)).map((bone) => bone.id)
    expect(missing).toEqual([])
  })

  it('finds the primary mesh of every bone', () => {
    const missing = bones
      .filter((bone) => !bone.compositeOf?.length)
      .filter(
        (bone) => !(byBone.get(bone.id) ?? []).some((mesh) => meshKey(mesh.meshName) === meshKey(bone.primaryMesh)),
      )
      .map((bone) => `${bone.id} → ${bone.primaryMesh}`)
    expect(missing).toEqual([])
  })

  it('can place every landmark marker on its bone', () => {
    const problems: string[] = []
    for (const bone of bones) {
      const own = byBone.get(bone.id) ?? []
      for (const landmark of bone.landmarks) {
        for (const side of landmarkSides(bone, landmark)) {
          const onSide = own.filter((mesh) => mesh.side === side)
          if (onSide.length === 0) problems.push(`${landmark.id}: no ${side} mesh`)
          else if (landmark.mesh && !onSide.some((mesh) => meshKey(mesh.meshName) === meshKey(landmark.mesh!))) {
            problems.push(`${landmark.id}: mesh "${landmark.mesh}" not found on the ${side} side`)
          }
        }
      }
    }
    expect(problems).toEqual([])
  })
})
