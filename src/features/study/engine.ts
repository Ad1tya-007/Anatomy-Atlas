import { getBone, quizBones } from '@/data/bones'
import { allLandmarks, getLandmark, type LandmarkRecord } from '@/data/landmarks'
import { navRegions } from '@/data/regions'
import type {
  AnatomicalRegion,
  Bone,
  BoneClassification,
  StudyAnswerMode,
  StudyKind,
  StudyScope,
} from '@/types/anatomy'

export type Rng = () => number

/** Locate mode narrows to one region above this many markers so they stay readable. */
export const LOCATE_MARKER_LIMIT = 48

/** Scopes with fewer bones than this fall back to the full skeleton. */
export const MIN_SCOPE_SIZE = 4

const FALLBACK_BONE_ID = 'femur_left'
const FALLBACK_LANDMARK_ID = 'femur_left_greater_trochanter'

export interface StudyConfig {
  studyScope: StudyScope
  studyRegionId: AnatomicalRegion | null
  studyClassification: BoneClassification | null
  studyAnswerMode: StudyAnswerMode
  activeRegion: string | null
}

export interface StudyQuestion {
  kind: StudyKind
  boneId: string
  landmarkId: string | null
  choices: string[]
  fallback: boolean
  locateNarrowed: boolean
  locateLandmarkIds: string[]
}

export function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function stripSide(value: string): string {
  return value.replace(/^(left|right)\s+/, '')
}

export function acceptsBone(bone: Bone, raw: string): boolean {
  const answer = normalizeAnswer(raw)
  if (!answer) return false
  const accepted = new Set<string>()
  for (const field of [bone.name, bone.displayName, ...bone.alternateNames]) {
    const norm = normalizeAnswer(field)
    if (!norm) continue
    accepted.add(norm)
    const stripped = stripSide(norm)
    if (stripped) accepted.add(stripped)
  }
  if (accepted.has(answer)) return true
  const stripped = stripSide(answer)
  return stripped !== answer && stripped.length > 0 && accepted.has(stripped)
}

export function acceptsLandmark(name: string, raw: string): boolean {
  const answer = normalizeAnswer(raw)
  return answer.length > 0 && answer === normalizeAnswer(name)
}

export function shuffle<T>(items: T[], rng: Rng = Math.random): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const swap = copy[i]!
    copy[i] = copy[j]!
    copy[j] = swap
  }
  return copy
}

function uniqueLabels(labels: string[], exclude: string): string[] {
  const skip = normalizeAnswer(exclude)
  const seen = new Set<string>()
  const out: string[] = []
  for (const label of labels) {
    const key = normalizeAnswer(label)
    if (!key || key === skip || seen.has(key)) continue
    seen.add(key)
    out.push(label)
  }
  return out
}

/** Draws up to `count` labels, preferring earlier pools (the most similar distractors). */
export function fillDistractors(pools: string[][], count: number, rng: Rng = Math.random): string[] {
  const chosen: string[] = []
  const used = new Set<string>()
  for (const pool of pools) {
    for (const label of shuffle(pool, rng)) {
      if (chosen.length >= count) return chosen
      const key = normalizeAnswer(label)
      if (!key || used.has(key)) continue
      used.add(key)
      chosen.push(label)
    }
  }
  return chosen
}

export function pickOne<T>(items: T[], exclude: (item: T) => boolean, rng: Rng = Math.random): T | undefined {
  if (items.length === 0) return undefined
  const choices = items.filter((item) => !exclude(item))
  const source = choices.length > 0 ? choices : items
  return source[Math.floor(rng() * source.length)]
}

export function defaultStudyRegion(active: string | null): AnatomicalRegion {
  if (active && navRegions.some((region) => region.id === active)) return active as AnatomicalRegion
  return 'head'
}

export function studyPool(
  config: Pick<StudyConfig, 'studyScope' | 'studyRegionId' | 'studyClassification' | 'activeRegion'>,
): {
  bones: Bone[]
  fallback: boolean
} {
  const all = quizBones()
  if (config.studyScope === 'region') {
    const region = config.studyRegionId ?? defaultStudyRegion(config.activeRegion)
    const filtered = all.filter((bone) => bone.region === region)
    if (filtered.length < MIN_SCOPE_SIZE) return { bones: all, fallback: true }
    return { bones: filtered, fallback: false }
  }
  if (config.studyScope === 'classification') {
    const classification = config.studyClassification ?? 'long'
    const filtered = all.filter((bone) => bone.classification === classification)
    if (filtered.length < MIN_SCOPE_SIZE) return { bones: all, fallback: true }
    return { bones: filtered, fallback: false }
  }
  return { bones: all, fallback: false }
}

