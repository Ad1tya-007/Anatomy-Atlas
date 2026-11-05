import type { Json } from '@/features/sync/database.types'
import { getSupabase } from '@/features/sync/client'
import type { TutorUIMessage } from '@/features/tutor/messages'
import { safeValidateUIMessages } from 'ai'

export interface TutorThreadSummary {
  id: string
  title: string
  updatedAt: string
}

export const THREAD_TITLE_MAX = 120
/** Under the 256 KB database check, leaving room for JSON encoding differences. */
const THREAD_BYTES_MAX = 200_000

export function threadTitle(messages: readonly TutorUIMessage[]): string {
  const first = messages.find((message) => message.role === 'user')
  const text = first?.parts.map((part) => (part.type === 'text' ? part.text : '')).join(' ') ?? ''
  const title = text.replaceAll(/\s+/g, ' ').trim()
  return (title.length > THREAD_TITLE_MAX ? `${title.slice(0, THREAD_TITLE_MAX - 1)}…` : title) || 'Tutor chat'
}

/** Drops the oldest messages until the thread fits the column limit. */
export function fitThread(messages: readonly TutorUIMessage[]): TutorUIMessage[] {
  let kept = [...messages]
  while (kept.length > 1 && new TextEncoder().encode(JSON.stringify(kept)).length > THREAD_BYTES_MAX) {
    kept = kept.slice(2)
  }
  return kept
}

export async function listTutorThreads(limit = 20): Promise<TutorThreadSummary[]> {
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('tutor_threads')
    .select('id, title, updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data.map((row) => ({ id: row.id, title: row.title, updatedAt: row.updated_at }))
}

export async function loadTutorThread(id: string): Promise<TutorUIMessage[]> {
  const supabase = await getSupabase()
  const { data, error } = await supabase.from('tutor_threads').select('messages').eq('id', id).single()
  if (error) throw error
  const validated = await safeValidateUIMessages<TutorUIMessage>({ messages: data.messages })
  return validated.success ? validated.data : []
}

/** Saves a thread, creating it when `id` is null. Returns the thread id. */
export async function saveTutorThread(id: string | null, messages: readonly TutorUIMessage[]): Promise<string> {
  const supabase = await getSupabase()
  const row = { title: threadTitle(messages), messages: fitThread(messages) as unknown as Json[] }
  if (id) {
    const { error } = await supabase.from('tutor_threads').update(row).eq('id', id)
    if (error) throw error
    return id
  }
  const { data, error } = await supabase.from('tutor_threads').insert(row).select('id').single()
  if (error) throw error
  return data.id
}

export async function deleteTutorThread(id: string): Promise<void> {
  const supabase = await getSupabase()
  const { error } = await supabase.from('tutor_threads').delete().eq('id', id)
  if (error) throw error
}
