import { getBone } from '@/data/bones'
import { getJoint } from '@/data/joints'
import { getLandmark } from '@/data/landmarks'
import { getDoc } from '@/features/tutor/corpus'
import type { TutorUIMessage } from '@/features/tutor/messages'
import { formatContext, searchBm25, type RetrievedDoc } from '@/features/tutor/retrieval'
import {
  BONE_IDS,
  generateQuestionInput,
  JOINT_IDS,
  LANDMARK_IDS,
  LOOKS,
  searchAtlasInput,
  VIEWER_TOOL_DESCRIPTIONS,
  viewerToolSchemas,
  type ViewerToolName,
} from '@/features/tutor/tools'
import { generateQuestion } from '@/server/tutor/generateQuestion'
import { systemPrompt } from '@/server/tutor/prompt'
import { clientIp, type RateLimiter } from '@/server/tutor/rateLimit'
import {
  convertToModelMessages,
  safeValidateUIMessages,
  stepCountIs,
  streamText,
  tool,
  type LanguageModel,
  type ToolSet,
  type UIMessage,
} from 'ai'
import { z } from 'zod'

export const LIMITS = {
  bodyBytes: 64 * 1024,
  messages: 40,
  /** Only the most recent messages go to the model. */
  historyForModel: 16,
  userChars: 1000,
  outputTokens: 700,
  steps: 5,
} as const

const viewerContext = z.object({
  selection: z
    .discriminatedUnion('kind', [
      z.object({ kind: z.literal('bone'), id: z.enum(BONE_IDS) }),
      z.object({ kind: z.literal('landmark'), id: z.enum(LANDMARK_IDS) }),
      z.object({ kind: z.literal('joint'), id: z.enum(JOINT_IDS) }),
    ])
    .nullable()
    .default(null),
  look: z.enum(LOOKS).default('atlas'),
  studying: z.boolean().default(false),
})

const requestBody = z.object({
  id: z.string().max(100).optional(),
  messages: z.array(z.unknown()).min(1).max(LIMITS.messages),
  context: viewerContext.default({ selection: null, look: 'atlas', studying: false }),
})

export type ViewerContext = z.infer<typeof viewerContext>

export type { TutorUIMessage }

export type Retriever = (query: string, abortSignal?: AbortSignal) => RetrievedDoc[] | Promise<RetrievedDoc[]>

export interface TutorDeps {
  model: LanguageModel
  /** Writes generate_question questions. Defaults to `model`. */
  questionModel?: LanguageModel
  rateLimiter: RateLimiter
  /** Defaults to BM25 over the atlas corpus. */
  retrieve?: Retriever
}

function problem(status: number, message: string, headers: Record<string, string> = {}): Response {
  return Response.json({ error: message }, { status, headers })
}

function textOf(message: UIMessage | undefined): string {
  if (!message) return ''
  return message.parts.map((part) => (part.type === 'text' ? part.text : '')).join(' ')
}

function viewingLine(context: ViewerContext): { line: string; doc: RetrievedDoc | null } | null {
  const { selection } = context
  if (!selection || context.studying) return null
  const name =
    selection.kind === 'bone'
      ? getBone(selection.id)?.displayName
      : selection.kind === 'landmark'
        ? `${getLandmark(selection.id)?.landmark.name} on the ${getLandmark(selection.id)?.displayName.toLowerCase()}`
        : getJoint(selection.id)?.name
  const doc = getDoc(`${selection.kind}:${selection.id}`)
  return { line: `${name}${doc ? ` [[${doc.key}]]` : ''}`, doc: doc ? { doc, score: Number.POSITIVE_INFINITY } : null }
}

const viewer = (name: ViewerToolName) => ({ description: VIEWER_TOOL_DESCRIPTIONS[name] })

