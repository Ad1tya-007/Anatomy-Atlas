import { contralateralId, getBone, quizBones } from '@/data/bones'
import { getJoint, isPairedJoint, resolveJointBones } from '@/data/joints'
import { allLandmarks, getLandmark } from '@/data/landmarks'
import { navRegions } from '@/data/regions'
import { getWalk, resolvedStops } from '@/data/walks'
import { CAMERA_PRESETS, regionFocus } from '@/utils/camera'
import type {
  AnatomicalRegion,
  Bone,
  BoneClassification,
  CameraPresetName,
  CameraRequest,
  MobilePanel,
  ModelState,
  SelectBoneOptions,
  StudyAnswerMode,
  StudyKind,
  StudyResult,
  StudyScope,
  Vec3,
  WalkStop,
} from '@/types/anatomy'
import type { LandmarkRecord } from '@/data/landmarks'
import { create } from 'zustand'

interface AnatomyState {
  selectedBoneId: string | null
  selectedLandmarkId: string | null
  selectedJointId: string | null
  jointSide: 'left' | 'right' | null
  compareSides: boolean
  walkId: string | null
  walkIndex: number
  hoveredBoneId: string | null
  isolated: boolean
  activeRegion: string | null
  classification: BoneClassification | 'all'
  showBones: boolean
  showLabels: boolean
  showLandmarks: boolean
  studyMode: boolean
  studyKind: StudyKind
  studyRevealed: boolean
  studyBoneId: string | null
  studyLandmarkId: string | null
  studyScope: StudyScope
  studyRegionId: AnatomicalRegion | null
  studyClassification: BoneClassification | null
  studyAnswerMode: StudyAnswerMode
  studyChoices: string[]
  studyAttempts: number
  studyCorrect: number
  studyScopeFallback: boolean
  studyPicked: string | null
  studyResult: StudyResult | null
  cameraRequest: CameraRequest
  modelState: ModelState
  retryKey: number
  helpOpen: boolean
  mobilePanel: MobilePanel

  selectBone: (id: string, options?: SelectBoneOptions) => void
  selectLandmark: (id: string) => void
  selectJoint: (id: string, side?: 'left' | 'right') => void
  clearJoint: () => void
  toggleCompare: () => void
  startWalk: (id: string) => void
  stepWalk: (direction: 1 | -1) => void
  exitWalk: () => void
  hoverBone: (id: string | null) => void
  clearSelection: () => void
  toggleIsolate: () => void
  clearIsolation: () => void
  setClassification: (classification: BoneClassification | 'all') => void
  setShowBones: (value: boolean) => void
  setShowLabels: (value: boolean) => void
  setShowLandmarks: (value: boolean) => void
  toggleLandmarks: () => void
  enterStudy: (kind?: StudyKind) => void
  exitStudy: () => void
  revealStudy: () => void
  nextStudy: () => void
  setStudyKind: (kind: StudyKind) => void
  setStudyScope: (scope: StudyScope) => void
  setStudyRegion: (region: AnatomicalRegion) => void
  setStudyClassification: (classification: BoneClassification) => void
  setStudyAnswerMode: (mode: StudyAnswerMode) => void
  submitStudyChoice: (label: string) => void
  submitStudyAnswer: (raw: string) => void
  requestPreset: (preset: CameraPresetName) => void
  focusCamera: (position: Vec3, target: Vec3) => void
  frameRegion: (regionId: string) => void
  setModelState: (state: ModelState) => void
  retryModel: () => void
  setHelpOpen: (open: boolean) => void
  setMobilePanel: (panel: MobilePanel) => void
}

let cameraSeq = 1

function nextCamera(partial: Omit<CameraRequest, 'id'>): CameraRequest {
  cameraSeq += 1
  return { id: cameraSeq, ...partial }
}

function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function stripSide(value: string): string {
  return value.replace(/^(left|right)\s+/, '')
}

