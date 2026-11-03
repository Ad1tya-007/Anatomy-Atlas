import type { Database } from '@/features/sync/database.types'
import type { SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL ?? ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

/** Accounts and sync exist only when the build has a Supabase project. Otherwise the app is guest-only. */
export const syncConfigured = url !== '' && anonKey !== ''

export type Supabase = SupabaseClient<Database>

let client: Promise<Supabase> | null = null

/** Loads supabase-js on first use, so guests never download it. */
export function getSupabase(): Promise<Supabase> {
  if (!syncConfigured) return Promise.reject(new Error('Sync is not configured'))
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient<Database>(url, anonKey, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    }),
  )
  return client
}

/** Whether this browser kept a session from an earlier visit, which makes loading the client worthwhile. */
export function hasStoredSession(): boolean {
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key?.startsWith('sb-') && key.endsWith('-auth-token')) return true
    }
  } catch {
    // Storage can be blocked; then there is no stored session to restore.
  }
  return false
}
