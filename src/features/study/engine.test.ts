import { getBone, quizBones } from '@/data/bones'
import { allLandmarks, getLandmark } from '@/data/landmarks'
import {
  acceptsBone,
  acceptsLandmark,
  answerIsCorrect,
  boneChoiceLabels,
  buildQuestion,
  correctLabel,
  defaultStudyRegion,
  fillDistractors,
  landmarkChoiceLabels,
  LOCATE_MARKER_LIMIT,
  MIN_SCOPE_SIZE,
  normalizeAnswer,
  pickOne,
  quizLandmarks,
  shuffle,
  studyPool,
  type StudyConfig,
} from '@/features/study/engine'
import { seededRng } from '@/test/rng'
import type { BoneClassification } from '@/types/anatomy'
import { describe, expect, it } from 'vitest'

const SEEDS = Array.from({ length: 150 }, (_, index) => index + 1)

const baseConfig: StudyConfig = {
  studyScope: 'all',
  studyRegionId: null,
  studyClassification: null,
  studyAnswerMode: 'choice',
  activeRegion: null,
}

function femur() {
  const bone = getBone('femur_left')
  if (!bone) throw new Error('femur_left is missing from the atlas')
  return bone
}

function expectValidChoices(choices: string[], correct: string) {
  const keys = choices.map(normalizeAnswer)
  expect(choices.length).toBeGreaterThanOrEqual(2)
  expect(choices.length).toBeLessThanOrEqual(4)
  expect(new Set(keys).size).toBe(keys.length)
  expect(keys.filter((key) => key === normalizeAnswer(correct))).toHaveLength(1)
}

describe('normalizeAnswer', () => {
  it('trims, lowercases, and collapses whitespace', () => {
    expect(normalizeAnswer('  Greater   TROCHANTER \n')).toBe('greater trochanter')
  })
})

describe('acceptsBone', () => {
  it('accepts the name, display name, and alternate names in any case', () => {
    const bone = femur()
    expect(acceptsBone(bone, 'Femur')).toBe(true)
    expect(acceptsBone(bone, '  FEMUR ')).toBe(true)
    expect(acceptsBone(bone, bone.displayName)).toBe(true)
    for (const name of bone.alternateNames) expect(acceptsBone(bone, name)).toBe(true)
  })

  it('ignores a left or right prefix, because the side is shown on the model', () => {
    expect(acceptsBone(femur(), 'left femur')).toBe(true)
    expect(acceptsBone(femur(), 'right femur')).toBe(true)
  })

  it('rejects empty and wrong answers', () => {
    expect(acceptsBone(femur(), '')).toBe(false)
    expect(acceptsBone(femur(), '   ')).toBe(false)
    expect(acceptsBone(femur(), 'tibia')).toBe(false)
    expect(acceptsBone(femur(), 'left')).toBe(false)
    expect(acceptsBone(femur(), 'fem')).toBe(false)
  })
})

describe('acceptsLandmark', () => {
  it('requires the full name, ignoring case and spacing', () => {
    expect(acceptsLandmark('Greater trochanter', ' greater  Trochanter')).toBe(true)
    expect(acceptsLandmark('Greater trochanter', 'trochanter')).toBe(false)
    expect(acceptsLandmark('Greater trochanter', '')).toBe(false)
  })
})

describe('shuffle', () => {
  it('returns a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4, 5, 6]
    const output = shuffle(input, seededRng(7))
    expect(input).toEqual([1, 2, 3, 4, 5, 6])
    expect(output.toSorted()).toEqual(input)
  })

  it('is deterministic for a given seed', () => {
    expect(shuffle([1, 2, 3, 4, 5], seededRng(42))).toEqual(shuffle([1, 2, 3, 4, 5], seededRng(42)))
  })
})

