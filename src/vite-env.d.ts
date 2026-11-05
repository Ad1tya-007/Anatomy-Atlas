/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL. Sign-in and sync stay hidden when it is unset. */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon (publishable) key. Safe to ship: row-level security protects the data. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
