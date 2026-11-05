// @vitest-environment jsdom
import TutorPanel from '@/components/TutorPanel/TutorPanel'
import { tutorChat, useTutorNotes } from '@/features/tutor/tutorChat'
import { useAnatomyStore } from '@/store/anatomyStore'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const initial = useAnatomyStore.getState()

type Chunk = Record<string, unknown>

function stream(...chunks: Chunk[]): Response {
  const events = [{ type: 'start' }, { type: 'start-step' }, ...chunks, { type: 'finish-step' }, { type: 'finish' }]
  const body = `${events.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('')}data: [DONE]\n\n`
  return new Response(body, {
    headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
  })
}

function text(value: string): Chunk[] {
  return [
    { type: 'text-start', id: 't' },
    { type: 'text-delta', id: 't', delta: value },
    { type: 'text-end', id: 't' },
  ]
}

function mockTutor(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>()
  for (const response of responses) fetchMock.mockResolvedValueOnce(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function ask(question: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Ask the tutor' }), { target: { value: question } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
}

describe('TutorPanel', () => {
  beforeEach(() => {
    useAnatomyStore.setState(initial, true)
    tutorChat().messages = []
    useTutorNotes.getState().reset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the disclaimer and suggestions before the first question', () => {
    render(<TutorPanel />)
    expect(screen.getByText(/Educational use only, not medical advice/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'What is the greater trochanter?' })).toBeInTheDocument()
  })

  it('runs viewer tools, reports them, and continues the answer', async () => {
    const fetchMock = mockTutor(
      stream({
        type: 'tool-input-available',
        toolCallId: 'call-1',
        toolName: 'select_bone',
        input: { boneId: 'femur_left' },
      }),
      stream(...text('This is the femur [[bone:femur_left]].')),
    )
    render(<TutorPanel />)
    ask('Show me the femur')

    expect(await screen.findByText('Selected the left femur')).toBeInTheDocument()
    expect(useAnatomyStore.getState().selectedBoneId).toBe('femur_left')
    const chip = await screen.findByRole('button', { name: 'Femur' })
    expect(chip).toHaveAttribute('title', 'Open Femur in the viewer')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const first = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)
    expect(first.context).toEqual({ selection: null, look: 'atlas', studying: false })
    const second = JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)
    expect(JSON.stringify(second.messages)).toContain('"output":{"ok":true')
    expect(second.context.selection).toEqual({ kind: 'bone', id: 'femur_left' })

    fireEvent.click(screen.getByRole('button', { name: /Undo/ }))
    expect(useAnatomyStore.getState().selectedBoneId).toBeNull()
    expect(screen.queryByRole('button', { name: /Undo/ })).not.toBeInTheDocument()
  })

  it('renders generated questions as a quiz card', async () => {
    mockTutor(
      stream(
        {
          type: 'tool-input-available',
          toolCallId: 'q-1',
          toolName: 'generate_question',
          input: { kind: 'bone', topic: 'elbow' },
        },
        {
          type: 'tool-output-available',
          toolCallId: 'q-1',
          output: {
            fallback: false,
            question: {
              kind: 'bone',
              prompt: 'Which bone forms the point of the elbow?',
              choices: [
                { id: 'radius_left', label: 'Radius' },
                { id: 'ulna_left', label: 'Ulna' },
                { id: 'humerus_left', label: 'Humerus' },
              ],
              answerId: 'ulna_left',
              explanation: 'The olecranon belongs to the ulna.',
            },
          },
        },
      ),
    )
    render(<TutorPanel />)
    ask('Quiz me on the elbow')

    const choices = await screen.findByRole('group', { name: 'Choices' })
    fireEvent.click(within(choices).getByRole('button', { name: 'Radius' }))
    expect(screen.getByText('Not quite: it is Ulna.')).toBeInTheDocument()
    expect(screen.getByText('The olecranon belongs to the ulna.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show in the viewer' }))
    expect(useAnatomyStore.getState().selectedBoneId).toBe('ulna_left')
  })

  it('explains server errors such as rate limits', async () => {
    mockTutor(Response.json({ error: 'The tutor is busy. Try again in a few minutes.' }, { status: 429 }))
    render(<TutorPanel />)
    ask('What is the sternum?')
    expect(await screen.findByText('The tutor is busy. Try again in a few minutes.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('starts over with New chat', async () => {
    mockTutor(stream(...text('The sternum is the breastbone [[bone:sternum]].')))
    render(<TutorPanel />)
    ask('What is the sternum?')
    await screen.findByRole('button', { name: 'Sternum' })
    fireEvent.click(screen.getByRole('button', { name: 'New chat' }))
    await waitFor(() => expect(screen.queryByText(/breastbone/)).not.toBeInTheDocument())
  })
})
