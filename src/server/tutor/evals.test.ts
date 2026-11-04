import { searchBm25 } from '@/features/tutor/retrieval'
import { viewerToolSchemas, isViewerTool } from '@/features/tutor/tools'
import {
  parseEvalCases,
  percentile,
  retrievalRecall,
  scoreDeterministic,
  toolCallMatches,
  type EvalCase,
} from '@/server/tutor/evals'
import { NOT_COVERED } from '@/server/tutor/prompt'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const cases = parseEvalCases(readFileSync('evals/tutor.jsonl', 'utf8'))

describe('eval cases', () => {
  it('are unique and cover every category', () => {
    expect(new Set(cases.map((testCase) => testCase.id)).size).toBe(cases.length)
    expect(cases.length).toBeGreaterThanOrEqual(40)
    expect(new Set(cases.map((testCase) => testCase.category))).toEqual(
      new Set(['grounded', 'tool', 'refusal', 'safety', 'study', 'partial']),
    )
  })

  it('only expect tool calls the tutor could make', () => {
    const expected = cases.flatMap((testCase) =>
      (testCase.expect.tools ?? []).map((tool) => ({ id: testCase.id, tool })),
    )
    const serverTools = expected.filter(({ tool }) => !isViewerTool(tool.name)).map(({ tool }) => tool.name)
    expect(new Set(serverTools)).toEqual(new Set(['generate_question']))

    const invalid = expected.filter(({ tool }) => {
      if (!isViewerTool(tool.name)) return false
      const exact = Object.fromEntries(Object.entries(tool.input ?? {}).filter(([, value]) => !Array.isArray(value)))
      return !viewerToolSchemas[tool.name].partial().safeParse(exact).success
    })
    expect(invalid.map(({ id }) => id)).toEqual([])
  })

  // The same recall the eval runner reports for BM25, checked on every commit since it needs no model.
  it('BM25 finds the expected documents', () => {
    const withDocs = cases.filter((testCase) => testCase.docs.length > 0)
    const recalls = withDocs.map((testCase) => retrievalRecall(testCase.docs, searchBm25(testCase.question, 6))!)
    const misses = withDocs.filter((_, index) => recalls[index]! < 1).map((testCase) => testCase.id)
    const mean = recalls.reduce((sum, recall) => sum + recall, 0) / recalls.length
    expect(mean, `missed: ${misses.join(', ')}`).toBeGreaterThanOrEqual(0.85)
  })
})

describe('scoreDeterministic', () => {
  const toolCase: EvalCase = {
    id: 'tool',
    category: 'tool',
    question: 'Show me the knee',
    docs: [],
    expect: { tools: [{ name: 'select_joint', input: { jointId: 'knee' } }], cite: ['bone:patella_right'] },
  }

  it('scores tool calls, citations, and refusals', () => {
    const score = scoreDeterministic(toolCase, {
      text: 'The kneecap [[bone:patella_left]] sits in front [[bone:kneecap]].',
      toolCalls: [{ name: 'select_joint', input: { jointId: 'knee', side: 'left' } }],
      invalidToolCalls: 0,
    })
    expect(score).toEqual({
      toolsCorrect: true,
      refused: false,
      refusalCorrect: true,
      citeRecall: 1,
      invalidCitations: ['bone:kneecap'],
      forbiddenWords: [],
    })
  })

  it('fails tool cases with a wrong id, an invalid call, or a forbidden tool', () => {
    const wrong = { text: '', toolCalls: [{ name: 'select_joint', input: { jointId: 'hip' } }], invalidToolCalls: 0 }
    expect(scoreDeterministic(toolCase, wrong).toolsCorrect).toBe(false)
    const invalid = { ...wrong, toolCalls: [{ name: 'select_joint', input: { jointId: 'knee' } }], invalidToolCalls: 1 }
    expect(scoreDeterministic(toolCase, invalid).toolsCorrect).toBe(false)
    const refusal: EvalCase = { ...toolCase, expect: { refuse: true, noTools: true } }
    const score = scoreDeterministic(refusal, {
      text: `${NOT_COVERED} Try the femur.`,
      toolCalls: [],
      invalidToolCalls: 0,
    })
    expect(score).toMatchObject({ toolsCorrect: true, refused: true, refusalCorrect: true })
  })

  it('accepts any listed value', () => {
    expect(
      toolCallMatches({ name: 'x', input: { kind: 'landmark' } }, { name: 'x', input: { kind: ['bone', 'landmark'] } }),
    ).toBe(true)
  })
})

it('percentile uses the nearest rank', () => {
  expect(percentile([5, 1, 4, 2, 3], 50)).toBe(3)
  expect(percentile([5, 1, 4, 2, 3], 95)).toBe(5)
  expect(percentile([], 50)).toBeNull()
})
