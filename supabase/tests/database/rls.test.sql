-- Row-level security and data-integrity tests. Run with `npm run db:test` (needs `npm run db:start`).
begin;
create extension if not exists pgtap with schema extensions;
select plan(42);

-- Two learners. Tests switch between them by setting the JWT claims PostgREST would set.
insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('11111111-1111-4111-8111-111111111111', 'ada@example.com', '{"full_name": "Ada Lovelace"}', 'authenticated', 'authenticated'),
  ('22222222-2222-4222-8222-222222222222', 'bo@example.com', '{}', 'authenticated', 'authenticated');

create function pg_temp.sign_in(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.sign_out() returns void language sql as $$
  select set_config('role', 'anon', true),
         set_config('request.jwt.claims', '{"role": "anon"}', true);
$$;

-- Schema ----------------------------------------------------------------------------------------------

select ok(
  (select bool_and(relrowsecurity) from pg_class
   where oid in ('public.profiles'::regclass, 'public.review_logs'::regclass, 'public.cards'::regclass,
                 'public.saved_views'::regclass, 'public.tutor_threads'::regclass)),
  'row-level security is on for every table'
);

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and (has_function_privilege('anon', p.oid, 'execute')
                                   or has_function_privilege('authenticated', p.oid, 'execute'))),
  0,
  'no public function is callable through the Data API'
);

