import { createMemoryRepository } from '@/features/srs/repository'
import { createScheduler, replay, type SrsCard } from '@/features/srs/scheduler'
import type { Grade, ReviewEvent } from '@/features/srs/types'
import type { Database } from '@/features/sync/database.types'
import { createSupabaseRemote } from '@/features/sync/remote'
import { BATCH_SIZE, syncReviews } from '@/features/sync/syncEngine'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Runs only through `npm run test:integration`, which points these at the local stack.
const url = process.env.SUPABASE_TEST_URL
const anonKey = process.env.SUPABASE_TEST_ANON_KEY
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY

type Client = SupabaseClient<Database>

const scheduler = await createScheduler()
const run = crypto.randomUUID().slice(0, 8)

function review(cardId: string, grade: Grade, reviewedAt: string): ReviewEvent {
  return {
    id: crypto.randomUUID(),
    cardId,
    grade,
    reviewedAt,
    answerMode: 'type',
    correct: grade > 1,
    responseMs: 4200,
  }
}

function due(cards: ReadonlyMap<string, SrsCard>) {
  return Object.fromEntries([...cards].map(([id, card]) => [id, card.dueAt.toISOString()]))
}

function device(client: Client, userId: string) {
  const repository = createMemoryRepository()
  let cards = new Map<string, SrsCard>()
  const rebuild = async () => {
    cards = replay(scheduler, await repository.all())
  }
  return {
    repository,
    get cards() {
      return cards
    },
    async study(...events: ReviewEvent[]) {
      await repository.add(events, { synced: false })
      await rebuild()
    },
    sync() {
      return syncReviews({
        repository,
        remote: createSupabaseRemote(client),
        userId,
        merge: async (events) => {
          const added = await repository.add(events, { synced: true })
          await rebuild()
          return added.length
        },
        reload: rebuild,
        cards: () => cards,
      })
    },
  }
}

describe.skipIf(!url || !anonKey || !serviceKey)('sync against Supabase', () => {
  let admin: Client
  const users: { id: string; client: Client }[] = []

  async function signUp(name: string) {
    const email = `${name}-${run}@example.com`
    const password = `pw-${crypto.randomUUID()}`
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) throw error
    const client = createClient<Database>(url!, anonKey!, { auth: { persistSession: false } })
    const signIn = await client.auth.signInWithPassword({ email, password })
    if (signIn.error) throw signIn.error
    const user = { id: data.user.id, client }
    users.push(user)
    return user
  }

  let ada: Awaited<ReturnType<typeof signUp>>
  let bo: Awaited<ReturnType<typeof signUp>>

  beforeAll(async () => {
    admin = createClient<Database>(url!, serviceKey!, { auth: { persistSession: false } })
    ada = await signUp('ada')
    bo = await signUp('bo')
  })

  afterAll(async () => {
    for (const user of users) await admin.auth.admin.deleteUser(user.id)
  })

  it('syncs two devices through the real tables and keeps learners apart', async () => {
    const phone = device(ada.client, ada.id)
    const laptop = device(ada.client, ada.id)
    await phone.study(
      review('bone:femur_left', 3, '2026-10-01T08:00:00Z'),
      review('landmark:linea_aspera', 2, '2026-10-01T08:01:00Z'),
    )
    await laptop.study(review('bone:femur_left', 1, '2026-10-01T19:00:00Z'))

    expect((await phone.sync()).pushed).toBe(2)
    expect(await laptop.sync()).toMatchObject({ pushed: 1, pulled: 2 })
    expect((await phone.sync()).pulled).toBe(1)

    expect(due(phone.cards)).toEqual(due(laptop.cards))

    const { data: snapshots } = await ada.client.from('cards').select('card_id, reps')
    expect(snapshots?.find((row) => row.card_id === 'bone:femur_left')?.reps).toBe(2)

    const stranger = device(bo.client, bo.id)
    expect((await stranger.sync()).pulled).toBe(0)
    const { data: visible } = await bo.client.from('review_logs').select('id')
    expect(visible).toEqual([])
  })

  it('ignores re-uploads and pages through large logs', async () => {
    const phone = device(ada.client, ada.id)
    const events = Array.from({ length: BATCH_SIZE + 25 }, (_, index) =>
      review('bone:tibia_left', 3, new Date(Date.parse('2025-01-01T00:00:00Z') + index * 86_400_000).toISOString()),
    )
    await phone.study(...events)
    await phone.sync()

    const remote = createSupabaseRemote(ada.client)
    await remote.push(events.slice(0, 10))
    const { count } = await ada.client
      .from('review_logs')
      .select('id', { count: 'exact', head: true })
      .eq('card_id', 'bone:tibia_left')
    expect(count).toBe(events.length)

    const fresh = device(ada.client, ada.id)
    const result = await fresh.sync()
    expect(result.pulled).toBe(events.length + 3)
    expect(fresh.cards.get('bone:tibia_left')!.reps).toBe(events.length)
  })

  it('refuses rows that claim another learner or rewrite history', async () => {
    const spoofed = await ada.client.from('review_logs').insert({
      id: crypto.randomUUID(),
      user_id: bo.id,
      card_id: 'bone:femur_left',
      grade: 3,
      answer_mode: 'choice',
      correct: true,
      reviewed_at: new Date().toISOString(),
    })
    expect(spoofed.error?.code).toBe('42501')

    const rewrite = await ada.client.from('review_logs').update({ grade: 4 }).eq('card_id', 'bone:femur_left')
    expect(rewrite.error?.code).toBe('42501')
  })

  it('stores saved views per learner', async () => {
    const saved = await ada.client
      .from('saved_views')
      .insert({ name: 'Knee', view: { boneId: 'patella_left' } })
      .select('id')
      .single()
    expect(saved.error).toBeNull()
    const { data: mine } = await ada.client.from('saved_views').select('name')
    const { data: theirs } = await bo.client.from('saved_views').select('name')
    expect(mine).toEqual([{ name: 'Knee' }])
    expect(theirs).toEqual([])
  })
})
