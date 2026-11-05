import type { LanguageModelV4StreamPart } from '@ai-sdk/provider'
import { MockLanguageModelV4, simulateReadableStream } from 'ai/test'

const USAGE = {
  inputTokens: { total: 120, noCache: 120, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 30, text: 30, reasoning: 0 },
}

export type Step = LanguageModelV4StreamPart[]

export function textStep(text: string): Step {
  return [
    { type: 'text-start', id: 't' },
    ...text.split(/(?<= )/).map((delta): LanguageModelV4StreamPart => ({ type: 'text-delta', id: 't', delta })),
    { type: 'text-end', id: 't' },
    { type: 'finish', usage: USAGE, finishReason: { unified: 'stop', raw: 'stop' } },
  ]
}

export function toolStep(...calls: Array<{ name: string; input: unknown; id?: string }>): Step {
  return [
    ...calls.map((call, index): LanguageModelV4StreamPart => ({
      type: 'tool-call',
      toolCallId: call.id ?? `call_${index + 1}`,
      toolName: call.name,
      input: JSON.stringify(call.input),
    })),
    { type: 'finish', usage: USAGE, finishReason: { unified: 'tool-calls', raw: 'tool_use' } },
  ]
}

/** A model that streams the given steps in order, one per call. */
export function streamingModel(...steps: Step[]): MockLanguageModelV4 {
  let call = 0
  return new MockLanguageModelV4({
    modelId: 'mock-tutor',
    doStream: async () => {
      const step = steps[Math.min(call, steps.length - 1)]!
      call += 1
      return { stream: simulateReadableStream({ chunks: [{ type: 'stream-start', warnings: [] }, ...step] }) }
    },
  })
}

/** A model whose generateText calls return these JSON objects in order. */
export function objectModel(...objects: unknown[]): MockLanguageModelV4 {
  let call = 0
  return new MockLanguageModelV4({
    modelId: 'mock-writer',
    doGenerate: async () => {
      const object = objects[Math.min(call, objects.length - 1)]
      call += 1
      return {
        content: [{ type: 'text', text: JSON.stringify(object) }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: USAGE,
        warnings: [],
      }
    },
  })
}

/** Reads a UI message stream response into its parsed chunks. */
export async function readChunks(response: Response): Promise<Array<Record<string, unknown>>> {
  const body = await response.text()
  return body
    .split('\n')
    .filter((line) => line.startsWith('data: ') && line !== 'data: [DONE]')
    .map((line) => JSON.parse(line.slice(6)) as Record<string, unknown>)
}
