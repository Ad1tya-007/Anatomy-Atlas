import { handleTutorRequest, LIMITS, type TutorDeps } from '@/server/tutor/handler'
import { NOT_COVERED } from '@/server/tutor/prompt'
import { createMemoryRateLimiter, type RateLimiter } from '@/server/tutor/rateLimit'
import { objectModel, readChunks, streamingModel, textStep, toolStep } from '@/test/mockModel'
import type { LanguageModelV4Prompt } from '@ai-sdk/provider'
import type { MockLanguageModelV4 } from 'ai/test'
import { describe, expect, it } from 'vitest'

function userMessage(text: string, id = 'u1') {
  return { id, role: 'user', parts: [{ type: 'text', text }] }
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/tutor', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function deps(model: MockLanguageModelV4, overrides: Partial<TutorDeps> = {}): TutorDeps {
  return { model, rateLimiter: createMemoryRateLimiter(), ...overrides }
}

function systemOf(model: MockLanguageModelV4, call = 0): string {
  const prompt = model.doStreamCalls[call]!.prompt as LanguageModelV4Prompt
  return prompt
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n')
}

describe('handleTutorRequest', () => {
  it('streams a grounded answer with the retrieved documents in the prompt', async () => {
    const model = streamingModel(textStep('The femur is the longest bone in the body [[bone:femur_left]].'))
    const response = await handleTutorRequest(post({ messages: [userMessage('How long is the femur?')] }), deps(model))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    const chunks = await readChunks(response)
    const text = chunks
      .filter((chunk) => chunk.type === 'text-delta')
      .map((chunk) => chunk.delta)
      .join('')
    expect(text).toBe('The femur is the longest bone in the body [[bone:femur_left]].')
    expect(chunks.find((chunk) => chunk.type === 'start')?.messageMetadata).toMatchObject({
      retrieved: expect.arrayContaining(['bone:femur_left']),
      model: 'mock-tutor',
    })
    const system = systemOf(model)
    expect(system).toContain('cite="[[bone:femur_left]]"')
    expect(system).toContain(NOT_COVERED)
    expect(system).toContain('Never diagnose')
  })

  it('leaves viewer tool calls for the browser to run', async () => {
    const model = streamingModel(toolStep({ name: 'select_bone', input: { boneId: 'femur_left' } }))
    const response = await handleTutorRequest(post({ messages: [userMessage('Show me the femur')] }), deps(model))

    const chunks = await readChunks(response)
    expect(chunks).toContainEqual(
      expect.objectContaining({
        type: 'tool-input-available',
        toolName: 'select_bone',
        input: { boneId: 'femur_left' },
      }),
    )
    expect(chunks.some((chunk) => chunk.type === 'tool-output-available')).toBe(false)
    expect(model.doStreamCalls).toHaveLength(1)
  })

  it('rejects a viewer tool call with an id that is not in the atlas', async () => {
    const model = streamingModel(
      toolStep({ name: 'select_bone', input: { boneId: 'femur_middle' } }),
      textStep('Sorry.'),
    )
    const chunks = await readChunks(
      await handleTutorRequest(post({ messages: [userMessage('Show me the femur')] }), deps(model)),
    )

    expect(chunks).toContainEqual(expect.objectContaining({ type: 'tool-input-error', toolName: 'select_bone' }))
    expect(chunks.some((chunk) => chunk.type === 'tool-input-available')).toBe(false)
  })

  it('runs search_atlas on the server and continues with the results', async () => {
    const model = streamingModel(
      toolStep({ name: 'search_atlas', input: { query: 'greater trochanter' } }),
      textStep('It is on the femur [[landmark:femur_left_greater_trochanter]].'),
    )
    const chunks = await readChunks(
      await handleTutorRequest(post({ messages: [userMessage('And the bump on the side of the hip?')] }), deps(model)),
    )

    const output = chunks.find((chunk) => chunk.type === 'tool-output-available') as {
      output: { documents: { cite: string }[] }
    }
    expect(output.output.documents[0]?.cite).toBe('[[landmark:femur_left_greater_trochanter]]')
    expect(model.doStreamCalls).toHaveLength(2)
  })

  it('runs generate_question and returns a validated question', async () => {
    const model = streamingModel(
      toolStep({ name: 'generate_question', input: { kind: 'bone', topic: 'bones of the leg' } }),
      textStep('Here is a question.'),
    )
    const writer = objectModel({
      kind: 'bone',
      prompt: 'Which bone of the leg carries most of the body weight?',
      choices: [
        { id: 'tibia_left', label: 'shin bone' },
        { id: 'fibula_left', label: 'Fibula' },
        { id: 'femur_left', label: 'Femur' },
      ],
      answerId: 'tibia_left',
      explanation: 'The tibia transmits body weight to the talus.',
    })
    const chunks = await readChunks(
      await handleTutorRequest(
        post({ messages: [userMessage('Quiz me on the leg')] }),
        deps(model, { questionModel: writer }),
      ),
    )

    const output = chunks.find((chunk) => chunk.type === 'tool-output-available') as {
      output: { question: { choices: { label: string }[] }; fallback: boolean }
    }
    expect(output.output.fallback).toBe(false)
    expect(output.output.question.choices.map((choice) => choice.label)).toEqual(['Tibia', 'Fibula', 'Femur'])
  })

  it('tells the model what is selected, but not during an unanswered study question', async () => {
    const context = { selection: { kind: 'bone', id: 'patella_right' }, look: 'atlas', studying: false }
    const viewing = streamingModel(textStep('That is the kneecap.'))
    await (await handleTutorRequest(post({ messages: [userMessage('What is this?')], context }), deps(viewing))).text()
    expect(systemOf(viewing)).toContain('currently viewing: Right Patella [[bone:patella_left]]')

    const studying = streamingModel(textStep('Think about the knee.'))
    await (
      await handleTutorRequest(
        post({ messages: [userMessage('Give me a hint')], context: { ...context, studying: true } }),
        deps(studying),
      )
    ).text()
    expect(systemOf(studying)).not.toContain('currently viewing')
    expect(systemOf(studying)).toContain('Do not name or select any structure')
  })

  it('caps request size, question length, and message count', async () => {
    const model = streamingModel(textStep('ok'))
    const long = await handleTutorRequest(
      post({ messages: [userMessage('x'.repeat(LIMITS.userChars + 1))] }),
      deps(model),
    )
    expect(long.status).toBe(413)

    const huge = await handleTutorRequest(post('x'.repeat(LIMITS.bodyBytes + 1)), deps(model))
    expect(huge.status).toBe(413)

    const many = Array.from({ length: LIMITS.messages + 1 }, (_, index) => userMessage('hi', `u${index}`))
    expect((await handleTutorRequest(post({ messages: many }), deps(model))).status).toBe(400)
    expect(model.doStreamCalls).toHaveLength(0)
  })

  it('rejects malformed requests', async () => {
    const model = streamingModel(textStep('ok'))
    expect((await handleTutorRequest(new Request('http://localhost/api/tutor'), deps(model))).status).toBe(405)
    expect((await handleTutorRequest(post('{nope'), deps(model))).status).toBe(400)
    expect((await handleTutorRequest(post({ messages: [{ role: 'robot' }] }), deps(model))).status).toBe(400)
    const badContext = { messages: [userMessage('hi')], context: { selection: { kind: 'bone', id: 'unicorn_horn' } } }
    expect((await handleTutorRequest(post(badContext), deps(model))).status).toBe(400)
  })

  it('rate limits per visitor and says when to retry', async () => {
    const limiter: RateLimiter = createMemoryRateLimiter({ requests: 1, windowMs: 60_000 })
    const model = streamingModel(textStep('ok'))
    const first = await handleTutorRequest(
      post({ messages: [userMessage('hi')] }),
      deps(model, { rateLimiter: limiter }),
    )
    await first.text()
    const second = await handleTutorRequest(
      post({ messages: [userMessage('hi')] }),
      deps(model, { rateLimiter: limiter }),
    )

    expect(first.status).toBe(200)
    expect(second.status).toBe(429)
    expect(Number(second.headers.get('retry-after'))).toBeGreaterThan(0)
    const other = await handleTutorRequest(
      post({ messages: [userMessage('hi')] }, { 'x-forwarded-for': '198.51.100.2' }),
      deps(model, { rateLimiter: limiter }),
    )
    expect(other.status).toBe(200)
  })
})
