import type { SkeletonIndex } from '@/components/three/skeletonIndex'
import { getBone } from '@/data/bones'
import { boundsForBone, CAMERA_PRESETS, computeFocus, computeGroupFocus, regionFocus } from '@/utils/camera'
import { sectionRemovesPoint, writeSectionPlane } from '@/utils/section'
import { spreadOffset, spreadOffsetForId } from '@/utils/spread'
import { Box3, Plane, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

const unitBox = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1))

function indexWith(entries: Record<string, [number, number, number, number, number, number]>): SkeletonIndex {
  const bounds = new Map<string, Box3>()
  for (const [id, [x0, y0, z0, x1, y1, z1]] of Object.entries(entries)) {
    bounds.set(id, new Box3(new Vector3(x0, y0, z0), new Vector3(x1, y1, z1)))
  }
  return {
    bounds,
    markers: [
      { landmarkId: 'femur_left_greater_trochanter', boneId: 'femur_left', position: [0.2, 0.1, 0], normal: [1, 0, 0] },
    ],
  }
}

describe('section planes', () => {
  it('is disabled when the section is off', () => {
    expect(writeSectionPlane(new Plane(), unitBox, 'off', 0.5)).toBe(false)
    expect(sectionRemovesPoint(new Vector3(), unitBox, 'off', 0.5, new Plane())).toBe(false)
  })

  it.each([
    ['sagittal', new Vector3(1, 0, 0)],
    ['coronal', new Vector3(0, 0, 1)],
    ['transverse', new Vector3(0, 1, 0)],
  ] as const)('cuts along the %s axis', (axis, normal) => {
    const plane = new Plane()
    expect(writeSectionPlane(plane, unitBox, axis, 0.5)).toBe(true)
    expect(plane.normal.equals(normal)).toBe(true)
    expect(plane.constant).toBeCloseTo(0)
  })

  it('removes the half of the model behind the plane', () => {
    const plane = new Plane()
    expect(sectionRemovesPoint(new Vector3(-0.5, 0, 0), unitBox, 'sagittal', 0.5, plane)).toBe(true)
    expect(sectionRemovesPoint(new Vector3(0.5, 0, 0), unitBox, 'sagittal', 0.5, plane)).toBe(false)
  })

  it('clamps the amount and leaves a margin past both ends', () => {
    const plane = new Plane()
    writeSectionPlane(plane, unitBox, 'transverse', 5)
    expect(-plane.constant).toBeGreaterThan(1)
    writeSectionPlane(plane, unitBox, 'transverse', -5)
    expect(-plane.constant).toBeLessThan(-1)
  })
})

describe('spread offsets', () => {
  it('pushes left and right bones apart and keeps midline bones centered', () => {
    const left = spreadOffset(getBone('humerus_left')!, 1)
    const right = spreadOffset(getBone('humerus_right')!, 1)
    expect(left[0]).toBeGreaterThan(0)
    expect(right[0]).toBe(-left[0])
    expect(spreadOffset(getBone('sacrum')!, 1)[0]).toBe(0)
  })

  it('scales with the amount and clamps it', () => {
    const bone = getBone('femur_left')!
    const half = spreadOffset(bone, 0.5)
    const full = spreadOffset(bone, 1)
    expect(half[1]).toBeCloseTo(full[1] / 2)
    expect(spreadOffset(bone, 3)).toEqual(full)
    expect(spreadOffset(bone, 0)).toEqual([0, 0, 0])
  })

  it('returns no offset for unknown bones', () => {
    expect(spreadOffsetForId('nope', 1)).toEqual([0, 0, 0])
    expect(spreadOffsetForId('femur_left', 0)).toEqual([0, 0, 0])
    expect(spreadOffsetForId('femur_left', 1)).toEqual(spreadOffset(getBone('femur_left')!, 1))
  })
})

describe('camera focus', () => {
  const index = indexWith({
    femur_left: [0.1, -0.8, -0.05, 0.3, -0.1, 0.05],
    femur_right: [-0.3, -0.8, -0.05, -0.1, -0.1, 0.05],
    sacrum: [-0.06, -0.1, -0.1, 0.06, 0.05, 0],
  })

  it('frames a bone from its own side, looking at its center', () => {
    const focus = computeFocus(index, 'femur_left', null)!
    expect(focus.target[0]).toBeCloseTo(0.2)
    expect(focus.target[1]).toBeCloseTo(-0.45)
    expect(focus.position[0]).toBeGreaterThan(focus.target[0])
    expect(focus.position[2]).toBeGreaterThan(focus.target[2])
  })

  it('moves closer to a landmark', () => {
    const bone = computeFocus(index, 'femur_left', null)!
    const landmark = computeFocus(index, 'femur_left', 'femur_left_greater_trochanter')!
    const distance = (pose: typeof bone) => new Vector3(...pose.position).distanceTo(new Vector3(...pose.target))
    expect(landmark.target).toEqual([0.2, 0.1, 0])
    expect(distance(landmark)).toBeLessThan(distance(bone))
  })

  it('follows a bone in the exploded view', () => {
    const still = computeFocus(index, 'femur_left', null, 0)!
    const spread = computeFocus(index, 'femur_left', null, 1)!
    expect(spread.target[0]).toBeGreaterThan(still.target[0])
  })

  it('frames a group around every member', () => {
    const focus = computeGroupFocus(index, ['femur_left', 'femur_right'], 'femur_left')!
    expect(focus.target[0]).toBeCloseTo(0)
    expect(computeGroupFocus(index, ['nope'], 'nope')).toBeNull()
  })

  it('returns nothing for bones without geometry', () => {
    expect(computeFocus(index, 'nope', null)).toBeNull()
    expect(boundsForBone(index, 'tibia_left')).toBeNull()
  })

  it('has a focus for each preset and navigator region', () => {
    expect(Object.keys(CAMERA_PRESETS)).toEqual(['default', 'front', 'back', 'left', 'right', 'top'])
    expect(regionFocus('lower-limb')).not.toBeNull()
    expect(regionFocus('nope')).toBeNull()
  })
})
