import type { BoneVisual } from '@/utils/anatomy'
import { Color, type MeshStandardMaterial } from 'three'

const HIGHLIGHT = new Color('#fff6ea')
const SELECTED_EMISSIVE = new Color('#5a4c3c')
const HOVER_EMISSIVE = new Color('#3c342c')

export function applyVisual(material: MeshStandardMaterial, visual: BoneVisual): void {
  const base = material.userData.baseColor as Color | undefined
  if (!base) return
  const roughness = (material.userData.baseRoughness as number | undefined) ?? 0.55

  material.emissiveIntensity = 0
  material.roughness = roughness
  material.emissive.set('#000000')

  if (visual === 'selected') {
    material.color.copy(base).lerp(HIGHLIGHT, 0.48)
    material.emissive.copy(SELECTED_EMISSIVE)
    material.emissiveIntensity = 0.45
    material.roughness = Math.max(0.3, roughness - 0.14)
    return
  }
  if (visual === 'hover') {
    material.color.copy(base).lerp(HIGHLIGHT, 0.22)
    material.emissive.copy(HOVER_EMISSIVE)
    material.emissiveIntensity = 0.18
    return
  }
  if (visual === 'emphasized') {
    material.color.copy(base).lerp(HIGHLIGHT, 0.16)
    return
  }
  if (visual === 'subdued') {
    material.color.copy(base).multiplyScalar(0.32)
    return
  }
  if (visual === 'ghost') {
    material.color.copy(base).multiplyScalar(0.1)
    return
  }
  material.color.copy(base)
}
