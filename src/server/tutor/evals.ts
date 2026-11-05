import { auditCitations } from '@/features/tutor/citations'
import { getDoc } from '@/features/tutor/corpus'
import type { RetrievedDoc } from '@/features/tutor/retrieval'
import { NOT_COVERED } from '@/server/tutor/prompt'
import { z } from 'zod'

const docKey = z.string().refine((key) => getDoc(key) !== undefined, { message: 'Unknown atlas document' })

const expectedTool = z.object({
  name: z.string(),
  /** Every listed field must match; an array lists acceptable values. */
  input: z.record(z.string(), z.unknown()).optional(),
})

export const evalCase = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  category: z.enum(['grounded', 'tool', 'refusal', 'safety', 'study', 'partial']),
  question: z.string().min(3),
  context: z
    .object({
      selection: z.object({ kind: z.enum(['bone', 'landmark', 'joint']), id: z.string() }).optional(),
      studying: z.boolean().optional(),
    })
    .optional(),
  /** Documents retrieval should return for the question. Scored without calling a model. */
  docs: z.array(docKey),
  expect: z.object({
    cite: z.array(docKey).optional(),
    tools: z.array(expectedTool).optional(),
    /** `true` forbids every tool call; a list forbids those tools. */
    noTools: z.union([z.literal(true), z.array(z.string())]).optional(),
    refuse: z.boolean().optional(),
    /** The answer must not give medical advice. */
    safe: z.boolean().optional(),
    /** The answer must say which part of the question the atlas does not cover. */
    partial: z.boolean().optional(),
    /** Words the answer must not contain, case-insensitively. */
    forbid: z.array(z.string()).optional(),
  }),
})

export type EvalCase = z.infer<typeof evalCase>

export function parseEvalCases(jsonl: string): EvalCase[] {
  return jsonl
    .split('\n')
    .filter((line) => line.trim())
    .map((line, index) => {
      const parsed = evalCase.safeParse(JSON.parse(line))
      if (!parsed.success) throw new Error(`evals/tutor.jsonl line ${index + 1}: ${z.prettifyError(parsed.error)}`)
      return parsed.data
    })
}

/** Share of expected documents in the results, counting either side of a paired structure as a hit. */
export function retrievalRecall(expected: readonly string[], hits: readonly RetrievedDoc[]): number | null {
  if (expected.length === 0) return null
  const found = new Set(hits.map((hit) => hit.doc.key))
  return expected.filter((key) => found.has(getDoc(key)!.key)).length / expected.length
}

export interface ToolCall {
  name: string
  input: unknown
}

function matches(actual: unknown, wanted: unknown): boolean {
  if (Array.isArray(wanted)) return wanted.some((option) => matches(actual, option))
  return actual === wanted
}

export function toolCallMatches(call: ToolCall, expected: z.infer<typeof expectedTool>): boolean {
  if (call.name !== expected.name) return false
  const input = (call.input ?? {}) as Record<string, unknown>
  return Object.entries(expected.input ?? {}).every(([key, wanted]) => matches(input[key], wanted))
}

export function isRefusal(text: string): boolean {
  const normalized = text.toLowerCase().replaceAll(/\s+/g, ' ')
  return normalized.includes(NOT_COVERED.toLowerCase().replace(/\.$/, ''))
}

export interface EvalOutcome {
  text: string
  toolCalls: ToolCall[]
  invalidToolCalls: number
}

export interface DeterministicScore {
  /** Expected tools were called with matching inputs and forbidden tools were not. Null when nothing is expected. */
  toolsCorrect: boolean | null
  refused: boolean
  /** Whether refusing (or not) was the right call. */
  refusalCorrect: boolean
  citeRecall: number | null
  invalidCitations: string[]
  forbiddenWords: string[]
}

export function scoreDeterministic(testCase: EvalCase, outcome: EvalOutcome): DeterministicScore {
  const { expect } = testCase
  const refused = isRefusal(outcome.text)
  let toolsCorrect: boolean | null = null
  if (expect.tools || expect.noTools) {
    const expectedCalled = (expect.tools ?? []).every((wanted) =>
      outcome.toolCalls.some((call) => toolCallMatches(call, wanted)),
    )
    const { noTools = [] } = expect
    const forbidden =
      noTools === true ? outcome.toolCalls.length > 0 : outcome.toolCalls.some((call) => noTools.includes(call.name))
    toolsCorrect = expectedCalled && !forbidden && outcome.invalidToolCalls === 0
  }
  const { valid, invalid } = auditCitations(outcome.text)
  const cited = new Set(valid.map((key) => getDoc(key)?.key ?? key))
  const citeRecall = expect.cite?.length
    ? expect.cite.filter((key) => cited.has(getDoc(key)!.key)).length / expect.cite.length
    : null
  const lower = outcome.text.toLowerCase()
  return {
    toolsCorrect,
    refused,
    refusalCorrect: refused === (expect.refuse ?? false),
    citeRecall,
    invalidCitations: invalid,
    forbiddenWords: (expect.forbid ?? []).filter((word) => lower.includes(word.toLowerCase())),
  }
}

export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = values.toSorted((a, b) => a - b)
  const rank = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.min(Math.max(rank, 0), sorted.length - 1)]!
}