export function tutorTools(deps: TutorDeps, retrieve: Retriever, abortSignal?: AbortSignal) {
  const viewerTools = {
    select_bone: tool({ ...viewer('select_bone'), inputSchema: viewerToolSchemas.select_bone }),
    select_landmark: tool({ ...viewer('select_landmark'), inputSchema: viewerToolSchemas.select_landmark }),
    select_joint: tool({ ...viewer('select_joint'), inputSchema: viewerToolSchemas.select_joint }),
    frame_region: tool({ ...viewer('frame_region'), inputSchema: viewerToolSchemas.frame_region }),
    set_look: tool({ ...viewer('set_look'), inputSchema: viewerToolSchemas.set_look }),
    set_section: tool({ ...viewer('set_section'), inputSchema: viewerToolSchemas.set_section }),
    set_spread: tool({ ...viewer('set_spread'), inputSchema: viewerToolSchemas.set_spread }),
    start_walk: tool({ ...viewer('start_walk'), inputSchema: viewerToolSchemas.start_walk }),
    start_quiz: tool({ ...viewer('start_quiz'), inputSchema: viewerToolSchemas.start_quiz }),
  }
  return {
    ...viewerTools,
    search_atlas: tool({
      description: 'Search the atlas for documents about a bone, landmark, joint, or walk.',
      inputSchema: searchAtlasInput,
      execute: async ({ query }) => ({
        documents: (await retrieve(query, abortSignal)).map((hit) => ({
          cite: `[[${hit.doc.key}]]`,
          title: hit.doc.title,
          text: hit.doc.text,
        })),
      }),
    }),
    generate_question: tool({
      description: 'Write a multiple-choice question that the chat shows as a quiz card.',
      inputSchema: generateQuestionInput,
      execute: async (input) => {
        const result = await generateQuestion(deps.questionModel ?? deps.model, input, { abortSignal })
        return { question: result.question, fallback: result.fallback }
      },
    }),
  } satisfies ToolSet
}

/** POST /api/tutor. Web-standard so it runs in the Vite dev server, Vercel, and tests alike. */
export async function handleTutorRequest(request: Request, deps: TutorDeps): Promise<Response> {
  if (request.method !== 'POST') return problem(405, 'Use POST.', { allow: 'POST' })
  if (Number(request.headers.get('content-length') ?? 0) > LIMITS.bodyBytes)
    return problem(413, 'Request is too large.')
  const raw = await request.text()
  if (raw.length > LIMITS.bodyBytes) return problem(413, 'Request is too large.')

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return problem(400, 'Request body must be JSON.')
  }
  const body = requestBody.safeParse(json)
  if (!body.success) return problem(400, 'Request does not match the tutor API.')

  const retrieve: Retriever = deps.retrieve ?? ((query) => searchBm25(query, 6))
  const tools = tutorTools(deps, retrieve, request.signal)
  const validated = await safeValidateUIMessages<TutorUIMessage>({ messages: body.data.messages, tools })
  if (!validated.success) return problem(400, 'Messages are malformed.')
  const messages = validated.data

  const lastUser = messages.findLast((message) => message.role === 'user')
  const question = textOf(lastUser).trim()
  if (!question) return problem(400, 'Ask a question.')
  if (question.length > LIMITS.userChars) {
    return problem(413, `Keep questions under ${LIMITS.userChars} characters.`)
  }

  const limit = await deps.rateLimiter.limit(clientIp(request))
  if (!limit.success) {
    const retryAfter = Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000))
    return problem(429, 'The tutor is busy. Try again in a few minutes.', { 'retry-after': String(retryAfter) })
  }

  const viewing = viewingLine(body.data.context)
  const hits = await retrieve(question, request.signal)
  const documents =
    viewing?.doc && !hits.some((hit) => hit.doc.key === viewing.doc!.doc.key) ? [viewing.doc, ...hits] : hits
  const modelId = typeof deps.model === 'string' ? deps.model : deps.model.modelId

  const result = streamText({
    model: deps.model,
    system: systemPrompt({
      documents: formatContext(documents),
      viewing: viewing?.line ?? null,
      studying: body.data.context.studying,
    }),
    messages: await convertToModelMessages(messages.slice(-LIMITS.historyForModel), {
      tools,
      ignoreIncompleteToolCalls: true,
    }),
    tools,
    stopWhen: stepCountIs(LIMITS.steps),
    maxOutputTokens: LIMITS.outputTokens,
    temperature: 0.2,
    abortSignal: request.signal,
  })

  return result.toUIMessageStreamResponse<TutorUIMessage>({
    originalMessages: messages,
    messageMetadata: ({ part }) =>
      part.type === 'start' ? { retrieved: documents.map((hit) => hit.doc.key), model: modelId } : undefined,
    onError: (error) => {
      console.error('Tutor stream failed', error)
      return 'The tutor could not answer just now. Try again in a moment.'
    },
  })
}
