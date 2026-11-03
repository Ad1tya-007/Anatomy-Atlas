export interface AuthCallback {
  /** PKCE code from a magic link or OAuth redirect. */
  code: string | null
  error: string | null
}

const PARAMS = ['code', 'error', 'error_code', 'error_description']

function read(): AuthCallback {
  if (typeof window === 'undefined') return { code: null, error: null }
  const url = new URL(window.location.href)
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  const code = url.searchParams.get('code')
  const error =
    url.searchParams.get('error_description') ?? hash.get('error_description') ?? url.searchParams.get('error')
  if (!code && !error) return { code: null, error: null }
  for (const param of PARAMS) {
    url.searchParams.delete(param)
    hash.delete(param)
  }
  url.hash = hash.size > 0 ? hash.toString() : ''
  window.history.replaceState(window.history.state, '', url)
  return { code, error }
}

/**
 * Read once, when the module loads, so the auth parameters are gone before the view-sync hook rewrites the query
 * string and before anything is shared.
 */
let callback: AuthCallback | null = read()

/** Whether the page opened from a sign-in redirect that has not been handled yet. */
export function hasAuthCallback(): boolean {
  return Boolean(callback?.code ?? callback?.error)
}

/** Returns the auth redirect parameters the page opened with, once. */
export function takeAuthCallback(): AuthCallback {
  const taken = callback ?? { code: null, error: null }
  callback = null
  return taken
}
