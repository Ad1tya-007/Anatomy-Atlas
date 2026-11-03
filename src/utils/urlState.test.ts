import { setGeneratedWalk } from '@/data/walks'
import { CAMERA_PRESETS } from '@/utils/camera'
import { decodeView, encodeView, hasView, viewFromState, type ShareableState } from '@/utils/urlState'
import type { ViewState } from '@/types/anatomy'
import { describe, expect, it } from 'vitest'

const idle: ShareableState = {
  selectedBoneId: null,
  selectedLandmarkId: null,
  selectedJointId: null,
  jointSide: null,
  walkId: null,
  walkIndex: 0,
  studyMode: false,
  studyRevealed: false,
  look: 'atlas',
  sectionAxis: 'off',
  sectionAmount: 0.55,
  spread: 0,
  cameraPose: null,
}

const camera = { position: [0.412, -0.3, 1.25], target: [0, 0.04, -0.1] } as ViewState['camera']

describe('encodeView / decodeView', () => {
  it.each<[string, ViewState]>([
    ['a bone', { boneId: 'femur_left' }],
    ['a landmark', { boneId: 'femur_left', landmarkId: 'femur_left_greater_trochanter' }],
    ['a paired joint with a side', { jointId: 'glenohumeral', jointSide: 'right' }],
    ['a walk step', { walkId: 'shoulder_to_hand', walkIndex: 3 }],
    ['a look and section', { boneId: 'sacrum', look: 'radiograph', sectionAxis: 'sagittal', sectionAmount: 0.3 }],
    ['the exploded view', { look: 'ivory', spread: 0.65 }],
    ['a camera pose', { boneId: 'humerus_right', camera }],
  ])('round-trips %s', (_, view) => {
    expect(decodeView(encodeView(view))).toEqual(view)
  })

  it('omits defaults', () => {
    expect(encodeView({ look: 'atlas', spread: 0 })).toBe('')
    expect(encodeView({ walkId: 'shoulder_to_hand', walkIndex: 0 })).toBe('w=shoulder_to_hand')
  })

  it('keeps links short and readable', () => {
    expect(encodeView({ boneId: 'femur_left', camera })).toBe('b=femur_left&cam=0.412,-0.3,1.25,0,0.04,-0.1')
  })

  it('rounds noisy numbers', () => {
    const encoded = encodeView({
      sectionAxis: 'coronal',
      sectionAmount: 0.123456,
      camera: { position: [1.23456, 0, 0], target: [0, 0, 0] },
    })
    expect(encoded).toBe('sx=coronal&sa=0.12&cam=1.235,0,0,0,0,0')
  })

  it('accepts a leading question mark', () => {
    expect(decodeView('?b=femur_left')).toEqual({ boneId: 'femur_left' })
  })
})

