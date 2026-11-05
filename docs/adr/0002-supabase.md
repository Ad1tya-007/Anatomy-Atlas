# 0002. Hosted Supabase for accounts and sync

## Context

Phase 1 needs optional signed-in progress that survives a new browser, without making the 3D atlas depend on a backend. Guests already keep FSRS reviews in IndexedDB.

## Decision

Use **hosted Supabase**: Postgres, Auth, and the Data API. The client only ever sees `VITE_SUPABASE_URL` and the anon key. Guests skip `supabase-js` entirely (`syncConfigured` is false when those are empty).

Row-level security is the access control. pgTAP tests run against `supabase start` in CI. Hosted migrations apply on push to `main` when the project-ref secrets are set.

## Alternatives

- **Local-only IndexedDB.** Fine for a portfolio demo, but there is no resume story for RLS, Auth, or sync.
- **A custom Node API.** More code to authenticate, more surface to get wrong, and no hosted dashboard for OAuth providers.

## Status

Accepted.
