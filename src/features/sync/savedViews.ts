import type { Json } from '@/features/sync/database.types'
import { getSupabase } from '@/features/sync/client'
import type { ViewState } from '@/types/anatomy'
import { decodeView, encodeView, hasView } from '@/utils/urlState'

export interface SavedView {
  id: string
  name: string
  view: ViewState
  createdAt: string
}

export const SAVED_VIEW_NAME_MAX = 80

/** Stored views go through the same schema as share links, so a hand-edited row cannot break the viewer. */
function sanitize(raw: unknown): ViewState {
  try {
    return decodeView(encodeView(raw as ViewState))
  } catch {
    return {}
  }
}

export async function listSavedViews(): Promise<SavedView[]> {
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('saved_views')
    .select('id, name, view, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.flatMap((row) => {
    const view = sanitize(row.view)
    return hasView(view) ? [{ id: row.id, name: row.name, view, createdAt: row.created_at }] : []
  })
}

export async function saveView(name: string, view: ViewState): Promise<SavedView> {
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('saved_views')
    .insert({ name: name.trim().slice(0, SAVED_VIEW_NAME_MAX), view: sanitize(view) as { [key: string]: Json } })
    .select('id, name, view, created_at')
    .single()
  if (error) throw error
  return { id: data.id, name: data.name, view: sanitize(data.view), createdAt: data.created_at }
}

export async function deleteSavedView(id: string): Promise<void> {
  const supabase = await getSupabase()
  const { error } = await supabase.from('saved_views').delete().eq('id', id)
  if (error) throw error
}
