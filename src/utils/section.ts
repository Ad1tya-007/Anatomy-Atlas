import type { SectionAxis } from '@/types/anatomy'
import { Box3, Plane, Vector3 } from 'three'

const normal = new Vector3()

function along(min: number, max: number, t: number, margin: number): number {
  const start = min - margin
  const end = max + margin
  return start + (end - start) * t
}

export function writeSectionPlane(target: Plane, box: Box3, axis: SectionAxis, amount: number): boolean {
  if (axis === 'off') return false
  const t = Math.min(1, Math.max(0, amount))
  const size = box.getSize(new Vector3())
  const margin = Math.max(size.x, size.y, size.z) * 0.02 + 0.012
  if (axis === 'sagittal') {
    normal.set(1, 0, 0)
    target.set(normal, -along(box.min.x, box.max.x, t, margin))
    return true
  }
  if (axis === 'coronal') {
    normal.set(0, 0, 1)
    target.set(normal, -along(box.min.z, box.max.z, t, margin))
    return true
  }
  normal.set(0, 1, 0)
  target.set(normal, -along(box.min.y, box.max.y, t, margin))
  return true
}

export function sectionRemovesPoint(
  point: Vector3,
  box: Box3,
  axis: SectionAxis,
  amount: number,
  plane: Plane,
): boolean {
  if (!writeSectionPlane(plane, box, axis, amount)) return false
  return plane.distanceToPoint(point) < -0.0008
}
