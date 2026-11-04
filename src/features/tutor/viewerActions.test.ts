import { getDoc } from '@/features/tutor/corpus'
import { tutorErrorMessage, viewerContext } from '@/features/tutor/tutorChat'
import { openCitation, runViewerTool, undoViewerAction } from '@/features/tutor/viewerActions'
import { useAnatomyStore } from '@/store/anatomyStore'
import { beforeEach, describe, expect, it } from 'vitest'

const initial = useAnatomyStore.getState()
const store = () => useAnatomyStore.getState()

beforeEach(() => {
  useAnatomyStore.setState(initial, true)
})

describe('runViewerTool', () => {
  it('selects structures and describes what it did', () => {
    expect(runViewerTool('select_bone', { boneId: 'femur_right' })).toMatchObject({
      output: { ok: true },
      note: 'Selected the right femur',
    })
    expect(store().selectedBoneId).toBe('femur_right')

    runViewerTool('select_landmark', { landmarkId: 'axis_dens' })
    expect(store()).toMatchObject({ selectedBoneId: 'axis', selectedLandmarkId: 'axis_dens' })

    expect(runViewerTool('select_joint', { jointId: 'knee', side: 'right' }).note).toBe('Showed the knee joint')
    expect(store()).toMatchObject({ selectedJointId: 'knee', jointSide: 'right' })
  })

  it('changes the look, section, and spread', () => {
    runViewerTool('set_look', { look: 'radiograph' })
    runViewerTool('set_section', { axis: 'coronal', amount: 0.3 })
    expect(store()).toMatchObject({ look: 'radiograph', sectionAxis: 'coronal', sectionAmount: 0.3 })
    runViewerTool('set_spread', { amount: 0.8 })
    expect(store()).toMatchObject({ spread: 0.8, sectionAxis: 'off' })
  })

  it('starts walks and scoped quizzes', () => {
    runViewerTool('start_walk', { walkId: 'knee_bones' })
    expect(store()).toMatchObject({ walkId: 'knee_bones', walkIndex: 0 })

    const result = runViewerTool('start_quiz', { kind: 'bone', region: 'upper-limb', answerMode: 'choice' })
    expect(result.note).toBe('Started a bone quiz on the upper limb')
    expect(store()).toMatchObject({
      studyMode: true,
      walkId: null,
      studyScope: 'region',
      studyRegionId: 'upper-limb',
      studyAnswerMode: 'choice',
      studyQueue: 'practice',
    })
  })

  it('refuses unknown tools and ids without touching the viewer', () => {
    store().selectBone('tibia_left')
    expect(runViewerTool('select_bone', { boneId: 'wishbone' }).output.ok).toBe(false)
    expect(runViewerTool('launch_rocket', {}).output.ok).toBe(false)
    expect(runViewerTool('set_spread', { amount: 7 }).output.ok).toBe(false)
    expect(store()).toMatchObject({ selectedBoneId: 'tibia_left', spread: 0 })
  })
})

describe('undoViewerAction', () => {
  it('restores the view from before the action', () => {
    store().selectBone('humerus_left')
    store().setLook('ivory')
    const { before } = runViewerTool('select_bone', { boneId: 'femur_left' })
    runViewerTool('set_spread', { amount: 1 })

    undoViewerAction(before)

    expect(store()).toMatchObject({ selectedBoneId: 'humerus_left', look: 'ivory', spread: 0 })
  })

  it('clears a quiz the tutor started', () => {
    const { before } = runViewerTool('start_quiz', { kind: 'landmark' })
    undoViewerAction(before)
    expect(store()).toMatchObject({ studyMode: false, selectedBoneId: null })
  })
})

it('opens the structure behind a citation', () => {
  openCitation(getDoc('landmark:femur_left_head')!)
  expect(store().selectedLandmarkId).toBe('femur_left_head')
  openCitation(getDoc('walk:hip_to_foot')!)
  expect(store().walkId).toBe('hip_to_foot')
})

describe('viewerContext', () => {
  it('reports the most specific selection', () => {
    store().selectLandmark('femur_left_head')
    expect(viewerContext()).toEqual({
      selection: { kind: 'landmark', id: 'femur_left_head' },
      look: 'atlas',
      studying: false,
    })
  })

  it('hides the selection during an unanswered study question', () => {
    store().enterStudy('bone')
    expect(store().selectedBoneId).not.toBeNull()
    expect(viewerContext()).toMatchObject({ selection: null, studying: true })
  })
})

it('tutorErrorMessage prefers the server message', () => {
  expect(tutorErrorMessage(new Error('{"error":"The tutor is busy."}'))).toBe('The tutor is busy.')
  expect(tutorErrorMessage(new Error('Failed to fetch'))).toMatch(/Could not reach the tutor/)
})
