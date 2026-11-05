import { getRepository, useSrsStore } from '@/features/srs/srsStore'
import { useAccountStore, type AccountUser } from '@/features/sync/accountStore'
import { hasAuthCallback, takeAuthCallback } from '@/features/sync/authCallback'
import { getSupabase, hasStoredSession, syncConfigured } from '@/features/sync/client'
import { createSupabaseRemote } from '@/features/sync/remote'
import { syncReviews } from '@/features/sync/syncEngine'
import type { Session } from '@supabase/supabase-js'

export type OAuthProvider = 'github' | 'google'

let started: Promise<void> | null = null

function userFrom(session: Session | null): AccountUser | null {
  if (!session) return null
  const meta = session.user.user_metadata as Record<string, unknown>
  const name = typeof meta.full_name === 'string' ? meta.full_name : typeof meta.name === 'string' ? meta.name : null
  return { id: session.user.id, email: session.user.email ?? null, name }
}

function redirectUrl(): string {
  return `${window.location.origin}${window.location.pathname}`
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Loads the client, restores or completes a sign-in, and keeps the account store current. Safe to call twice. */
export function startAccount(): Promise<void> {
  if (!syncConfigured) return Promise.resolve()
  started ??= (async () => {
    const { code, error } = takeAuthCallback()
    if (error) useAccountStore.setState({ authError: error, dialogOpen: true })
    useAccountStore.setState({ status: 'connecting' })
    try {
      const supabase = await getSupabase()
      supabase.auth.onAuthStateChange((_event, session) => {
        const user = userFrom(session)
        const previous = useAccountStore.getState().user
        useAccountStore.setState({ user, status: user ? 'signedIn' : 'signedOut' })
        // Calling Supabase inside this callback can deadlock its auth lock, so sync on the next tick.
        if (user && user.id !== previous?.id) setTimeout(() => void requestSync(), 0)
      })
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) useAccountStore.setState({ authError: exchangeError.message, dialogOpen: true })
      }
      const { data } = await supabase.auth.getSession()
      const user = userFrom(data.session)
      useAccountStore.setState({ user, status: user ? 'signedIn' : 'signedOut' })
    } catch (startError) {
      useAccountStore.setState({ status: 'signedOut', authError: message(startError) })
      started = null
    }
  })()
  return started
}

/** Loads accounts at startup only when there is something to restore; guests load it when they open the dialog. */
export function startAccountIfNeeded(): void {
  if (!syncConfigured) return
  if (hasAuthCallback() || hasStoredSession()) void startAccount()
}

export async function sendMagicLink(email: string): Promise<void> {
  await startAccount()
  const supabase = await getSupabase()
  useAccountStore.setState({ authError: null, emailSentTo: null })
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectUrl() } })
  if (error) {
    useAccountStore.setState({ authError: error.message })
    return
  }
  useAccountStore.setState({ emailSentTo: email })
}

export async function signInWithProvider(provider: OAuthProvider): Promise<void> {
  await startAccount()
  const supabase = await getSupabase()
  useAccountStore.setState({ authError: null })
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: redirectUrl() } })
  if (error) useAccountStore.setState({ authError: error.message })
}

/**
 * Signs out after a final sync, then clears this device so the next person starts as a guest. Refuses while
 * reviews are still unsynced, because they would otherwise be lost.
 */
export async function signOut(): Promise<void> {
  const supabase = await getSupabase()
  if ((await getRepository().unsynced()).length > 0) await requestSync()
  const left = (await getRepository().unsynced()).length
  if (left > 0) {
    throw new Error(
      `${left} ${left === 1 ? 'review has' : 'reviews have'} not synced yet. Reconnect and try again so they are not lost.`,
    )
  }
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  await useSrsStore.getState().reset()
  useAccountStore.setState({ user: null, status: 'signedOut', syncStatus: 'idle', lastSyncedAt: null })
}

let running: Promise<void> | null = null
let again = false

async function runSync(): Promise<void> {
  const { user } = useAccountStore.getState()
  if (!user) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    useAccountStore.setState({ syncStatus: 'offline' })
    return
  }
  useAccountStore.setState({ syncStatus: 'syncing', syncError: null })
  try {
    const supabase = await getSupabase()
    const srs = useSrsStore.getState()
    await srs.load()
    await syncReviews({
      repository: getRepository(),
      remote: createSupabaseRemote(supabase),
      userId: user.id,
      merge: (events) => useSrsStore.getState().merge(events),
      reload: () => useSrsStore.getState().reload(),
      cards: () => useSrsStore.getState().cards,
    })
    useAccountStore.setState({ syncStatus: 'synced', lastSyncedAt: new Date().toISOString() })
  } catch (error) {
    const offline = error instanceof TypeError || (typeof navigator !== 'undefined' && !navigator.onLine)
    useAccountStore.setState({ syncStatus: offline ? 'offline' : 'error', syncError: message(error) })
  }
}

/** Syncs now, or right after the sync already running. Concurrent calls share one run. */
export function requestSync(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      await runSync()
    } while (again)
  })().finally(() => {
    running = null
  })
  return running
}