function choiceLabels(correct: string, pools: string[][], rng: Rng): string[] {
  const distractors = fillDistractors(pools, 3, rng)
  if (distractors.length < 1) return []
  return shuffle([correct, ...distractors], rng)
}

export function boneChoiceLabels(correct: Bone, scoped: Bone[], all: Bone[], rng: Rng = Math.random): string[] {
  const name = correct.name
  const sameClass = uniqueLabels(
    scoped.filter((bone) => bone.classification === correct.classification).map((bone) => bone.name),
    name,
  )
  const inScope = uniqueLabels(
    scoped.map((bone) => bone.name),
    name,
  )
  const everywhere = uniqueLabels(
    all.map((bone) => bone.name),
    name,
  )
  return choiceLabels(name, [sameClass, inScope, everywhere], rng)
}

export function landmarkChoiceLabels(
  correct: LandmarkRecord,
  scoped: LandmarkRecord[],
  all: LandmarkRecord[],
  rng: Rng = Math.random,
): string[] {
  const name = correct.landmark.name
  const sameBone = uniqueLabels(
    scoped.filter((record) => record.boneId === correct.boneId).map((record) => record.landmark.name),
    name,
  )
  const inScope = uniqueLabels(
    scoped.map((record) => record.landmark.name),
    name,
  )
  const everywhere = uniqueLabels(
    all.map((record) => record.landmark.name),
    name,
  )
  return choiceLabels(name, [sameBone, inScope, everywhere], rng)
}

export function quizLandmarks(bones: Bone[]): LandmarkRecord[] {
  const ids = new Set(bones.map((bone) => bone.id))
  return allLandmarks.filter((record) => ids.has(record.boneId))
}

function markerEstimate(records: LandmarkRecord[]): number {
  return records.reduce((count, record) => count + (record.landmark.bothSides ? 2 : 1), 0)
}

export function buildQuestion(
  config: StudyConfig,
  kind: StudyKind,
  excludeBone: string | null,
  excludeLandmark: string | null,
  rng: Rng = Math.random,
): StudyQuestion {
  const pool = studyPool(config)
  const allBones = quizBones()
  const locate = config.studyAnswerMode === 'locate'
  const choice = config.studyAnswerMode === 'choice'

  if (kind === 'landmark') {
    let records = quizLandmarks(pool.bones)
    let fallback = pool.fallback
    if (records.length === 0) {
      records = quizLandmarks(allBones)
      fallback = true
    }
    let narrowed = false
    if (locate && markerEstimate(records) > LOCATE_MARKER_LIMIT) {
      const region = config.studyRegionId ?? defaultStudyRegion(config.activeRegion)
      const regional = records.filter((record) => getBone(record.boneId)?.region === region)
      if (regional.length > 0) {
        records = regional
        narrowed = true
      }
    }
    const picked = pickOne(records, (record) => record.landmark.id === excludeLandmark, rng)
    const correct = picked ?? getLandmark(FALLBACK_LANDMARK_ID)
    return {
      kind,
      boneId: picked?.boneId ?? FALLBACK_BONE_ID,
      landmarkId: picked?.landmark.id ?? FALLBACK_LANDMARK_ID,
      choices: choice && correct ? landmarkChoiceLabels(correct, records, quizLandmarks(allBones), rng) : [],
      fallback,
      locateNarrowed: narrowed,
      locateLandmarkIds: locate ? records.map((record) => record.landmark.id) : [],
    }
  }

  const picked = pickOne(pool.bones, (bone) => bone.id === excludeBone, rng)
  const boneId = picked?.id ?? allBones[0]?.id ?? FALLBACK_BONE_ID
  const bone = picked ?? getBone(boneId)
  return {
    kind,
    boneId,
    landmarkId: null,
    choices: choice && bone ? boneChoiceLabels(bone, pool.bones, allBones, rng) : [],
    fallback: pool.fallback,
    locateNarrowed: false,
    locateLandmarkIds: [],
  }
}

export function correctLabel(kind: StudyKind, boneId: string | null, landmarkId: string | null): string | null {
  if (kind === 'landmark') return getLandmark(landmarkId)?.landmark.name ?? null
  return getBone(boneId)?.name ?? null
}

export function answerIsCorrect(
  kind: StudyKind,
  boneId: string | null,
  landmarkId: string | null,
  raw: string,
): boolean {
  if (kind === 'landmark') {
    const name = getLandmark(landmarkId)?.landmark.name
    return name ? acceptsLandmark(name, raw) : false
  }
  const bone = getBone(boneId)
  return bone ? acceptsBone(bone, raw) : false
}