function acceptsBone(bone: Bone, raw: string): boolean {
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

function acceptsLandmark(name: string, raw: string): boolean {
  const answer = normalizeAnswer(raw)
  return answer.length > 0 && answer === normalizeAnswer(name)
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
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

function fillDistractors(pools: string[][], count: number): string[] {
  const chosen: string[] = []
  const used = new Set<string>()
  for (const pool of pools) {
    for (const label of shuffle(pool)) {
      if (chosen.length >= count) return chosen
      const key = normalizeAnswer(label)
      if (!key || used.has(key)) continue
      used.add(key)
      chosen.push(label)
    }
  }
  return chosen
}

function pickOne<T>(items: T[], exclude: (item: T) => boolean): T | undefined {
  if (items.length === 0) return undefined
  const choices = items.filter((item) => !exclude(item))
  const source = choices.length > 0 ? choices : items
  return source[Math.floor(Math.random() * source.length)]
}

function defaultStudyRegion(active: string | null): AnatomicalRegion {
  if (active && navRegions.some((region) => region.id === active)) return active as AnatomicalRegion
  return 'head'
}

function studyPool(state: Pick<AnatomyState, 'studyScope' | 'studyRegionId' | 'studyClassification' | 'activeRegion'>): {
  bones: Bone[]
  fallback: boolean
} {
  const all = quizBones()
  if (state.studyScope === 'region') {
    const region = state.studyRegionId ?? defaultStudyRegion(state.activeRegion)
    const filtered = all.filter((bone) => bone.region === region)
    if (filtered.length < 4) return { bones: all, fallback: true }
    return { bones: filtered, fallback: false }
  }
  if (state.studyScope === 'classification') {
    const classification = state.studyClassification ?? 'long'
    const filtered = all.filter((bone) => bone.classification === classification)
    if (filtered.length < 4) return { bones: all, fallback: true }
    return { bones: filtered, fallback: false }
  }
  return { bones: all, fallback: false }
}

function choiceLabels(correct: string, pools: string[][]): string[] {
  const distractors = fillDistractors(pools, 3)
  if (distractors.length < 1) return []
  return shuffle([correct, ...distractors])
}

function boneChoiceLabels(correct: Bone, scoped: Bone[], all: Bone[]): string[] {
  const name = correct.name
  const sameClass = uniqueLabels(
    scoped.filter((bone) => bone.classification === correct.classification).map((bone) => bone.name),
    name,
  )
  const inScope = uniqueLabels(scoped.map((bone) => bone.name), name)
  const everywhere = uniqueLabels(all.map((bone) => bone.name), name)
  return choiceLabels(name, [sameClass, inScope, everywhere])
}

function landmarkChoiceLabels(correct: LandmarkRecord, scoped: LandmarkRecord[], all: LandmarkRecord[]): string[] {
  const name = correct.landmark.name
  const sameBone = uniqueLabels(
    scoped.filter((record) => record.boneId === correct.boneId).map((record) => record.landmark.name),
    name,
  )
  const inScope = uniqueLabels(scoped.map((record) => record.landmark.name), name)
  const everywhere = uniqueLabels(all.map((record) => record.landmark.name), name)
  return choiceLabels(name, [sameBone, inScope, everywhere])
}

function quizLandmarks(bones: Bone[]): LandmarkRecord[] {
  const ids = new Set(bones.map((bone) => bone.id))
  return allLandmarks.filter((record) => ids.has(record.boneId))
}

interface QuestionPatch {
  studyKind: StudyKind
  studyRevealed: boolean
  studyBoneId: string
  studyLandmarkId: string | null
  selectedBoneId: string
  selectedLandmarkId: string | null
  studyChoices: string[]
  studyPicked: null
  studyResult: null
  studyScopeFallback: boolean
  selectedJointId: null
  jointSide: null
  compareSides: false
  walkId: null
  walkIndex: number
  isolated: false
}

function makeQuestion(
  state: Pick<
    AnatomyState,
    'studyScope' | 'studyRegionId' | 'studyClassification' | 'studyAnswerMode' | 'activeRegion'
  >,
  kind: StudyKind,
  excludeBone: string | null,
  excludeLandmark: string | null,
): QuestionPatch {
  const pool = studyPool(state)
  const allBones = quizBones()
  const base = {
    studyKind: kind,
    studyRevealed: false as const,
    studyPicked: null,
    studyResult: null,
    studyScopeFallback: pool.fallback,
    selectedJointId: null,
    jointSide: null,
    compareSides: false as const,
    walkId: null,
    walkIndex: 0,
    isolated: false as const,
  }

  if (kind === 'landmark') {
    let records = quizLandmarks(pool.bones)
    let fallback = pool.fallback
    if (records.length === 0) {
      records = quizLandmarks(allBones)
      fallback = true
    }
    const picked = pickOne(records, (record) => record.landmark.id === excludeLandmark)
    const boneId = picked?.boneId ?? 'femur_left'
    const landmarkId = picked?.landmark.id ?? 'femur_left_greater_trochanter'
    const correct = picked ?? getLandmark(landmarkId)
    const choices =
      state.studyAnswerMode === 'choice' && correct
        ? landmarkChoiceLabels(correct, records, quizLandmarks(allBones))
        : []
    return {
      ...base,
      studyScopeFallback: fallback,
      studyBoneId: boneId,
      studyLandmarkId: landmarkId,
      selectedBoneId: boneId,
      selectedLandmarkId: landmarkId,
      studyChoices: choices,
    }
  }

  const picked = pickOne(pool.bones, (bone) => bone.id === excludeBone)
  const boneId = picked?.id ?? allBones[0]?.id ?? 'femur_left'
  const bone = picked ?? getBone(boneId)
  const choices =
    state.studyAnswerMode === 'choice' && bone ? boneChoiceLabels(bone, pool.bones, allBones) : []
  return {
    ...base,
    studyBoneId: boneId,
    studyLandmarkId: null,
    selectedBoneId: boneId,
    selectedLandmarkId: null,
    studyChoices: choices,
  }
}

function correctLabel(state: Pick<AnatomyState, 'studyKind' | 'studyBoneId' | 'studyLandmarkId'>): string | null {
  if (state.studyKind === 'landmark') return getLandmark(state.studyLandmarkId)?.landmark.name ?? null
  return getBone(state.studyBoneId)?.name ?? null
}

function answerIsCorrect(state: AnatomyState, raw: string): boolean {
  if (state.studyKind === 'landmark') {
    const name = getLandmark(state.studyLandmarkId)?.landmark.name
    return name ? acceptsLandmark(name, raw) : false
  }
  const bone = getBone(state.studyBoneId)
  return bone ? acceptsBone(bone, raw) : false
}

function stopPatch(stop: WalkStop): Partial<AnatomyState> | null {
  if (stop.jointId) {
    const joint = getJoint(stop.jointId)
    if (!joint) return null
    const members = resolveJointBones(joint, 'left')
    if (members.length === 0) return null
    return {
      selectedJointId: joint.id,
      jointSide: isPairedJoint(joint) ? 'left' : null,
      selectedBoneId: members[0] ?? null,
      selectedLandmarkId: null,
      compareSides: false,
      isolated: false,
      activeRegion: joint.region,
    }
  }
  const bone = getBone(stop.boneId)
  if (!bone) return null
  if (stop.landmarkId && !getLandmark(stop.landmarkId)) return null
  return {
    selectedJointId: null,
    jointSide: null,
    selectedBoneId: bone.id,
    selectedLandmarkId: stop.landmarkId ?? null,
    compareSides: false,
    isolated: false,
    activeRegion: bone.region,
  }
}

function openInfoOnMobile(): MobilePanel | undefined {
  if (typeof window === 'undefined') return undefined
  return window.matchMedia('(max-width: 1023px)').matches ? 'info' : undefined
}

const clearedStudy = {
  studyMode: false,
  studyRevealed: false,
  studyAttempts: 0,
  studyCorrect: 0,
  studyChoices: [] as string[],
  studyPicked: null,
  studyResult: null,
  studyScopeFallback: false,
}

export const useAnatomyStore = create<AnatomyState>((set, get) => ({
  selectedBoneId: null,
  selectedLandmarkId: null,
  selectedJointId: null,
  jointSide: null,
  compareSides: false,
  walkId: null,
  walkIndex: 0,
  hoveredBoneId: null,
  isolated: false,
  activeRegion: null,
  classification: 'all',
  showBones: true,
  showLabels: true,
  showLandmarks: true,
  studyMode: false,
  studyKind: 'bone',
  studyRevealed: false,
  studyBoneId: null,
  studyLandmarkId: null,
  studyScope: 'all',
  studyRegionId: null,
  studyClassification: 'long',
  studyAnswerMode: 'reveal',
  studyChoices: [],
  studyAttempts: 0,
  studyCorrect: 0,
  studyScopeFallback: false,
  studyPicked: null,
  studyResult: null,
  cameraRequest: { id: 0, kind: 'preset', preset: 'default', ...CAMERA_PRESETS.default },
  modelState: 'loading',
  retryKey: 0,
  helpOpen: false,
  mobilePanel: 'none',

  selectBone: (id, options) => {
    const bone = getBone(id)
    const fromStudy = options?.fromStudy === true
    const keepWalk = options?.keepWalk === true
    const landmarkId = options && 'landmarkId' in options ? (options.landmarkId ?? null) : null
    const state = get()
    const partner = state.selectedBoneId ? contralateralId(state.selectedBoneId) : null
    const keepCompare =
      state.compareSides && !state.selectedJointId && (id === state.selectedBoneId || id === partner)
    const mobile = !fromStudy ? openInfoOnMobile() : undefined
    set({
      selectedBoneId: id,
      selectedLandmarkId: landmarkId,
      selectedJointId: null,
      jointSide: null,
      compareSides: keepCompare,
      walkId: keepWalk ? state.walkId : null,
      walkIndex: keepWalk ? state.walkIndex : 0,
      activeRegion: bone?.region ?? state.activeRegion,
      studyMode: fromStudy ? state.studyMode : false,
      studyRevealed: fromStudy ? state.studyRevealed : false,
      studyAttempts: fromStudy ? state.studyAttempts : 0,
      studyCorrect: fromStudy ? state.studyCorrect : 0,
      studyChoices: fromStudy ? state.studyChoices : [],
      studyPicked: fromStudy ? state.studyPicked : null,
      studyResult: fromStudy ? state.studyResult : null,
      studyScopeFallback: fromStudy ? state.studyScopeFallback : false,
      mobilePanel: mobile ?? (state.mobilePanel === 'nav' ? 'none' : state.mobilePanel),
    })
  },

  selectLandmark: (id) => {
    const record = allLandmarks.find((item) => item.landmark.id === id)
    if (!record) return
    const state = get()
    if (state.studyMode && !state.studyRevealed) return
    set({
      selectedBoneId: record.boneId,
      selectedLandmarkId: id,
      selectedJointId: null,
      jointSide: null,
      compareSides: false,
      walkId: null,
      walkIndex: 0,
      activeRegion: getBone(record.boneId)?.region ?? state.activeRegion,
    })
  },

  selectJoint: (id, side) => {
    const joint = getJoint(id)
    if (!joint) return
    const paired = isPairedJoint(joint)
    const resolvedSide: 'left' | 'right' = paired ? (side ?? 'left') : 'left'
    const members = resolveJointBones(joint, resolvedSide)
    if (members.length === 0) return
    const mobile = openInfoOnMobile()
    const state = get()
    set({
      selectedJointId: joint.id,
      jointSide: paired ? resolvedSide : null,
      selectedBoneId: members[0] ?? null,
      selectedLandmarkId: null,
      compareSides: false,
      isolated: false,
      walkId: null,
      walkIndex: 0,
      activeRegion: joint.region,
      ...clearedStudy,
      mobilePanel: mobile ?? (state.mobilePanel === 'nav' ? 'none' : state.mobilePanel),
    })
  },

  clearJoint: () => set({ selectedJointId: null, jointSide: null }),

  toggleCompare: () => {
    const state = get()
    if (!state.selectedBoneId || state.selectedJointId) return
    const bone = getBone(state.selectedBoneId)
    if (!bone || bone.side === 'midline' || bone.compositeOf?.length) return
    const partner = contralateralId(state.selectedBoneId)
    if (!partner || !getBone(partner)) return
    set({ compareSides: !state.compareSides, isolated: false })
  },

  startWalk: (id) => {
    const walk = getWalk(id)
    const stops = walk ? resolvedStops(walk) : []
    const first = stops[0]
    if (!walk || !first) return
    const patch = stopPatch(first)
    if (!patch) return
    set({
      ...patch,
      walkId: walk.id,
      walkIndex: 0,
      ...clearedStudy,
      helpOpen: false,
      mobilePanel: 'none',
    })
  },

  stepWalk: (direction) => {
    const state = get()
    const walk = getWalk(state.walkId)
    if (!walk) return
    const stops = resolvedStops(walk)
    const next = state.walkIndex + direction
    if (next < 0 || stops.length === 0) return
    if (next >= stops.length) {
      set({ walkId: null, walkIndex: 0 })
      return
    }
    const patch = stopPatch(stops[next]!)
    if (!patch) return
    set({
      ...patch,
      walkId: walk.id,
      walkIndex: next,
      studyMode: false,
      mobilePanel: 'none',
    })
  },

  exitWalk: () => set({ walkId: null, walkIndex: 0 }),

  hoverBone: (id) => {
    if (get().hoveredBoneId === id) return
    set({ hoveredBoneId: id })
  },

  clearSelection: () => {
    set({
      selectedBoneId: null,
      selectedLandmarkId: null,
      selectedJointId: null,
      jointSide: null,
      compareSides: false,
      walkId: null,
      walkIndex: 0,
      isolated: false,
      ...clearedStudy,
      studyBoneId: null,
      studyLandmarkId: null,
    })
  },

  toggleIsolate: () => {
    const state = get()
    if (!state.selectedBoneId) return
    const isolated = !state.isolated
    set({
      isolated,
      compareSides: isolated ? false : state.compareSides,
      selectedJointId: isolated ? null : state.selectedJointId,
      jointSide: isolated ? null : state.jointSide,
    })
  },

  clearIsolation: () => set({ isolated: false }),

  setClassification: (classification) =>
    set({
      classification,
      compareSides: classification === 'all' ? get().compareSides : false,
    }),

  setShowBones: (value) => set({ showBones: value }),
  setShowLabels: (value) => set({ showLabels: value }),
  setShowLandmarks: (value) => set({ showLandmarks: value }),
  toggleLandmarks: () => set({ showLandmarks: !get().showLandmarks }),

  enterStudy: (kind = 'bone') => {
    const state = get()
    const studyRegionId =
      state.studyScope === 'region' ? (state.studyRegionId ?? defaultStudyRegion(state.activeRegion)) : state.studyRegionId
    const studyClassification = state.studyClassification ?? 'long'
    const question = makeQuestion({ ...state, studyRegionId, studyClassification }, kind, null, null)
    set({
      studyMode: true,
      studyRegionId,
      studyClassification,
      studyAttempts: 0,
      studyCorrect: 0,
      helpOpen: false,
      mobilePanel: 'none',
      ...question,
    })
  },

  exitStudy: () => set({ ...clearedStudy }),

  revealStudy: () => {
    const state = get()
    if (state.studyAnswerMode === 'type') return
    if (state.studyAnswerMode === 'choice' && state.studyChoices.length >= 2) return
    set({ studyRevealed: true })
  },

  nextStudy: () => {
    const state = get()
    const question = makeQuestion(state, state.studyKind, state.studyBoneId, state.studyLandmarkId)
    set({ ...question })
  },

  setStudyKind: (kind) => {
    const state = get()
    if (state.studyKind === kind) return
    const question = makeQuestion(state, kind, null, null)
    set({
      studyMode: true,
      studyAttempts: 0,
      studyCorrect: 0,
      ...question,
    })
  },

  setStudyScope: (scope) => {
    const state = get()
    if (state.studyScope === scope) return
    const studyRegionId = scope === 'region' ? (state.studyRegionId ?? defaultStudyRegion(state.activeRegion)) : state.studyRegionId
    const next = { ...state, studyScope: scope, studyRegionId }
    const question = makeQuestion(next, state.studyKind, null, null)
    set({
      studyScope: scope,
      studyRegionId,
      studyMode: true,
      studyAttempts: 0,
      studyCorrect: 0,
      ...question,
    })
  },

  setStudyRegion: (region) => {
    const state = get()
    if (state.studyRegionId === region && state.studyScope === 'region') return
    const next = { ...state, studyScope: 'region' as const, studyRegionId: region }
    const question = makeQuestion(next, state.studyKind, null, null)
    set({
      studyScope: 'region',
      studyRegionId: region,
      studyMode: true,
      studyAttempts: 0,
      studyCorrect: 0,
      ...question,
    })
  },

  setStudyClassification: (classification) => {
    const state = get()
    if (state.studyClassification === classification && state.studyScope === 'classification') return
    const next = { ...state, studyScope: 'classification' as const, studyClassification: classification }
    const question = makeQuestion(next, state.studyKind, null, null)
    set({
      studyScope: 'classification',
      studyClassification: classification,
      studyMode: true,
      studyAttempts: 0,
      studyCorrect: 0,
      ...question,
    })
  },

  setStudyAnswerMode: (mode) => {
    const state = get()
    if (state.studyAnswerMode === mode) return
    const next = { ...state, studyAnswerMode: mode }
    const question = makeQuestion(next, state.studyKind, null, null)
    set({
      studyAnswerMode: mode,
      studyMode: true,
      studyAttempts: 0,
      studyCorrect: 0,
      ...question,
    })
  },

  submitStudyChoice: (label) => {
    const state = get()
    if (!state.studyMode || state.studyRevealed) return
    if (state.studyAnswerMode !== 'choice' || state.studyChoices.length < 2) return
    const correct = correctLabel(state)
    if (!correct) return
    const ok = normalizeAnswer(label) === normalizeAnswer(correct)
    set({
      studyRevealed: true,
      studyPicked: label,
      studyResult: ok ? 'correct' : 'incorrect',
      studyAttempts: state.studyAttempts + 1,
      studyCorrect: state.studyCorrect + (ok ? 1 : 0),
    })
  },

  submitStudyAnswer: (raw) => {
    const state = get()
    if (!state.studyMode || state.studyRevealed || state.studyAnswerMode !== 'type') return
    if (normalizeAnswer(raw).length === 0) return
    const ok = answerIsCorrect(state, raw)
    set({
      studyRevealed: true,
      studyPicked: raw,
      studyResult: ok ? 'correct' : 'incorrect',
      studyAttempts: state.studyAttempts + 1,
      studyCorrect: state.studyCorrect + (ok ? 1 : 0),
    })
  },

  requestPreset: (preset) => {
    const pose = CAMERA_PRESETS[preset]
    set({
      cameraRequest: nextCamera({
        kind: 'preset',
        preset,
        position: pose.position,
        target: pose.target,
      }),
    })
  },

  focusCamera: (position, target) => {
    set({ cameraRequest: nextCamera({ kind: 'focus', position, target }) })
  },

  frameRegion: (regionId) => {
    const pose = regionFocus(regionId)
    set({ activeRegion: regionId })
    if (!pose) return
    set({ cameraRequest: nextCamera({ kind: 'focus', position: pose.position, target: pose.target }) })
  },

  setModelState: (modelState) => set({ modelState }),

  retryModel: () => set({ modelState: 'loading', retryKey: get().retryKey + 1 }),

  setHelpOpen: (helpOpen) => set({ helpOpen }),

  setMobilePanel: (mobilePanel) => set({ mobilePanel }),
}))

export function useHasSelection(): boolean {
  return useAnatomyStore((state) => state.selectedBoneId !== null)
}
