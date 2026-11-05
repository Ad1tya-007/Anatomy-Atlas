import { getBone } from '@/data/bones'
import { getLandmark } from '@/data/landmarks'
import type { GeneratedQuestion } from '@/features/tutor/tools'
import { fallbackQuestion, generateQuestion, validateQuestion } from '@/server/tutor/generateQuestion'
import { seededRng } from '@/test/rng'
import { objectModel } from '@/test/mockModel'
import { describe, expect, it } from 'vitest'

const good: GeneratedQuestion = {
  kind: 'bone',
  prompt: 'Which bone forms the point of the elbow?',
  choices: [
    { id: 'ulna_left', label: 'ulna' },
    { id: 'radius_left', label: 'Radius' },
    { id: 'humerus_left', label: 'Humerus' },
  ],
  answerId: 'ulna_left',
  explanation: 'The olecranon of the ulna is the point of the elbow.',
}

describe('validateQuestion', () => {
  it('accepts a question and replaces labels with atlas names', () => {
    const checked = validateQuestion(good)
    expect('question' in checked && checked.question.choices.map((choice) => choice.label)).toEqual([
      'Ulna',
      'Radius',
      'Humerus',
    ])
  })

  it('rejects ids that are not in the atlas', () => {
    const checked = validateQuestion({
      ...good,
      choices: [...good.choices.slice(0, 2), { id: 'funny_bone', label: 'Funny bone' }],
    })
    expect(checked).toEqual({ problems: ['"funny_bone" is not a bone id in the atlas.'] })
  })

  it('rejects both sides of one bone as separate choices', () => {
    const checked = validateQuestion({
      ...good,
      choices: [...good.choices.slice(0, 2), { id: 'ulna_right', label: 'Ulna' }],
    })
    expect('problems' in checked && checked.problems[0]).toMatch(/same atlas name/)
  })

  it('rejects an answer that is not a choice, and ids of the wrong kind', () => {
    expect(validateQuestion({ ...good, answerId: 'femur_left' })).toEqual({
      problems: ['answerId must be one of the choices.'],
    })
    const landmark = validateQuestion({ ...good, kind: 'landmark' })
    expect('problems' in landmark && landmark.problems).toHaveLength(3)
  })
})

describe('fallbackQuestion', () => {
  it.each(['bone', 'landmark'] as const)('builds a valid %s question from the study engine', (kind) => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const question = fallbackQuestion(kind, seededRng(seed))
      expect(validateQuestion(question)).toEqual({ question })
      const name = kind === 'bone' ? getBone(question.answerId)?.name : getLandmark(question.answerId)?.landmark.name
      expect(question.choices.find((choice) => choice.id === question.answerId)?.label).toBe(name)
    }
  })
})

describe('generateQuestion', () => {
  it('returns the first valid question', async () => {
    const result = await generateQuestion(objectModel(good), { kind: 'bone', topic: 'elbow' })
    expect(result).toMatchObject({ fallback: false, attempts: 1 })
  })

  it('retries with the problems it found', async () => {
    const model = objectModel({ ...good, answerId: 'femur_left' }, good)
    const result = await generateQuestion(model, { kind: 'bone', topic: 'elbow' })

    expect(result).toMatchObject({ fallback: false, attempts: 2 })
    const retry = JSON.stringify(model.doGenerateCalls[1]!.prompt)
    expect(retry).toContain('answerId must be one of the choices.')
  })

  it('falls back to the study engine after repeated invalid questions', async () => {
    const model = objectModel({ ...good, answerId: 'femur_left' })
    const result = await generateQuestion(model, { kind: 'bone', topic: 'elbow' }, { maxAttempts: 2 })

    expect(result.fallback).toBe(true)
    expect(model.doGenerateCalls).toHaveLength(2)
    expect(validateQuestion(result.question)).toEqual({ question: result.question })
  })
})
