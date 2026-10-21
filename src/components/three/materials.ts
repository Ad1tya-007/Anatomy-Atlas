import type { BoneVisual } from '@/utils/anatomy'
import { lookPaint } from '@/utils/specimenMotion'
import type { LookName } from '@/types/anatomy'
import { Color, type MeshStandardMaterial } from 'three'

const HIGHLIGHT = new Color('#fff6ea')
const SELECTED_EMISSIVE = new Color('#5a4c3c')
const HOVER_EMISSIVE = new Color('#3c342c')
const PLASTER = new Color('#e4dccf')
const IVORY_SELECTED = new Color('#fffaf3')
const IVORY_EMISSIVE = new Color('#6a5344')
const FILM = new Color('#14181c')
const FILM_GLOW = new Color('#c5d2d8')
const FILM_SELECTED = new Color('#e7f4f1')

interface Paint {
  color: Color
  emissive: Color
  emissiveIntensity: number
  roughness: number
}

const scratchA: Paint = { color: new Color(), emissive: new Color(), emissiveIntensity: 0, roughness: 0.55 }
const scratchB: Paint = { color: new Color(), emissive: new Color(), emissiveIntensity: 0, roughness: 0.55 }

function writeAtlas(target: Paint, base: Color, baseRoughness: number, visual: BoneVisual): void {
  target.emissiveIntensity = 0
  target.roughness = baseRoughness
  target.emissive.set('#000000')
  target.color.copy(base)
  if (visual === 'selected') {
    target.color.copy(base).lerp(HIGHLIGHT, 0.48)
    target.emissive.copy(SELECTED_EMISSIVE)
    target.emissiveIntensity = 0.45
    target.roughness = Math.max(0.3, baseRoughness - 0.14)
    return
  }
  if (visual === 'hover') {
    target.color.copy(base).lerp(HIGHLIGHT, 0.22)
    target.emissive.copy(HOVER_EMISSIVE)
    target.emissiveIntensity = 0.18
    return
  }
  if (visual === 'emphasized') {
    target.color.copy(base).lerp(HIGHLIGHT, 0.16)
  }
  if (visual === 'subdued') target.color.copy(base).multiplyScalar(0.32)
  if (visual === 'ghost') target.color.copy(base).multiplyScalar(0.1)
}

function writeIvory(target: Paint, base: Color, visual: BoneVisual): void {
  const plaster = scratchHold(base)
  target.color.copy(plaster)
  target.emissive.set('#000000')
  target.emissiveIntensity = 0
  target.roughness = 0.78
  if (visual === 'selected') {
    target.color.copy(plaster).lerp(IVORY_SELECTED, 0.72)
    target.emissive.copy(IVORY_EMISSIVE)
    target.emissiveIntensity = 0.28
    return
  }
  if (visual === 'hover') {
    target.color.copy(plaster).lerp(IVORY_SELECTED, 0.35)
    target.emissive.copy(IVORY_EMISSIVE)
    target.emissiveIntensity = 0.12
    return
  }
  if (visual === 'emphasized') {
    target.color.copy(plaster).lerp(IVORY_SELECTED, 0.16)
    return
  }
  if (visual === 'subdued') target.color.copy(plaster).multiplyScalar(0.45)
  if (visual === 'ghost') target.color.copy(plaster).multiplyScalar(0.16)
}

const plasterScratch = new Color()

function scratchHold(base: Color): Color {
  return plasterScratch.copy(base).lerp(PLASTER, 0.7)
}

function writeRadiograph(target: Paint, visual: BoneVisual): void {
  target.color.copy(FILM)
  target.roughness = 1
  target.emissive.copy(FILM_GLOW)
  target.emissiveIntensity = 0.42
  if (visual === 'selected') {
    target.emissive.copy(FILM_GLOW).lerp(FILM_SELECTED, 0.85)
    target.emissiveIntensity = 0.85
    return
  }
  if (visual === 'hover') {
    target.emissive.copy(FILM_GLOW).lerp(FILM_SELECTED, 0.55)
    target.emissiveIntensity = 0.6
    return
  }
  if (visual === 'emphasized') {
    target.emissiveIntensity = 0.55
    return
  }
  if (visual === 'subdued') target.emissiveIntensity = 0.12
  if (visual === 'ghost') target.emissiveIntensity = 0.05
}

function writePaint(target: Paint, base: Color, baseRoughness: number, visual: BoneVisual, look: LookName): void {
  if (look === 'ivory') {
    writeIvory(target, base, visual)
    return
  }
  if (look === 'radiograph') {
    writeRadiograph(target, visual)
    return
  }
  writeAtlas(target, base, baseRoughness, visual)
}

function assign(material: MeshStandardMaterial, paint: Paint): void {
  material.color.copy(paint.color)
  material.emissive.copy(paint.emissive)
  material.emissiveIntensity = paint.emissiveIntensity
  material.roughness = paint.roughness
}

export function applyVisual(material: MeshStandardMaterial, visual: BoneVisual): void {
  const base = material.userData.baseColor as Color | undefined
  if (!base) return
  const roughness = (material.userData.baseRoughness as number | undefined) ?? 0.55
  const sample = lookPaint()
  writePaint(scratchA, base, roughness, visual, sample.look)
  if (sample.blend >= 1 || sample.from === sample.look) {
    assign(material, scratchA)
    return
  }
  writePaint(scratchB, base, roughness, visual, sample.from)
  material.color.copy(scratchB.color).lerp(scratchA.color, sample.blend)
  material.emissive.copy(scratchB.emissive).lerp(scratchA.emissive, sample.blend)
  material.emissiveIntensity =
    scratchB.emissiveIntensity + (scratchA.emissiveIntensity - scratchB.emissiveIntensity) * sample.blend
  material.roughness = scratchB.roughness + (scratchA.roughness - scratchB.roughness) * sample.blend
}