select is(
  (select display_name from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  'Ada Lovelace',
  'sign-up creates a profile named from the OAuth metadata'
);

select is(
  (select display_name from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
  'bo',
  'a magic-link sign-up falls back to the email name'
);

-- Ada writes --------------------------------------------------------------------------------------------

select pg_temp.sign_in('11111111-1111-4111-8111-111111111111');

select lives_ok(
  $$ insert into public.review_logs (id, card_id, grade, answer_mode, correct, response_ms, reviewed_at)
     values ('aaaaaaaa-0000-4000-8000-000000000001', 'bone:femur_left', 3, 'choice', true, 2400, now()) $$,
  'a learner can log a review'
);

select is(
  (select user_id from public.review_logs where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'the review belongs to the signed-in learner'
);

select lives_ok(
  $$ insert into public.review_logs (id, card_id, grade, answer_mode, correct, response_ms, reviewed_at)
     values ('aaaaaaaa-0000-4000-8000-000000000001', 'bone:femur_left', 3, 'choice', true, 2400, now())
     on conflict do nothing $$,
  're-uploading the same event is a no-op'
);

select is(
  (select count(*)::int from public.review_logs),
  1,
  'the retried event is stored once'
);

select throws_ok(
  $$ insert into public.review_logs (id, user_id, card_id, grade, answer_mode, correct, reviewed_at)
     values (gen_random_uuid(), '22222222-2222-4222-8222-222222222222', 'bone:femur_left', 3, 'choice', true, now()) $$,
  '42501',
  null,
  'a learner cannot write into someone else''s log'
);

select throws_ok(
  $$ insert into public.review_logs (id, card_id, grade, answer_mode, correct, reviewed_at, received_at)
     values (gen_random_uuid(), 'bone:femur_left', 3, 'choice', true, now(), now() + interval '1 year') $$,
  '42501',
  null,
  'the server sets received_at, so the pull cursor cannot be spoofed'
);

select throws_ok(
  $$ update public.review_logs set grade = 4 $$,
  '42501',
  null,
  'reviews cannot be edited'
);

select throws_ok(
  $$ delete from public.review_logs $$,
  '42501',
  null,
  'reviews cannot be deleted'
);

select throws_ok(
  $$ insert into public.review_logs (id, card_id, grade, answer_mode, correct, reviewed_at)
     values (gen_random_uuid(), 'bone:femur_left', 5, 'choice', true, now()) $$,
  '23514',
  null,
  'grades outside 1 to 4 are rejected'
);

select throws_ok(
  $$ insert into public.review_logs (id, card_id, grade, answer_mode, correct, reviewed_at)
     values (gen_random_uuid(), 'bone:../../etc', 3, 'choice', true, now()) $$,
  '23514',
  null,
  'malformed card ids are rejected'
);

select throws_ok(
  $$ insert into public.review_logs (id, card_id, grade, answer_mode, correct, reviewed_at)
     values (gen_random_uuid(), 'bone:femur_left', 3, 'telepathy', true, now()) $$,
  '23514',
  null,
  'unknown answer modes are rejected'
);

select lives_ok(
  $$ insert into public.cards (card_id, state, due_at, last_review_at, stability, difficulty, reps, lapses)
     values ('bone:femur_left', 2, now() + interval '3 days', now(), 3.2, 5.1, 1, 0)
     on conflict (user_id, card_id) do update set due_at = excluded.due_at, reps = excluded.reps $$,
  'a learner can upsert a card snapshot'
);

select lives_ok(
  $$ insert into public.cards (card_id, state, due_at, last_review_at, stability, difficulty, reps, lapses)
     values ('bone:femur_left', 2, now() + interval '9 days', now(), 8.4, 5.0, 2, 0)
     on conflict (user_id, card_id) do update set due_at = excluded.due_at, reps = excluded.reps $$,
  'upserting the same card updates it'
);

select is(
  (select reps from public.cards where card_id = 'bone:femur_left'),
  2,
  'the card holds the latest snapshot'
);

select throws_ok(
  $$ insert into public.cards (user_id, card_id, state, due_at, stability, difficulty, reps, lapses)
     values ('22222222-2222-4222-8222-222222222222', 'bone:tibia_left', 0, now(), 0, 0, 0, 0) $$,
  '42501',
  null,
  'a learner cannot write someone else''s card'
);

select lives_ok(
  $$ insert into public.saved_views (name, view) values ('Knee from the side', '{"boneId": "patella_left", "look": "ivory"}') $$,
  'a learner can save a view'
);

select throws_ok(
  $$ insert into public.saved_views (name, view) values ('   ', '{}') $$,
  '23514',
  null,
  'saved views need a name'
);

select throws_ok(
  $$ insert into public.saved_views (name, view) values ('Not an object', '[1, 2]') $$,
  '23514',
  null,
  'saved views must be objects'
);

select throws_ok(
  format(
    $$ insert into public.saved_views (name, view) values ('Huge', jsonb_build_object('pad', %L)) $$,
    repeat(md5(random()::text), 200)
  ),
  '23514',
  null,
  'saved views are capped at 4 kB'
);

select lives_ok(
  $$ insert into public.saved_views (name, view) select 'View ' || n, '{}' from generate_series(2, 100) as n $$,
  'a learner can keep 100 saved views'
);

select throws_ok(
  $$ insert into public.saved_views (name, view) values ('One too many', '{}') $$,
  '23514',
  null,
  'the 101st saved view is refused'
);

select lives_ok(
  $$ insert into public.tutor_threads (title, messages)
     values ('Rotator cuff', '[{"role": "user", "parts": [{"type": "text", "text": "Where does supraspinatus attach?"}]}]') $$,
  'a learner can keep a tutor thread'
);

select lives_ok(
  $$ update public.profiles set display_name = 'Ada' $$,
  'a learner can rename themselves'
);

select throws_ok(
  $$ update public.profiles set id = '22222222-2222-4222-8222-222222222222' $$,
  '42501',
  null,
  'a learner cannot change their profile id'
);

-- Bo reads ----------------------------------------------------------------------------------------------

select pg_temp.sign_in('22222222-2222-4222-8222-222222222222');

select is_empty($$ select 1 from public.review_logs $$, 'another learner''s reviews are invisible');
select is_empty($$ select 1 from public.cards $$, 'another learner''s cards are invisible');
select is_empty($$ select 1 from public.saved_views $$, 'another learner''s saved views are invisible');
select is_empty($$ select 1 from public.tutor_threads $$, 'another learner''s tutor threads are invisible');

select results_eq(
  $$ select id from public.profiles $$,
  $$ values ('22222222-2222-4222-8222-222222222222'::uuid) $$,
  'a learner sees only their own profile'
);

update public.saved_views set name = 'Hijacked';
delete from public.saved_views;
delete from public.tutor_threads;
delete from public.cards;
update public.profiles set display_name = 'Hijacked' where id = '11111111-1111-4111-8111-111111111111';

-- Back to Ada: nothing Bo did reached her rows.
select pg_temp.sign_in('11111111-1111-4111-8111-111111111111');

select is(
  (select count(*)::int from public.saved_views where name = 'Hijacked'),
  0,
  'another learner cannot rename my views'
);
select is((select count(*)::int from public.tutor_threads), 1, 'another learner cannot delete my threads');
select is((select count(*)::int from public.cards), 1, 'another learner cannot delete my cards');
select is((select display_name from public.profiles), 'Ada', 'another learner cannot rename me');

-- Anonymous visitors -------------------------------------------------------------------------------------

select pg_temp.sign_out();

select throws_ok($$ select 1 from public.review_logs $$, '42501', null, 'anonymous visitors cannot read reviews');
select throws_ok(
  $$ insert into public.review_logs (id, card_id, grade, answer_mode, correct, reviewed_at)
     values (gen_random_uuid(), 'bone:femur_left', 3, 'choice', true, now()) $$,
  '42501',
  null,
  'anonymous visitors cannot log reviews'
);
select throws_ok($$ select 1 from public.profiles $$, '42501', null, 'anonymous visitors cannot list profiles');
select throws_ok($$ select 1 from public.saved_views $$, '42501', null, 'anonymous visitors cannot read saved views');

-- Integrity beyond the Data API ------------------------------------------------------------------------

reset role;

select throws_ok(
  $$ update public.review_logs set grade = 1 $$,
  '42501',
  'review_logs is append-only',
  'even the service role cannot rewrite history'
);

select * from finish();
rollback;
