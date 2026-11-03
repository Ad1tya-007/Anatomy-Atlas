-- Spaced-repetition data.
--
-- review_logs is an append-only event log and the source of truth. Each device keeps its own copy in
-- IndexedDB, pushes events it has not synced, pulls everyone else's, and rebuilds card state by replaying
-- the merged log through FSRS. Because events never change and replay is deterministic, two devices that
-- studied offline converge on the same schedule without conflict resolution.

create table public.review_logs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Generated on the device, so a retried upload is stored once.
  id uuid not null,
  card_id text not null check (card_id ~ '^(bone|landmark):[a-z0-9_]{1,64}$'),
  grade smallint not null check (grade between 1 and 4),
  answer_mode text not null check (answer_mode in ('reveal', 'choice', 'type', 'locate')),
  correct boolean not null,
  response_ms integer check (response_ms between 0 and 3600000),
  reviewed_at timestamptz not null,
  -- Set by the server and used as the pull cursor, so a device with a wrong clock cannot hide events.
  received_at timestamptz not null default now(),
  primary key (user_id, id)
);

comment on table public.review_logs is 'Append-only log of answered study questions. Card state is a replay of this log.';

create index review_logs_user_received_at on public.review_logs (user_id, received_at);

alter table public.review_logs enable row level security;

revoke all on table public.review_logs from anon, authenticated;
grant select on table public.review_logs to authenticated;
-- No user_id or received_at: both come from the server. No update or delete: the log is append-only.
grant insert (id, card_id, grade, answer_mode, correct, response_ms, reviewed_at)
  on table public.review_logs to authenticated;

create policy "Learners can read their own review log"
  on public.review_logs for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Learners can append to their own review log"
  on public.review_logs for insert to authenticated
  with check ((select auth.uid()) = user_id);

create function public.reject_review_log_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'review_logs is append-only'
    using errcode = 'insufficient_privilege', hint = 'Append a new review instead.';
end;
$$;

revoke execute on function public.reject_review_log_update() from public, anon, authenticated;

-- Grants already stop the Data API roles; this also stops the service role and dashboard edits.
-- Deletes stay possible so that deleting an account cascades.
create trigger review_logs_append_only
  before update on public.review_logs
  for each row execute function public.reject_review_log_update();

-- A snapshot of each card's FSRS state, written by the client after it replays the log. Nothing reads
-- it back into the scheduler; it exists so the server can answer questions like "how many cards are
-- due" without replaying.
create table public.cards (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id text not null check (card_id ~ '^(bone|landmark):[a-z0-9_]{1,64}$'),
  state smallint not null check (state between 0 and 3),
  due_at timestamptz not null,
  last_review_at timestamptz,
  stability double precision not null check (stability >= 0),
  difficulty double precision not null check (difficulty >= 0),
  reps integer not null check (reps >= 0),
  lapses integer not null check (lapses >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

comment on table public.cards is 'Per-card FSRS snapshot derived from review_logs. review_logs is the source of truth.';

create index cards_user_due_at on public.cards (user_id, due_at);

alter table public.cards enable row level security;

revoke all on table public.cards from anon, authenticated;
grant select, delete on table public.cards to authenticated;
grant insert (card_id, state, due_at, last_review_at, stability, difficulty, reps, lapses)
  on table public.cards to authenticated;
grant update (state, due_at, last_review_at, stability, difficulty, reps, lapses)
  on table public.cards to authenticated;

create policy "Learners can read their own cards"
  on public.cards for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Learners can add their own cards"
  on public.cards for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Learners can update their own cards"
  on public.cards for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Learners can delete their own cards"
  on public.cards for delete to authenticated
  using ((select auth.uid()) = user_id);

create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();