describe('fillDistractors', () => {
  it('never repeats a label, even across pools or letter case', () => {
    const chosen = fillDistractors([['Ulna', 'ulna'], ['ULNA', 'Radius'], ['Humerus']], 3, seededRng(1))
    expect(chosen.map(normalizeAnswer).toSorted()).toEqual(['humerus', 'radius', 'ulna'])
  })

  it('fills from the most similar pool first', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const chosen = fillDistractors(
        [
          ['A', 'B', 'C'],
          ['D', 'E'],
        ],
        3,
        seededRng(seed),
      )
      expect(chosen.toSorted()).toEqual(['A', 'B', 'C'])
    }
  })

  it('returns fewer labels when the pools run out', () => {
    expect(fillDistractors([['A'], []], 3, seededRng(1))).toEqual(['A'])
    expect(fillDistractors([], 3, seededRng(1))).toEqual([])
  })
})

describe('pickOne', () => {
  it('skips excluded items', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      expect(pickOne([1, 2], (item) => item === 1, seededRng(seed))).toBe(2)
    }
  })

  it('falls back to every item when all are excluded', () => {
    expect(pickOne([1], () => true, seededRng(1))).toBe(1)
  })

  it('returns undefined for an empty list', () => {
    expect(pickOne([], () => false)).toBeUndefined()
  })
})

describe('defaultStudyRegion', () => {
  it('uses the active region when it is a study region', () => {
    expect(defaultStudyRegion('lower-limb')).toBe('lower-limb')
  })

  it('falls back to the head', () => {
    expect(defaultStudyRegion(null)).toBe('head')
    expect(defaultStudyRegion('not-a-region')).toBe('head')
  })
})

describe('studyPool', () => {
  it('uses every quiz bone for the "all" scope', () => {
    expect(studyPool(baseConfig)).toEqual({ bones: quizBones(), fallback: false })
  })

  it('filters by region', () => {
    const pool = studyPool({ ...baseConfig, studyScope: 'region', studyRegionId: 'lower-limb' })
    expect(pool.fallback).toBe(false)
    expect(pool.bones.length).toBeGreaterThanOrEqual(MIN_SCOPE_SIZE)
    expect(pool.bones.every((bone) => bone.region === 'lower-limb')).toBe(true)
  })

  it('uses the active region when no study region is set', () => {
    const pool = studyPool({ ...baseConfig, studyScope: 'region', activeRegion: 'upper-limb' })
    expect(pool.bones.every((bone) => bone.region === 'upper-limb')).toBe(true)
  })

  it.each<BoneClassification>(['long', 'short', 'flat', 'irregular', 'sesamoid'])(
    'falls back to the full skeleton only when the %s class is too small',
    (classification) => {
      const matching = quizBones().filter((bone) => bone.classification === classification)
      const pool = studyPool({ ...baseConfig, studyScope: 'classification', studyClassification: classification })
      expect(pool.fallback).toBe(matching.length < MIN_SCOPE_SIZE)
      expect(pool.bones).toEqual(pool.fallback ? quizBones() : matching)
    },
  )
})

describe('choice labels', () => {
  it('include the correct bone name exactly once, with unique distractors', () => {
    const all = quizBones()
    for (const seed of SEEDS) {
      const rng = seededRng(seed)
      const bone = all[Math.floor(rng() * all.length)]!
      expectValidChoices(boneChoiceLabels(bone, all, all, rng), bone.name)
    }
  })

  it('include the correct landmark name exactly once, with unique distractors', () => {
    const records = quizLandmarks(quizBones())
    for (const seed of SEEDS) {
      const rng = seededRng(seed)
      const record = records[Math.floor(rng() * records.length)]!
      expectValidChoices(landmarkChoiceLabels(record, records, records, rng), record.landmark.name)
    }
  })

  it('return no choices when there is nothing to distract with', () => {
    const bone = femur()
    expect(boneChoiceLabels(bone, [bone], [bone])).toEqual([])
  })
})

