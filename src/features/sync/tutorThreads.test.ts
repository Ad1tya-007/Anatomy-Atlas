import { fitThread, THREAD_TITLE_MAX, threadTitle } from '@/features/sync/tutorThreads'
import type { TutorUIMessage } from '@/features/tutor/messages'
import { describe, expect, it } from 'vitest'

function message(role: 'user' | 'assistant', text: string, id = text.slice(0, 8)): TutorUIMessage {
  return { id, role, parts: [{ type: 'text', text }] }
}

describe('threadTitle', () => {
  it('uses the first question, tidied and shortened', () => {
    expect(threadTitle([message('user', '  What is\nthe  femur? ')])).toBe('What is the femur?')
    const long = threadTitle([message('user', 'why '.repeat(100))])
    expect(long).toHaveLength(THREAD_TITLE_MAX)
    expect(long.endsWith('…')).toBe(true)
    expect(threadTitle([])).toBe('Tutor chat')
  })
})

describe('fitThread', () => {
  it('drops the oldest turns until the thread fits', () => {
    const big = 'x'.repeat(60_000)
    const thread = [1, 2, 3, 4].flatMap((turn) => [
      message('user', `q${turn}`, `u${turn}`),
      message('assistant', big, `a${turn}`),
    ])
    const fitted = fitThread(thread)
    expect(fitted.length).toBeLessThan(thread.length)
    expect(fitted[0]?.role).toBe('user')
    expect(fitted.at(-1)?.id).toBe('a4')
    expect(fitThread(thread.slice(0, 2))).toHaveLength(2)
  })
})
