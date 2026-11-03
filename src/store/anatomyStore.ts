import { contralateralId, getBone } from '@/data/bones'
import { highlightedIds } from '@/utils/anatomy'
import { getJoint, isPairedJoint, resolveJointBones } from '@/data/joints'
import { allLandmarks, getLandmark } from '@/data/landmarks'
import { getWalk, resolvedStops } from '@/data/walks'
import { pickReview } from '@/features/srs/review'
import { useSrsStore } from '@/features/srs/srsStore'
import { cardIdFor, type Grade, type StudyAnswer } from '@/features/srs/types'
import {
  answerIsCorrect,
  buildQuestion,
  buildQuestionFor,
  correctLabel,
  defaultStudyRegion,
  normalizeAnswer,
  type StudyConfig,
} from '@/features/study/engine'
import { CAMERA_PRESETS, regionFocus } from '@/utils/camera'
import { cancelArrival } from '@/utils/specimenMotion'
import type {
  AnatomicalRegion,
  BoneClassification,
  CameraPose,
  CameraPresetName,
  CameraRequest,
  LookName,
  MobilePanel,
  ModelState,
  SectionAxis,
  SelectBoneOptions,
  StudyAnswerMode,
  StudyKind,
  StudyQueue,
  StudyResult,
  StudyScope,
  Vec3,
  ViewState,
  WalkStop,
} from '@/types/anatomy'
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
  studyLocateNarrowed: boolean
  studyLocateLandmarkIds: string[]
  locatePulseBoneId: string | null
  studyQueue: StudyQueue
  /** Review mode found nothing due in scope. */
  studyCaughtUp: boolean
  /** ISO time the next card in scope comes due, when caught up. */
  studyNextDue: string | null
  /** Cards left in today's review queue, counting the current one. */
  studyRemaining: number
  /** When the current question appeared, for response-time grading. */
  studyStartedAt: number
  /** The learner's own grade in reveal mode. */
  studyGrade: Grade | null
  look: LookName
  sectionAxis: SectionAxis
  sectionAmount: number
  spread: number
  hasSelected: boolean
  cameraRequest: CameraRequest
  /** Where the camera settled last. Written by the camera controller, read by the URL. */
  cameraPose: CameraPose | null
  /** A restored link's camera. The next selection focus uses it once instead of framing the bone. */
  restoreCamera: CameraPose | null
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
  submitStudyLocate: (target: { boneId?: string; landmarkId?: string }) => void
  gradeStudy: (grade: Grade) => void
  setStudyQueue: (queue: StudyQueue) => void
  setLook: (look: LookName) => void
  setSectionAxis: (axis: SectionAxis) => void
  setSectionAmount: (amount: number) => void
  setSpread: (amount: number) => void
  requestPreset: (preset: CameraPresetName) => void
  focusCamera: (position: Vec3, target: Vec3) => void
  frameRegion: (regionId: string) => void
  setCameraPose: (pose: CameraPose) => void
  takeRestoreCamera: () => CameraPose | null
  restoreView: (view: ViewState) => void
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

interface QuestionPatch {
  studyKind: StudyKind
  studyRevealed: boolean
  studyBoneId: string | null
  studyLandmarkId: string | null
  selectedBoneId: string | null
  selectedLandmarkId: string | null
  studyChoices: string[]
  studyPicked: null
  studyResult: null
  studyScopeFallback: boolean
  studyLocateNarrowed: boolean
  studyLocateLandmarkIds: string[]
  locatePulseBoneId: null
  selectedJointId: null
  jointSide: null
  compareSides: false
  walkId: null
  walkIndex: number
  isolated: false
  studyCaughtUp: boolean
  studyNextDue: string | null
  studyRemaining: number
  studyStartedAt: number
  studyGrade: null
}

type AnswerListener = (answer: StudyAnswer) => void
const answerListeners = new Set<AnswerListener>()

/** Notifies the listener each time a study question is answered. Returns an unsubscribe function. */
export function onStudyAnswer(listener: AnswerListener): () => void {
  answerListeners.add(listener)
  return () => answerListeners.delete(listener)
}

