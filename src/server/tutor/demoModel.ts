import type { LanguageModelV4, LanguageModelV4Prompt, LanguageModelV4StreamPart } from '@ai-sdk/provider'
import { NOT_COVERED } from '@/server/tutor/prompt'
import { MockLanguageModelV4, simulateReadableStream } from 'ai/test'

const USAGE = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
}

const TOOL_FOR_KIND = {
  bone: ['select_bone', 'boneId'],
  landmark: ['select_landmark', 'landmarkId'],
  joint: ['select_joint', 'jointId'],
  walk: ['start_walk', 'walkId'],
} as const

function lastUserText(prompt: LanguageModelV4Prompt): string {
  const message = prompt.findLast((item) => item.role === 'user')
  if (!message || message.role !== 'user') return ''
  return message.content.map((part) => (part.type === 'text' ? part.text : '')).join(' ')
}

function textParts(text: string): LanguageModelV4StreamPart[] {
  const words = text.split(/(?<= )/)
  return [
    { type: 'text-start', id: 't' },
    ...words.map((delta): LanguageModelV4StreamPart => ({ type: 'text-delta', id: 't', delta })),
    { type: 'text-end', id: 't' },
  ]
}

/**
 * A scripted tutor for working on the chat UI without AI Gateway credentials (TUTOR_MOCK=1). It answers with the
 * first sentence of the top retrieved document and moves the viewer when asked to show something.
 */
export function demoTutorModel(): LanguageModelV4 {
  return new MockLanguageModelV4({
    modelId: 'demo-tutor',
    doStream: async ({ prompt }) => {
      const system = prompt.find((item) => item.role === 'system')?.content ?? ''
      const top = /<doc cite="\[\[(\w+):(\w+)\]\]" title="[^"]*">\n([^\n]+)/.exec(system)
      const finish: LanguageModelV4StreamPart = {
        type: 'finish',
        usage: USAGE,
        finishReason: { unified: 'stop', raw: 'stop' },
      }
      let parts: LanguageModelV4StreamPart[]
      if (prompt.at(-1)?.role === 'tool') {
        parts = [...textParts('It is highlighted in the viewer now.'), finish]
      } else if (!top) {
        parts = [...textParts(NOT_COVERED), finish]
      } else {
        const [, kind, id, text] = top as unknown as [string, keyof typeof TOOL_FOR_KIND, string, string]
        const sentence = text
          .split(/(?<=\.) /)
          .slice(0, 2)
          .join(' ')
        const answer = textParts(`${sentence} [[${kind}:${id}]]`)
        const [toolName, field] = TOOL_FOR_KIND[kind]
        parts = /^\s*(show|highlight|point|where)/i.test(lastUserText(prompt))
          ? [
              ...answer,
              { type: 'tool-call', toolCallId: `demo-${Date.now()}`, toolName, input: JSON.stringify({ [field]: id }) },
              { ...finish, finishReason: { unified: 'tool-calls', raw: 'tool_use' } },
            ]
          : [...answer, finish]
      }
      return {
        stream: simulateReadableStream({
          chunks: [{ type: 'stream-start', warnings: [] }, ...parts],
          initialDelayInMs: 300,
          chunkDelayInMs: 25,
        }),
      }
    },
  })
}