describe('buildQuestion', () => {
  it('asks about a quiz bone and offers valid choices', () => {
    const ids = new Set(quizBones().map((bone) => bone.id))
    for (const seed of SEEDS) {
      const question = buildQuestion(baseConfig, 'bone', null, null, seededRng(seed))
      expect(ids.has(question.boneId)).toBe(true)
      expect(question.landmarkId).toBeNull()
      expectValidChoices(question.choices, getBone(question.boneId)!.name)
    }
  })

  it('never repeats the previous bone', () => {
    for (const seed of SEEDS) {
      const question = buildQuestion(baseConfig, 'bone', 'femur_left', null, seededRng(seed))
      expect(question.boneId).not.toBe('femur_left')
    }
  })

  it('asks about a landmark on the named bone', () => {
    for (const seed of SEEDS) {
      const question = buildQuestion(baseConfig, 'landmark', null, 'femur_left_greater_trochanter', seededRng(seed))
      const record = getLandmark(question.landmarkId)
      expect(record?.boneId).toBe(question.boneId)
      expect(question.landmarkId).not.toBe('femur_left_greater_trochanter')
      expectValidChoices(question.choices, record!.landmark.name)
    }
  })

  it('offers no choices outside of choice mode', () => {
    for (const mode of ['reveal', 'type', 'locate'] as const) {
      const question = buildQuestion({ ...baseConfig, studyAnswerMode: mode }, 'bone', null, null, seededRng(3))
      expect(question.choices).toEqual([])
    }
  })

  it('keeps the locate landmark inside the marker list and narrows crowded scopes to one region', () => {
    const config: StudyConfig = { ...baseConfig, studyAnswerMode: 'locate', activeRegion: 'lower-limb' }
    const markers = quizLandmarks(quizBones()).reduce((sum, record) => sum + (record.landmark.bothSides ? 2 : 1), 0)
    expect(markers).toBeGreaterThan(LOCATE_MARKER_LIMIT)
    for (const seed of SEEDS.slice(0, 30)) {
      const question = buildQuestion(config, 'landmark', null, null, seededRng(seed))
      expect(question.locateLandmarkIds).toContain(question.landmarkId)
      expect(question.locateNarrowed).toBe(true)
      expect(getBone(question.boneId)?.region).toBe('lower-limb')
    }
  })

  it.each<BoneClassification>(['long', 'short', 'flat', 'irregular', 'sesamoid'])(
    'reports a fallback for the %s class only when it is too small',
    (classification) => {
      const size = quizBones().filter((bone) => bone.classification === classification).length
      const config: StudyConfig = { ...baseConfig, studyScope: 'classification', studyClassification: classification }
      expect(buildQuestion(config, 'bone', null, null, seededRng(5)).fallback).toBe(size < MIN_SCOPE_SIZE)
    },
  )
})

describe('grading', () => {
  const record = allLandmarks.find((item) => item.boneId === 'femur_left')!

  it('labels the correct answer for both kinds of question', () => {
    expect(correctLabel('bone', 'femur_left', null)).toBe('Femur')
    expect(correctLabel('landmark', 'femur_left', record.landmark.id)).toBe(record.landmark.name)
    expect(correctLabel('bone', 'missing', null)).toBeNull()
  })

  it('grades typed answers', () => {
    expect(answerIsCorrect('bone', 'femur_left', null, 'femur')).toBe(true)
    expect(answerIsCorrect('bone', 'femur_left', null, 'tibia')).toBe(false)
    expect(answerIsCorrect('landmark', 'femur_left', record.landmark.id, record.landmark.name)).toBe(true)
    expect(answerIsCorrect('landmark', 'femur_left', record.landmark.id, 'nope')).toBe(false)
    expect(answerIsCorrect('landmark', 'femur_left', 'missing', 'anything')).toBe(false)
    expect(answerIsCorrect('bone', 'missing', null, 'anything')).toBe(false)
  })
})
