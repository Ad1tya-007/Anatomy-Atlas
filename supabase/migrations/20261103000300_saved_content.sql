-- Things a signed-in learner keeps: named camera views and tutor conversations.

create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  -- The same shape the app puts in share links; the client validates it with the URL-state schema.
  view jsonb not null check (jsonb_typeof(view) = 'object' and pg_column_size(view) <= 4096),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index saved_views_user_created_at on public.saved_views (user_id, created_at desc);

create table public.tutor_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  messages jsonb not null default '[]' check (
    jsonb_typeof(messages) = 'array' and pg_column_size(messages) <= 262144
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tutor_threads_user_updated_at on public.tutor_threads (user_id, updated_at desc);

alter table public.saved_views enable row level security;
alter table public.tutor_threads enable row level security;

revoke all on table public.saved_views, public.tutor_threads from anon, authenticated;
grant select, delete on table public.saved_views, public.tutor_threads to authenticated;
grant insert (id, name, view), update (name, view) on table public.saved_views to authenticated;
grant insert (id, title, messages), update (title, messages) on table public.tutor_threads to authenticated;

create policy "Learners can read their own saved views"
  on public.saved_views for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Learners can save views"
  on public.saved_views for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Learners can rename their own saved views"
  on public.saved_views for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Learners can delete their own saved views"
  on public.saved_views for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Learners can read their own tutor threads"
  on public.tutor_threads for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Learners can start tutor threads"
  on public.tutor_threads for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Learners can continue their own tutor threads"
  on public.tutor_threads for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Learners can delete their own tutor threads"
  on public.tutor_threads for delete to authenticated
  using ((select auth.uid()) = user_id);

create trigger saved_views_set_updated_at
  before update on public.saved_views
  for each row execute function public.set_updated_at();
create trigger tutor_threads_set_updated_at
  before update on public.tutor_threads
  for each row execute function public.set_updated_at();

-- Keep one account from filling the database.
create function public.enforce_row_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  quota constant integer := tg_argv[0]::integer;
  existing integer;
begin
  execute format('select count(*) from %I.%I where user_id = $1', tg_table_schema, tg_table_name)
    into existing
    using new.user_id;
  if existing >= quota then
    raise exception 'You can keep at most % % rows', quota, tg_table_name
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_row_quota() from public, anon, authenticated;

create trigger saved_views_quota
  before insert on public.saved_views
  for each row execute function public.enforce_row_quota(100);
create trigger tutor_threads_quota
  before insert on public.tutor_threads
  for each row execute function public.enforce_row_quota(200);