describe('decodeView validation', () => {
  it('returns an empty view for an empty or unrelated query', () => {
    expect(decodeView('')).toEqual({})
    expect(decodeView('utm_source=newsletter&ref=abc')).toEqual({})
  })

  it.each([
    ['an unknown bone', 'b=not_a_bone'],
    ['an unknown landmark', 'l=femur_left_nope'],
    ['an unknown joint', 'j=nope'],
    ['an unknown walk', 'w=nope'],
    ['an unknown look', 'look=sepia'],
    ['an unknown section axis', 'sx=diagonal'],
    ['an out-of-range spread', 'sp=4'],
    ['a negative spread', 'sp=-1'],
    ['a non-numeric spread', 'sp=wide'],
    ['a camera with too few numbers', 'cam=1,2,3'],
    ['a camera with non-numbers', 'cam=1,2,3,a,b,c'],
    ['a camera far outside the scene', 'cam=999,0,0,0,0,0'],
    ['an infinite camera', 'cam=Infinity,0,0,0,0,0'],
  ])('ignores %s', (_, query) => {
    expect(decodeView(query)).toEqual({})
  })

  it('keeps the valid fields of a partly broken link', () => {
    expect(decodeView('b=femur_left&look=sepia&sp=nope&cam=1,2')).toEqual({ boneId: 'femur_left' })
  })

  it('derives the bone from a landmark, ignoring a conflicting bone', () => {
    expect(decodeView('b=tibia_left&l=femur_left_greater_trochanter')).toEqual({
      boneId: 'femur_left',
      landmarkId: 'femur_left_greater_trochanter',
    })
  })

  it('drops a side for a midline joint', () => {
    expect(decodeView('j=pubic_symphysis&side=right')).toEqual({ jointId: 'pubic_symphysis' })
  })

  it('drops a walk step past the end of the walk', () => {
    expect(decodeView('w=shoulder_to_hand&wi=999')).toEqual({ walkId: 'shoulder_to_hand' })
    expect(decodeView('w=shoulder_to_hand&wi=1.5')).toEqual({ walkId: 'shoulder_to_hand' })
  })

  it('prefers a walk over a direct selection', () => {
    expect(decodeView('w=shoulder_to_hand&b=femur_left')).toEqual({ walkId: 'shoulder_to_hand' })
  })

  it('prefers the exploded view over a section, matching the viewer', () => {
    expect(decodeView('sp=0.5&sx=sagittal&sa=0.2')).toEqual({ spread: 0.5 })
  })

  it('ignores a section amount without an axis', () => {
    expect(decodeView('sa=0.4')).toEqual({})
  })
})

describe('viewFromState', () => {
  it('is empty for the initial state', () => {
    expect(hasView(viewFromState(idle))).toBe(false)
  })

  it('captures the selection, look, section, and camera', () => {
    expect(
      viewFromState({
        ...idle,
        selectedBoneId: 'femur_left',
        selectedLandmarkId: 'femur_left_greater_trochanter',
        look: 'ivory',
        sectionAxis: 'transverse',
        sectionAmount: 0.4,
        cameraPose: camera!,
      }),
    ).toEqual({
      landmarkId: 'femur_left_greater_trochanter',
      look: 'ivory',
      sectionAxis: 'transverse',
      sectionAmount: 0.4,
      camera,
    })
  })

  it('captures a joint with its side', () => {
    expect(
      viewFromState({ ...idle, selectedBoneId: 'scapula_left', selectedJointId: 'glenohumeral', jointSide: 'left' }),
    ).toEqual({
      jointId: 'glenohumeral',
      jointSide: 'left',
    })
  })

  it('captures a walk instead of its current bone', () => {
    expect(
      viewFromState({ ...idle, selectedBoneId: 'humerus_left', walkId: 'shoulder_to_hand', walkIndex: 3 }),
    ).toEqual({
      walkId: 'shoulder_to_hand',
      walkIndex: 3,
    })
  })

  it('shares the current bone of a personal walk, not the walk itself', () => {
    setGeneratedWalk({
      id: 'weakest-areas',
      title: 'Weakest',
      summary: '',
      stops: [{ boneId: 'tibia_left', text: '' }],
    })
    expect(viewFromState({ ...idle, selectedBoneId: 'tibia_left', walkId: 'weakest-areas', walkIndex: 0 })).toEqual({
      boneId: 'tibia_left',
    })
  })

  it('round-trips the mastery look', () => {
    expect(decodeView(encodeView({ look: 'mastery' }))).toEqual({ look: 'mastery' })
  })

  it('never reveals the answer to an open study question', () => {
    const studying = { ...idle, selectedBoneId: 'femur_left', studyMode: true, cameraPose: camera! }
    expect(viewFromState(studying)).toEqual({})
    expect(viewFromState({ ...studying, studyRevealed: true })).toEqual({ boneId: 'femur_left', camera })
  })

  it('leaves out the home camera pose', () => {
    expect(viewFromState({ ...idle, cameraPose: CAMERA_PRESETS.default })).toEqual({})
  })

  it('records the exploded view instead of a section', () => {
    expect(viewFromState({ ...idle, spread: 0.65, sectionAxis: 'sagittal' })).toEqual({ spread: 0.65 })
  })
})
