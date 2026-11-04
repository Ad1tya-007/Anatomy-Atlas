import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { loadEnv, type Plugin } from 'vite'
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

/**
 * Serves /api/tutor from the dev server. The handler is loaded through Vite, so edits apply without a restart.
 * The AI Gateway client reads its credentials from process.env, so those two values are copied from .env.local.
 */
function tutorApi(): Plugin {
  return {
    name: 'atlas:tutor-api',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      for (const key of ['AI_GATEWAY_API_KEY', 'VERCEL_OIDC_TOKEN']) {
        if (env[key]) process.env[key] ??= env[key]
      }
      server.middlewares.use('/api/tutor', (req, res, next) => {
        server
          .ssrLoadModule('/src/server/tutor/nodeHandler.ts')
          .then((module) => module.handleNodeTutorRequest(req, res, env))
          .catch(next)
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === 'test' ? [] : [tutorApi()])],
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
      include: ['src/features/**', 'src/utils/**', 'src/data/**', 'src/store/**', 'src/server/**'],
      // Entry points and the demo model are exercised by the Vercel smoke test and the dev server, not unit tests.
      exclude: [
        '**/*.test.{ts,tsx}',
        'src/server/vercel/**',
        'src/server/tutor/nodeHandler.ts',
        'src/server/tutor/demoModel.ts',
      ],
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
