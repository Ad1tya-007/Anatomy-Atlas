import type { Database } from '@/features/sync/database.types'
import type { SrsCard } from '@/features/srs/scheduler'
import type { ReviewEvent } from '@/features/srs/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod/mini'

/** Position in the server's review log: rows are ordered by when the server received them, then by id. */
export interface PullCursor {
  receivedAt: string
  id: string
}

export interface PulledEvent {
  event: ReviewEvent
  cursor: PullCursor
}

/** The server side of sync. The Supabase implementation is below; tests use an in-memory one. */
export interface SyncRemote {
  /** Uploads events. Events the server already has are ignored. */
  push(events: readonly ReviewEvent[]): Promise<void>
  /** Returns up to `limit` events after `after` in server order, or from `since` when there is no exact cursor. */
  pull(position: { after: PullCursor } | { since: string } | null, limit: number): Promise<PulledEvent[]>
  /** Stores the current FSRS state of some cards for server-side queries. */
  saveCards(cards: readonly SrsCard[]): Promise<void>
}

type Client = SupabaseClient<Database>

const REVIEW_COLUMNS = 'id, card_id, grade, answer_mode, correct, response_ms, reviewed_at, received_at'

const reviewRow = z.object({
  id: z.string(),
  card_id: z.string().check(z.regex(/^(bone|landmark):[a-z0-9_]{1,64}$/)),
  grade: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  answer_mode: z.enum(['reveal', 'choice', 'type', 'locate']),
  correct: z.boolean(),
  response_ms: z.nullable(z.number()),
  reviewed_at: z.string(),
  received_at: z.string(),
})

function toRow(event: ReviewEvent): Database['public']['Tables']['review_logs']['Insert'] {
  return {
    id: event.id,
    card_id: event.cardId,
    grade: event.grade,
    answer_mode: event.answerMode,
    correct: event.correct,
    response_ms: event.responseMs,
    reviewed_at: event.reviewedAt,
  }
}

/** PostgREST filter values with `:` or `+` (timestamps) must be quoted inside `or()`. */
function quoted(value: string): string {
  return `"${value.replaceAll('"', '\\"')}"`
}

export function createSupabaseRemote(client: Client): SyncRemote {
  return {
    async push(events) {
      if (events.length === 0) return
      const { error } = await client
        .from('review_logs')
        .upsert(events.map(toRow), { onConflict: 'user_id,id', ignoreDuplicates: true })
      if (error) throw error
    },

    async pull(position, limit) {
      let query = client.from('review_logs').select(REVIEW_COLUMNS).order('received_at').order('id').limit(limit)
      if (position && 'after' in position) {
        const at = quoted(position.after.receivedAt)
        query = query.or(`received_at.gt.${at},and(received_at.eq.${at},id.gt.${position.after.id})`)
      } else if (position) {
        query = query.gte('received_at', position.since)
      }
      const { data, error } = await query
      if (error) throw error
      const pulled: PulledEvent[] = []
      for (const raw of data) {
        const parsed = reviewRow.safeParse(raw)
        if (!parsed.success) continue
        const row = parsed.data
        pulled.push({
          event: {
            id: row.id,
            cardId: row.card_id,
            grade: row.grade,
            reviewedAt: new Date(row.reviewed_at).toISOString(),
            answerMode: row.answer_mode,
            correct: row.correct,
            responseMs: row.response_ms,
          },
          cursor: { receivedAt: row.received_at, id: row.id },
        })
      }
      return pulled
    },

    async saveCards(cards) {
      if (cards.length === 0) return
      const rows = cards.map((card) => ({
        card_id: String(card.cardId),
        state: card.state,
        due_at: card.dueAt.toISOString(),
        last_review_at: card.lastReviewAt?.toISOString() ?? null,
        stability: card.stability,
        difficulty: card.difficulty,
        reps: card.reps,
        lapses: card.lapses,
      }))
      const { error } = await client.from('cards').upsert(rows, { onConflict: 'user_id,card_id' })
      if (error) throw error
    },
  }
}
