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

/** Landmarks in scope, falling back to the whole skeleton when the scope has none. */
function scopedLandmarks(config: StudyConfig): { records: LandmarkRecord[]; fallback: boolean } {
  const pool = studyPool(config)
  const records = quizLandmarks(pool.bones)
  if (records.length > 0) return { records, fallback: pool.fallback }
  return { records: quizLandmarks(quizBones()), fallback: true }
}

/** Locate mode with too many markers keeps only one region's landmarks on screen. */
function narrowForLocate(
  records: LandmarkRecord[],
  region: AnatomicalRegion,
): { records: LandmarkRecord[]; narrowed: boolean } {
  if (markerEstimate(records) <= LOCATE_MARKER_LIMIT) return { records, narrowed: false }
  const regional = records.filter((record) => getBone(record.boneId)?.region === region)
  return regional.length > 0 ? { records: regional, narrowed: true } : { records, narrowed: false }
}

function landmarkQuestion(
  config: StudyConfig,
  picked: LandmarkRecord | undefined,
  records: LandmarkRecord[],
  fallback: boolean,
  narrowed: boolean,
  rng: Rng,
): StudyQuestion {
  const correct = picked ?? getLandmark(FALLBACK_LANDMARK_ID)
  const choice = config.studyAnswerMode === 'choice'
  return {
    kind: 'landmark',
    boneId: picked?.boneId ?? FALLBACK_BONE_ID,
    landmarkId: picked?.landmark.id ?? FALLBACK_LANDMARK_ID,
    choices: choice && correct ? landmarkChoiceLabels(correct, records, quizLandmarks(quizBones()), rng) : [],
    fallback,
    locateNarrowed: narrowed,
    locateLandmarkIds: config.studyAnswerMode === 'locate' ? records.map((record) => record.landmark.id) : [],
  }
}

function boneQuestion(config: StudyConfig, bone: Bone | undefined, scoped: Bone[], fallback: boolean, rng: Rng) {
  const allBones = quizBones()
  const boneId = bone?.id ?? allBones[0]?.id ?? FALLBACK_BONE_ID
  const resolved = bone ?? getBone(boneId)
  return {
    kind: 'bone' as const,
    boneId,
    landmarkId: null,
    choices: config.studyAnswerMode === 'choice' && resolved ? boneChoiceLabels(resolved, scoped, allBones, rng) : [],
    fallback,
    locateNarrowed: false,
    locateLandmarkIds: [],
  }
}

export function buildQuestion(
  config: StudyConfig,
  kind: StudyKind,
  excludeBone: string | null,
  excludeLandmark: string | null,
  rng: Rng = Math.random,
): StudyQuestion {
  if (kind === 'landmark') {
    const scoped = scopedLandmarks(config)
    const region = config.studyRegionId ?? defaultStudyRegion(config.activeRegion)
    const { records, narrowed } =
      config.studyAnswerMode === 'locate'
        ? narrowForLocate(scoped.records, region)
        : { records: scoped.records, narrowed: false }
    const picked = pickOne(records, (record) => record.landmark.id === excludeLandmark, rng)
    return landmarkQuestion(config, picked, records, scoped.fallback, narrowed, rng)
  }
  const pool = studyPool(config)
  const picked = pickOne(pool.bones, (bone) => bone.id === excludeBone, rng)
  return boneQuestion(config, picked, pool.bones, pool.fallback, rng)
}

/** Builds the question for one specific structure, as review mode does for the next due card. */
export function buildQuestionFor(
  config: StudyConfig,
  target: { boneId: string; landmarkId: string | null },
  rng: Rng = Math.random,
): StudyQuestion {
  const record = target.landmarkId ? getLandmark(target.landmarkId) : undefined
  if (record) {
    const scoped = scopedLandmarks(config)
    const pool = scoped.records.some((item) => item.landmark.id === record.landmark.id)
      ? scoped.records
      : [record, ...scoped.records]
    const region = getBone(record.boneId)?.region ?? defaultStudyRegion(config.activeRegion)
    const { records, narrowed } =
      config.studyAnswerMode === 'locate' ? narrowForLocate(pool, region) : { records: pool, narrowed: false }
    return landmarkQuestion(config, record, records, scoped.fallback, narrowed, rng)
  }
  const pool = studyPool(config)
  return boneQuestion(config, getBone(target.boneId), pool.bones, pool.fallback, rng)
}

/** Card ids in scope for a question kind, in a stable order. */
export function scopeCardTargets(
  config: StudyConfig,
  kind: StudyKind,
): Array<{ boneId: string; landmarkId: string | null }> {
  if (kind === 'landmark') {
    return scopedLandmarks(config).records.map((record) => ({ boneId: record.boneId, landmarkId: record.landmark.id }))
  }
  return studyPool(config).bones.map((bone) => ({ boneId: bone.id, landmarkId: null }))
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
