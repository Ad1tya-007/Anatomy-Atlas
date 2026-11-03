import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * Exposes the Supabase URL and anon key to the client under either their VITE_ or plain names. Only these two
 * values are forwarded; a `SUPABASE_` env prefix would also expose the service-role key. Tests always run as a guest.
 */
function supabaseEnv(mode: string): Record<string, string> {
  if (mode === 'test') return {}
  const env = loadEnv(mode, process.cwd(), '')
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL || ''
  const key = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || ''
  return {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(url),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(key),
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  define: supabaseEnv(mode),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    // Day boundaries (streaks, daily limits) depend on the time zone.
    env: { TZ: 'UTC' },
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text', 'html', 'lcov', 'json-summary'],
      include: ['src/features/**', 'src/utils/**', 'src/data/**', 'src/store/**'],
      exclude: ['**/*.test.{ts,tsx}'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
        'src/features/study/**': { lines: 90, functions: 90, branches: 85, statements: 90 },
      },
    },
  },
}))