function emitAnswer(state: AnatomyState, correct: boolean, selfGrade: Grade | null = null): void {
  if (!state.studyBoneId) return
  const answer: StudyAnswer = {
    kind: state.studyKind,
    boneId: state.studyBoneId,
    landmarkId: state.studyKind === 'landmark' ? state.studyLandmarkId : null,
    answerMode: state.studyAnswerMode,
    correct,
    responseMs: state.studyStartedAt > 0 ? Date.now() - state.studyStartedAt : null,
    selfGrade,
  }
  for (const listener of answerListeners) listener(answer)
}

let locateTimer: ReturnType<typeof setTimeout> | null = null

function clearLocateTimer(): void {
  if (locateTimer !== null) {
    clearTimeout(locateTimer)
    locateTimer = null
  }
}

function makeQuestion(
  state: StudyConfig & { studyQueue: StudyQueue },
  kind: StudyKind,
  excludeBone: string | null,
  excludeLandmark: string | null,
): QuestionPatch {
  clearLocateTimer()
  const shared = {
    studyKind: kind,
    studyRevealed: false,
    studyPicked: null,
    studyResult: null,
    locatePulseBoneId: null,
    selectedJointId: null,
    jointSide: null,
    compareSides: false,
    walkId: null,
    walkIndex: 0,
    isolated: false,
    studyStartedAt: Date.now(),
    studyGrade: null,
  } as const
  let remaining = 0
  let question
  if (state.studyQueue === 'review') {
    const excludeCard = excludeBone ? cardIdFor(kind, excludeBone, excludeLandmark) : null
    const pick = pickReview(state, kind, useSrsStore.getState(), excludeCard, new Date())
    if (!pick.target) {
      return {
        ...shared,
        studyBoneId: null,
        studyLandmarkId: null,
        selectedBoneId: null,
        selectedLandmarkId: null,
        studyChoices: [],
        studyScopeFallback: false,
        studyLocateNarrowed: false,
        studyLocateLandmarkIds: [],
        studyCaughtUp: true,
        studyNextDue: pick.nextDue?.toISOString() ?? null,
        studyRemaining: 0,
      }
    }
    remaining = pick.remaining
    question = buildQuestionFor(state, pick.target)
  } else {
    question = buildQuestion(state, kind, excludeBone, excludeLandmark)
  }
  const locate = state.studyAnswerMode === 'locate'
  return {
    ...shared,
    studyCaughtUp: false,
    studyNextDue: null,
    studyRemaining: remaining,
    studyBoneId: question.boneId,
    studyLandmarkId: question.landmarkId,
    selectedBoneId: locate ? null : question.boneId,
    selectedLandmarkId: locate ? null : question.landmarkId,
    studyChoices: question.choices,
    studyScopeFallback: question.fallback,
    studyLocateNarrowed: question.locateNarrowed,
    studyLocateLandmarkIds: question.locateLandmarkIds,
  }
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
  studyLocateNarrowed: false,
  studyLocateLandmarkIds: [] as string[],
  locatePulseBoneId: null as string | null,
  studyCaughtUp: false,
  studyNextDue: null,
  studyGrade: null,
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
  studyLocateNarrowed: false,
  studyLocateLandmarkIds: [],
  locatePulseBoneId: null,
  studyQueue: 'practice',
  studyCaughtUp: false,
  studyNextDue: null,
  studyRemaining: 0,
  studyStartedAt: 0,
  studyGrade: null,
  look: 'atlas',
  sectionAxis: 'off',
  sectionAmount: 0.55,
  spread: 0,
  hasSelected: false,
  cameraRequest: { id: 0, kind: 'preset', preset: 'default', ...CAMERA_PRESETS.default },
  cameraPose: null,
  restoreCamera: null,
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
    const keepCompare = state.compareSides && !state.selectedJointId && (id === state.selectedBoneId || id === partner)
    const mobile = !fromStudy ? openInfoOnMobile() : undefined
    if (!fromStudy) clearLocateTimer()
    set({
      selectedBoneId: id,
      selectedLandmarkId: landmarkId,
      hasSelected: true,
      locatePulseBoneId: fromStudy ? state.locatePulseBoneId : null,
      studyLocateNarrowed: fromStudy ? state.studyLocateNarrowed : false,
      studyLocateLandmarkIds: fromStudy ? state.studyLocateLandmarkIds : [],
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
      hasSelected: true,
      selectedJointId: null,
      jointSide: null,
      compareSides: false,
      walkId: null,
      walkIndex: 0,
      activeRegion: getBone(record.boneId)?.region ?? state.activeRegion,
    })
  },

  selectJoint: (id, side) => {
    clearLocateTimer()
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
      hasSelected: true,
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
    clearLocateTimer()
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
      hasSelected: true,
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
    clearLocateTimer()
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
      state.studyScope === 'region'
        ? (state.studyRegionId ?? defaultStudyRegion(state.activeRegion))
        : state.studyRegionId
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
      hasSelected: state.hasSelected || question.selectedBoneId !== null,
      ...question,
    })
  },

  exitStudy: () => {
    clearLocateTimer()
    set({ ...clearedStudy })
  },

  revealStudy: () => {
    const state = get()
    if (state.studyAnswerMode === 'type' || state.studyAnswerMode === 'locate') return
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
    const studyRegionId =
      scope === 'region' ? (state.studyRegionId ?? defaultStudyRegion(state.activeRegion)) : state.studyRegionId
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
    const correct = correctLabel(state.studyKind, state.studyBoneId, state.studyLandmarkId)
    if (!correct) return
    const ok = normalizeAnswer(label) === normalizeAnswer(correct)
    set({
      studyRevealed: true,
      studyPicked: label,
      studyResult: ok ? 'correct' : 'incorrect',
      studyAttempts: state.studyAttempts + 1,
      studyCorrect: state.studyCorrect + (ok ? 1 : 0),
    })
    emitAnswer(state, ok)
  },

  submitStudyAnswer: (raw) => {
    const state = get()
    if (!state.studyMode || state.studyRevealed || state.studyAnswerMode !== 'type') return
    if (normalizeAnswer(raw).length === 0) return
    const ok = answerIsCorrect(state.studyKind, state.studyBoneId, state.studyLandmarkId, raw)
    set({
      studyRevealed: true,
      studyPicked: raw,
      studyResult: ok ? 'correct' : 'incorrect',
      studyAttempts: state.studyAttempts + 1,
      studyCorrect: state.studyCorrect + (ok ? 1 : 0),
    })
    emitAnswer(state, ok)
  },

  submitStudyLocate: (target) => {
    const state = get()
    if (!state.studyMode || state.studyRevealed || state.studyAnswerMode !== 'locate') return
    if (state.locatePulseBoneId) return
    const finish = (ok: boolean) => {
      const now = get()
      if (!now.studyMode || now.studyRevealed || now.studyAnswerMode !== 'locate') return
      if (now.studyBoneId !== state.studyBoneId || now.studyLandmarkId !== state.studyLandmarkId) return
      clearLocateTimer()
      set({
        studyRevealed: true,
        studyResult: ok ? 'correct' : 'incorrect',
        studyAttempts: now.studyAttempts + 1,
        studyCorrect: now.studyCorrect + (ok ? 1 : 0),
        locatePulseBoneId: null,
        selectedBoneId: now.studyBoneId,
        selectedLandmarkId: now.studyKind === 'landmark' ? now.studyLandmarkId : null,
        hasSelected: true,
      })
      emitAnswer(now, ok)
    }
    if (state.studyKind === 'bone') {
      if (!target.boneId) return
      const expected = highlightedIds(state.studyBoneId)
      if (expected.has(target.boneId)) {
        finish(true)
        return
      }
      set({ locatePulseBoneId: target.boneId })
      const tokenBone = state.studyBoneId
      const tokenLandmark = state.studyLandmarkId
      locateTimer = setTimeout(() => {
        const now = get()
        if (now.studyBoneId !== tokenBone || now.studyLandmarkId !== tokenLandmark) return
        finish(false)
      }, 400)
      return
    }
    if (!target.landmarkId) return
    if (target.landmarkId === state.studyLandmarkId) {
      finish(true)
      return
    }
    const pulse = getLandmark(target.landmarkId)?.boneId ?? null
    set({ locatePulseBoneId: pulse })
    const tokenBone = state.studyBoneId
    const tokenLandmark = state.studyLandmarkId
    locateTimer = setTimeout(() => {
      const now = get()
      if (now.studyBoneId !== tokenBone || now.studyLandmarkId !== tokenLandmark) return
      finish(false)
    }, 400)
  },

  gradeStudy: (grade) => {
    const state = get()
    if (!state.studyMode || !state.studyRevealed || state.studyGrade !== null) return
    if (state.studyAnswerMode !== 'reveal' && !(state.studyAnswerMode === 'choice' && state.studyChoices.length < 2)) {
      return
    }
    const ok = grade > 1
    set({
      studyGrade: grade,
      studyResult: ok ? 'correct' : 'incorrect',
      studyAttempts: state.studyAttempts + 1,
      studyCorrect: state.studyCorrect + (ok ? 1 : 0),
    })
    emitAnswer(state, ok, grade)
  },

  setStudyQueue: (queue) => {
    const state = get()
    if (state.studyQueue === queue && state.studyMode) return
    const question = makeQuestion({ ...state, studyQueue: queue }, state.studyKind, null, null)
    set({
      studyQueue: queue,
      studyMode: true,
      studyAttempts: 0,
      studyCorrect: 0,
      helpOpen: false,
      hasSelected: state.hasSelected || question.selectedBoneId !== null,
      ...question,
    })
  },

  setLook: (look) => set({ look }),

  setSectionAxis: (axis) => {
    if (axis === 'off') {
      set({ sectionAxis: 'off' })
      return
    }
    cancelArrival(0)
    set({ sectionAxis: axis, spread: 0 })
  },

  setSectionAmount: (amount) => set({ sectionAmount: Math.min(1, Math.max(0, amount)) }),

  setSpread: (amount) => {
    const spread = Math.min(1, Math.max(0, amount))
    cancelArrival(spread)
    set({
      spread,
      sectionAxis: spread > 0 ? 'off' : get().sectionAxis,
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

  setCameraPose: (cameraPose) => set({ cameraPose }),

  takeRestoreCamera: () => {
    const pose = get().restoreCamera
    if (pose) set({ restoreCamera: null })
    return pose
  },

  restoreView: (view) => {
    const store = get()
    if (view.walkId) {
      store.startWalk(view.walkId)
      for (let step = 0; step < (view.walkIndex ?? 0); step += 1) store.stepWalk(1)
    } else if (view.jointId) {
      store.selectJoint(view.jointId, view.jointSide)
    } else if (view.boneId) {
      store.selectBone(view.boneId, { landmarkId: view.landmarkId ?? null })
    }
    if (view.look) store.setLook(view.look)
    if (view.spread) {
      store.setSpread(view.spread)
    } else if (view.sectionAxis) {
      store.setSectionAxis(view.sectionAxis)
      if (view.sectionAmount !== undefined) store.setSectionAmount(view.sectionAmount)
    }
    if (!view.camera) return
    if (get().selectedBoneId) set({ restoreCamera: view.camera })
    else store.focusCamera(view.camera.position, view.camera.target)
  },

  setModelState: (modelState) => set({ modelState }),

  retryModel: () => set({ modelState: 'loading', retryKey: get().retryKey + 1 }),

  setHelpOpen: (helpOpen) => set({ helpOpen }),

  setMobilePanel: (mobilePanel) => set({ mobilePanel }),
}))

export function useHasSelection(): boolean {
  return useAnatomyStore((state) => state.selectedBoneId !== null)
}
