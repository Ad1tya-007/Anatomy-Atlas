import { getBone, quizBones } from '@/data/bones'
import { allLandmarks } from '@/data/landmarks'
import { CAMERA_PRESETS, regionFocus } from '@/utils/camera'
import type {
  BoneClassification,
  CameraPresetName,
  CameraRequest,
  MobilePanel,
  ModelState,
  SelectBoneOptions,
  StudyKind,
  Vec3,
} from '@/types/anatomy'
import { create } from 'zustand'

interface AnatomyState {
  selectedBoneId: string | null
  selectedLandmarkId: string | null
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
  cameraRequest: CameraRequest
  modelState: ModelState
  retryKey: number
  helpOpen: boolean
  mobilePanel: MobilePanel

  selectBone: (id: string, options?: SelectBoneOptions) => void
  selectLandmark: (id: string) => void
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

function pickBone(exclude: string | null): string {
  const pool = quizBones().map((bone) => bone.id)
  const choices = pool.filter((id) => id !== exclude)
  const source = choices.length > 0 ? choices : pool
  return source[Math.floor(Math.random() * source.length)] ?? pool[0] ?? 'femur_left'
}

function pickLandmark(exclude: string | null): { boneId: string; landmarkId: string } {
  const pool = allLandmarks.filter((record) => getBone(record.boneId)?.quiz)
  const choices = pool.filter((record) => record.landmark.id !== exclude)
  const source = choices.length > 0 ? choices : pool
  const choice = source[Math.floor(Math.random() * source.length)]
  if (!choice) return { boneId: 'femur_left', landmarkId: 'femur_left_greater_trochanter' }
  return { boneId: choice.boneId, landmarkId: choice.landmark.id }
}

function questionFor(kind: StudyKind, boneId: string | null, landmarkId: string | null) {
  if (kind === 'landmark') {
    const next = pickLandmark(landmarkId)
    return { studyBoneId: next.boneId, studyLandmarkId: next.landmarkId, selectedBoneId: next.boneId, selectedLandmarkId: next.landmarkId }
  }
  const nextBone = pickBone(boneId)
  return { studyBoneId: nextBone, studyLandmarkId: null, selectedBoneId: nextBone, selectedLandmarkId: null }
}

function openInfoOnMobile(): MobilePanel | undefined {
  if (typeof window === 'undefined') return undefined
  return window.matchMedia('(max-width: 1023px)').matches ? 'info' : undefined
}

export const useAnatomyStore = create<AnatomyState>((set, get) => ({
  selectedBoneId: null,
  selectedLandmarkId: null,
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
  cameraRequest: { id: 0, kind: 'preset', preset: 'default', ...CAMERA_PRESETS.default },
  modelState: 'loading',
  retryKey: 0,
  helpOpen: false,
  mobilePanel: 'none',

  selectBone: (id, options) => {
    const bone = getBone(id)
    const fromStudy = options?.fromStudy === true
    const landmarkId = options && 'landmarkId' in options ? (options.landmarkId ?? null) : null
    const mobile = !fromStudy ? openInfoOnMobile() : undefined
    set({
      selectedBoneId: id,
      selectedLandmarkId: landmarkId,
      activeRegion: bone?.region ?? get().activeRegion,
      studyMode: fromStudy ? get().studyMode : false,
      studyRevealed: fromStudy ? get().studyRevealed : false,
      mobilePanel: mobile ?? (get().mobilePanel === 'nav' ? 'none' : get().mobilePanel),
    })
  },

  selectLandmark: (id) => {
    const record = allLandmarks.find((item) => item.landmark.id === id)
    if (!record) return
    if (get().studyMode && !get().studyRevealed) return
    set({
      selectedBoneId: record.boneId,
      selectedLandmarkId: id,
      activeRegion: getBone(record.boneId)?.region ?? get().activeRegion,
    })
  },

  hoverBone: (id) => {
    if (get().hoveredBoneId === id) return
    set({ hoveredBoneId: id })
  },

  clearSelection: () => {
    set({
      selectedBoneId: null,
      selectedLandmarkId: null,
      isolated: false,
      studyMode: false,
      studyRevealed: false,
      studyBoneId: null,
      studyLandmarkId: null,
    })
  },

  toggleIsolate: () => {
    if (!get().selectedBoneId) return
    set({ isolated: !get().isolated })
  },

  clearIsolation: () => set({ isolated: false }),

  setClassification: (classification) => set({ classification }),

  setShowBones: (value) => set({ showBones: value }),
  setShowLabels: (value) => set({ showLabels: value }),
  setShowLandmarks: (value) => set({ showLandmarks: value }),
  toggleLandmarks: () => set({ showLandmarks: !get().showLandmarks }),

  enterStudy: (kind = 'bone') => {
    const question = questionFor(kind, null, null)
    set({
      studyMode: true,
      studyKind: kind,
      studyRevealed: false,
      isolated: false,
      helpOpen: false,
      mobilePanel: 'none',
      ...question,
    })
  },

  exitStudy: () => {
    set({ studyMode: false, studyRevealed: false })
  },

  revealStudy: () => set({ studyRevealed: true }),

  nextStudy: () => {
    const question = questionFor(get().studyKind, get().studyBoneId, get().studyLandmarkId)
    set({ studyRevealed: false, isolated: false, ...question })
  },

  setStudyKind: (kind) => {
    const question = questionFor(kind, null, null)
    set({ studyKind: kind, studyRevealed: false, studyMode: true, ...question })
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
