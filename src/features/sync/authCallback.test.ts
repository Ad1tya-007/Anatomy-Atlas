// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

async function load(url: string) {
  window.history.replaceState(null, '', url)
  vi.resetModules()
  return import('@/features/sync/authCallback')
}

describe('auth callback', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('takes the sign-in code and leaves the shared view in the URL', async () => {
    const { hasAuthCallback, takeAuthCallback } = await load('/?b=femur_left&code=abc123&look=ivory')

    expect(window.location.search).toBe('?b=femur_left&look=ivory')
    expect(hasAuthCallback()).toBe(true)
    expect(takeAuthCallback()).toEqual({ code: 'abc123', error: null })
    expect(hasAuthCallback()).toBe(false)
    expect(takeAuthCallback()).toEqual({ code: null, error: null })
  })

  it('reports an expired link from the hash and clears it', async () => {
    const { takeAuthCallback } = await load(
      '/?b=tibia_left#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    )

    expect(window.location.hash).toBe('')
    expect(window.location.search).toBe('?b=tibia_left')
    expect(takeAuthCallback()).toEqual({ code: null, error: 'Email link is invalid or has expired' })
  })

  it('leaves ordinary URLs alone', async () => {
    const { hasAuthCallback } = await load('/?b=femur_left#notes')

    expect(window.location.href).toMatch(/\?b=femur_left#notes$/)
    expect(hasAuthCallback()).toBe(false)
  })
})
