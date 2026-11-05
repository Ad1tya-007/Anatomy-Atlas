import { bones, contralateralId, getBone } from '@/data/bones'
import { joints, jointLandmarkIds, resolveJointBones } from '@/data/joints'
import { allLandmarks, getLandmark } from '@/data/landmarks'
import { navRegions, REGION_FOCUS } from '@/data/regions'
import { resolvedStops, walks } from '@/data/walks'
import type { NavEntry } from '@/types/anatomy'
import { describe, expect, it } from 'vitest'

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>()
  return ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)))
}

function flatten(entries: NavEntry[]): NavEntry[] {
  return entries.flatMap((entry) => [entry, ...flatten(entry.children ?? [])])
}

describe('content integrity', () => {
  it('uses unique ids', () => {
    expect(duplicates(bones.map((bone) => bone.id))).toEqual([])
    expect(duplicates(allLandmarks.map((record) => record.landmark.id))).toEqual([])
    expect(duplicates(joints.map((joint) => joint.id))).toEqual([])
    expect(duplicates(walks.map((walk) => walk.id))).toEqual([])
  })

  it('gives every bone and landmark a name and description', () => {
    for (const bone of bones) {
      expect(bone.name.trim(), bone.id).not.toBe('')
      expect(bone.description.trim(), bone.id).not.toBe('')
    }
    for (const { landmark } of allLandmarks) {
      expect(landmark.name.trim(), landmark.id).not.toBe('')
      expect(landmark.description.trim(), landmark.id).not.toBe('')
    }
  })

  it('keeps every landmark anchor inside its bounding box', () => {
    for (const { landmark } of allLandmarks) {
      for (const axis of ['x', 'y', 'z'] as const) {
        const value = landmark.anchor[axis]
        expect(value >= 0 && value <= 1, `${landmark.id}.${axis} = ${value}`).toBe(true)
      }
    }
  })

  it('pairs every sided bone with its opposite', () => {
    for (const bone of bones.filter((item) => item.side !== 'midline')) {
      const partner = getBone(contralateralId(bone.id))
      expect(partner, bone.id).toBeDefined()
      expect(partner?.name).toBe(bone.name)
      expect(partner?.landmarks.length).toBe(bone.landmarks.length)
    }
  })

  it('resolves composite and part-of references', () => {
    for (const bone of bones) {
      for (const part of bone.compositeOf ?? []) expect(getBone(part), `${bone.id} → ${part}`).toBeDefined()
    }
    for (const bone of bones.filter((item) => item.partOf)) {
      expect(getBone(bone.partOf), `${bone.id} → ${bone.partOf}`).toBeDefined()
    }
  })

  it('resolves every joint to real bones and landmarks on those bones', () => {
    for (const joint of joints) {
      for (const side of ['left', 'right'] as const) {
        const members = resolveJointBones(joint, side)
        expect(members.length, `${joint.id} (${side})`).toBeGreaterThan(0)
        for (const id of members) expect(getBone(id), `${joint.id} → ${id}`).toBeDefined()
        for (const id of jointLandmarkIds(joint, side)) {
          const record = getLandmark(id)
          expect(record, `${joint.id} → ${id}`).toBeDefined()
          expect(members, `${joint.id}: ${id} is not on a member bone`).toContain(record!.boneId)
        }
      }
    }
  })

  it('resolves every guided walk stop', () => {
    for (const walk of walks) {
      expect(walk.stops.length, walk.id).toBeGreaterThan(0)
      expect(resolvedStops(walk), `${walk.id} has stops that would be skipped`).toHaveLength(walk.stops.length)
      for (const stop of walk.stops.filter((item) => item.landmarkId)) {
        expect(getLandmark(stop.landmarkId)?.boneId, stop.landmarkId).toBe(stop.boneId)
      }
    }
  })

  it('resolves every navigator entry', () => {
    for (const region of navRegions) {
      for (const entry of flatten(region.entries)) {
        for (const id of entry.bones) expect(getBone(id), `${region.id} → ${id}`).toBeDefined()
        const landmarkIds = entry.landmarkSuffix ? entry.bones.map((id) => `${id}_${entry.landmarkSuffix}`) : []
        for (const id of landmarkIds) expect(getLandmark(id), id).toBeDefined()
      }
    }
  })

  it('gives every navigator region a camera focus', () => {
    for (const region of navRegions) expect(REGION_FOCUS[region.id], region.id).toBeDefined()
  })
})
