import { getBone } from '@/data/bones'
import { getLandmark } from '@/data/landmarks'
import { resolvedStops, walks } from '@/data/walks'
import { NEW_CARDS_PER_DAY } from '@/features/srs/queue'
import { createMemoryRepository } from '@/features/srs/repository'
import { setRepository, useSrsStore } from '@/features/srs/srsStore'
import type { StudyAnswer } from '@/features/srs/types'
import { correctLabel } from '@/features/study/engine'
import { onStudyAnswer, useAnatomyStore } from '@/store/anatomyStore'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

const initial = useAnatomyStore.getState()
const store = () => useAnatomyStore.getState()

function wrongChoice(): string {
  const state = store()
  const correct = correctLabel(state.studyKind, state.studyBoneId, state.studyLandmarkId)
  return state.studyChoices.find((choice) => choice !== correct)!
}

beforeEach(() => {
  useAnatomyStore.setState(initial, true)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('selection', () => {
  it('selects a bone and its region', () => {
    store().selectBone('femur_left')
    expect(store()).toMatchObject({ selectedBoneId: 'femur_left', activeRegion: 'lower-limb', hasSelected: true })
  })

  it('selects a landmark together with its bone', () => {
    store().selectLandmark('femur_left_greater_trochanter')
    expect(store()).toMatchObject({ selectedBoneId: 'femur_left', selectedLandmarkId: 'femur_left_greater_trochanter' })
  })

  it('selects a paired joint on the requested side', () => {
    store().selectJoint('glenohumeral', 'right')
    expect(store()).toMatchObject({
      selectedJointId: 'glenohumeral',
      jointSide: 'right',
      selectedBoneId: 'scapula_right',
    })
  })

  it('clears everything', () => {
    store().selectJoint('knee')
    store().clearSelection()
    expect(store()).toMatchObject({ selectedBoneId: null, selectedJointId: null, isolated: false })
  })

  it('compares sides only for paired bones', () => {
    store().selectBone('sacrum')
    store().toggleCompare()
    expect(store().compareSides).toBe(false)
    store().selectBone('femur_left')
    store().toggleCompare()
    expect(store().compareSides).toBe(true)
    store().selectBone('femur_right')
    expect(store().compareSides).toBe(true)
    store().selectBone('tibia_left')
    expect(store().compareSides).toBe(false)
  })

  it('isolates and restores the selected bone', () => {
    store().toggleIsolate()
    expect(store().isolated).toBe(false)
    store().selectBone('femur_left')
    store().toggleIsolate()
    expect(store().isolated).toBe(true)
    store().clearIsolation()
    expect(store().isolated).toBe(false)
  })
})

describe('viewer settings', () => {
  it('keeps the exploded view and the section exclusive', () => {
    store().setSectionAxis('sagittal')
    store().setSpread(0.5)
    expect(store()).toMatchObject({ spread: 0.5, sectionAxis: 'off' })
    store().setSectionAxis('coronal')
    expect(store()).toMatchObject({ spread: 0, sectionAxis: 'coronal' })
  })

  it('clamps the section amount and spread', () => {
    store().setSectionAmount(2)
    store().setSpread(-1)
    expect(store()).toMatchObject({ sectionAmount: 1, spread: 0 })
  })

  it('issues a new camera request for every preset', () => {
    const before = store().cameraRequest.id
    store().requestPreset('front')
    expect(store().cameraRequest).toMatchObject({ kind: 'preset', preset: 'front' })
    expect(store().cameraRequest.id).toBeGreaterThan(before)
  })
})

describe('guided walks', () => {
  it('steps through every stop and exits after the last one', () => {
    const walk = walks[0]!
    const stops = resolvedStops(walk)
    store().startWalk(walk.id)
    expect(store()).toMatchObject({ walkId: walk.id, walkIndex: 0, selectedBoneId: stops[0]!.boneId })
    store().stepWalk(-1)
    expect(store().walkIndex).toBe(0)
    for (let index = 1; index < stops.length; index += 1) {
      store().stepWalk(1)
      expect(store().walkIndex).toBe(index)
    }
    store().stepWalk(1)
    expect(store().walkId).toBeNull()
  })

  it('leaves the walk when the user selects something else', () => {
    store().startWalk(walks[0]!.id)
    store().selectBone('sacrum')
    expect(store().walkId).toBeNull()
  })
})

describe('study mode', () => {
  it('starts a bone question with the answer hidden', () => {
    store().enterStudy('bone')
    const state = store()
    expect(state).toMatchObject({ studyMode: true, studyRevealed: false, studyAttempts: 0 })
    expect(getBone(state.studyBoneId)?.quiz).toBe(true)
    expect(state.selectedBoneId).toBe(state.studyBoneId)
  })

  it('scores multiple-choice answers once per question', () => {
    store().setStudyAnswerMode('choice')
    const correct = correctLabel(store().studyKind, store().studyBoneId, store().studyLandmarkId)!
    store().submitStudyChoice(correct)
    expect(store()).toMatchObject({ studyResult: 'correct', studyAttempts: 1, studyCorrect: 1, studyRevealed: true })
    store().submitStudyChoice(correct)
    expect(store().studyAttempts).toBe(1)

    store().nextStudy()
    store().submitStudyChoice(wrongChoice())
    expect(store()).toMatchObject({ studyResult: 'incorrect', studyAttempts: 2, studyCorrect: 1 })
  })

  it('scores typed answers and ignores blank ones', () => {
    store().setStudyAnswerMode('type')
    store().submitStudyAnswer('   ')
    expect(store().studyAttempts).toBe(0)
    store().submitStudyAnswer(getBone(store().studyBoneId)!.name.toUpperCase())
    expect(store()).toMatchObject({ studyResult: 'correct', studyCorrect: 1 })
  })

  it('only reveals on request in reveal mode', () => {
    store().enterStudy('bone')
    store().revealStudy()
    expect(store().studyRevealed).toBe(true)
    store().setStudyAnswerMode('type')
    store().revealStudy()
    expect(store().studyRevealed).toBe(false)
  })

  it('hides the answer bone in locate mode until the user picks', () => {
    store().setStudyAnswerMode('locate')
    expect(store().selectedBoneId).toBeNull()
    store().submitStudyLocate({ boneId: store().studyBoneId! })
    expect(store()).toMatchObject({ studyResult: 'correct', selectedBoneId: store().studyBoneId })
  })

  it('pulses a wrong locate pick before marking it incorrect', () => {
    vi.useFakeTimers()
    store().setStudyAnswerMode('locate')
    const answer = store().studyBoneId!
    const wrong = answer === 'sacrum' ? 'coccyx' : 'sacrum'
    store().submitStudyLocate({ boneId: wrong })
    expect(store()).toMatchObject({ locatePulseBoneId: wrong, studyRevealed: false })
    vi.advanceTimersByTime(400)
    expect(store()).toMatchObject({ studyResult: 'incorrect', locatePulseBoneId: null, selectedBoneId: answer })
  })

  it('grades landmark locate picks', () => {
    store().setStudyAnswerMode('locate')
    store().setStudyKind('landmark')
    const landmarkId = store().studyLandmarkId!
    expect(getLandmark(landmarkId)).toBeDefined()
    store().submitStudyLocate({ landmarkId })
    expect(store()).toMatchObject({ studyResult: 'correct', selectedLandmarkId: landmarkId })
  })

  it('resets the score when the scope changes', () => {
    store().setStudyAnswerMode('type')
    store().submitStudyAnswer('definitely wrong')
    expect(store().studyAttempts).toBe(1)
    store().setStudyRegion('lower-limb')
    expect(store()).toMatchObject({ studyAttempts: 0, studyScope: 'region', studyRegionId: 'lower-limb' })
    expect(getBone(store().studyBoneId)?.region).toBe('lower-limb')
    store().setStudyClassification('long')
    expect(getBone(store().studyBoneId)?.classification).toBe('long')
    store().setStudyScope('all')
    expect(store().studyScope).toBe('all')
  })

  it('leaves study mode when the user selects a bone directly', () => {
    store().enterStudy('bone')
    store().selectBone('sacrum')
    expect(store().studyMode).toBe(false)
  })

  it('exits cleanly', () => {
    store().enterStudy('landmark')
    store().exitStudy()
    expect(store()).toMatchObject({ studyMode: false, studyAttempts: 0, studyChoices: [] })
  })
})

function capture(): StudyAnswer[] {
  const answers: StudyAnswer[] = []
  const stop = onStudyAnswer((answer) => answers.push(answer))
  onTestFinished(stop)
  return answers
}

describe('answer events', () => {
  it('reports each scored answer once with its response time', () => {
    const answers = capture()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-03-02T09:00:00Z'))
    store().setStudyAnswerMode('choice')
    vi.setSystemTime(new Date('2026-03-02T09:00:04Z'))
    store().submitStudyChoice(wrongChoice())
    store().submitStudyChoice(store().studyChoices[0]!)
    expect(answers).toHaveLength(1)
    expect(answers[0]).toMatchObject({ kind: 'bone', answerMode: 'choice', correct: false, responseMs: 4000 })
    expect(answers[0]!.boneId).toBe(store().studyBoneId)
  })

  it('takes a self-grade in reveal mode, once, only after revealing', () => {
    const answers = capture()
    store().enterStudy('landmark')
    store().gradeStudy(3)
    expect(answers).toHaveLength(0)
    store().revealStudy()
    store().gradeStudy(4)
    store().gradeStudy(1)
    expect(answers).toHaveLength(1)
    expect(answers[0]).toMatchObject({ kind: 'landmark', selfGrade: 4, correct: true })
    expect(answers[0]!.landmarkId).toBe(store().studyLandmarkId)
    expect(store()).toMatchObject({ studyGrade: 4, studyResult: 'correct', studyAttempts: 1, studyCorrect: 1 })
  })
})

describe('review mode', () => {
  beforeEach(async () => {
    setRepository(createMemoryRepository())
    await useSrsStore.getState().load()
  })

  it('introduces new cards until the daily limit, then reports caught up', async () => {
    store().setStudyScope('region')
    store().setStudyRegion('lower-limb')
    store().setStudyQueue('review')
    const seen = new Set<string>()
    for (let index = 0; index < NEW_CARDS_PER_DAY; index += 1) {
      expect(store().studyCaughtUp).toBe(false)
      const boneId = store().studyBoneId!
      expect(getBone(boneId)?.region).toBe('lower-limb')
      seen.add(boneId)
      store().revealStudy()
      await useSrsStore.getState().record({
        kind: 'bone',
        boneId,
        landmarkId: null,
        answerMode: 'reveal',
        correct: true,
        responseMs: 1000,
        selfGrade: 3,
      })
      store().nextStudy()
    }
    expect(seen.size).toBe(NEW_CARDS_PER_DAY)
    expect(store()).toMatchObject({ studyCaughtUp: true, studyBoneId: null, selectedBoneId: null })
    expect(store().studyNextDue).not.toBeNull()
  })

  it('asks the card that is due', async () => {
    const past = new Date(Date.now() - 30 * 86_400_000)
    await useSrsStore.getState().record(
      {
        kind: 'bone',
        boneId: 'tibia_left',
        landmarkId: null,
        answerMode: 'type',
        correct: false,
        responseMs: 1,
        selfGrade: null,
      },
      past,
    )
    store().setStudyQueue('review')
    expect(store()).toMatchObject({ studyQueue: 'review', studyBoneId: 'tibia_left', selectedBoneId: 'tibia_left' })
    expect(store().studyRemaining).toBeGreaterThan(1)
  })

  it('switches back to random practice', () => {
    store().setStudyQueue('review')
    store().setStudyQueue('practice')
    expect(store()).toMatchObject({ studyQueue: 'practice', studyCaughtUp: false, studyRemaining: 0 })
    expect(store().studyBoneId).not.toBeNull()
  })
})

describe('restoreView', () => {
  const camera = { position: [0.5, 0.2, 1] as [number, number, number], target: [0, 0, 0] as [number, number, number] }

  it('restores a landmark, look, and section', () => {
    store().restoreView({
      boneId: 'femur_left',
      landmarkId: 'femur_left_greater_trochanter',
      look: 'radiograph',
      sectionAxis: 'sagittal',
      sectionAmount: 0.3,
    })
    expect(store()).toMatchObject({
      selectedBoneId: 'femur_left',
      selectedLandmarkId: 'femur_left_greater_trochanter',
      look: 'radiograph',
      sectionAxis: 'sagittal',
      sectionAmount: 0.3,
    })
  })

  it('restores a joint side and the exploded view', () => {
    store().restoreView({ jointId: 'knee', jointSide: 'right', spread: 0.65 })
    expect(store()).toMatchObject({ selectedJointId: 'knee', jointSide: 'right', spread: 0.65 })
  })

  it('restores a walk at the shared step', () => {
    store().restoreView({ walkId: 'shoulder_to_hand', walkIndex: 2 })
    expect(store()).toMatchObject({ walkId: 'shoulder_to_hand', walkIndex: 2 })
  })

  it('hands the camera to the next selection focus exactly once', () => {
    store().restoreView({ boneId: 'femur_left', camera })
    expect(store().takeRestoreCamera()).toEqual(camera)
    expect(store().takeRestoreCamera()).toBeNull()
  })

  it('moves the camera directly when nothing is selected', () => {
    store().restoreView({ camera })
    expect(store().restoreCamera).toBeNull()
    expect(store().cameraRequest).toMatchObject({ kind: 'focus', ...camera })
  })
})
