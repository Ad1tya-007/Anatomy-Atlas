/**
 * Runs the integration tests against the local Supabase stack (`npm run db:start` first).
 *
 *   npm run test:integration
 */
import { execFileSync, spawnSync } from 'node:child_process'

interface Status {
  API_URL: string
  ANON_KEY: string
  SERVICE_ROLE_KEY: string
  MAILPIT_URL?: string
}

let status: Status
try {
  const output = execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8', stdio: 'pipe' })
  status = JSON.parse(output.slice(output.indexOf('{'))) as Status
} catch {
  console.error('The local Supabase stack is not running. Start it with `npm run db:start`.')
  process.exit(1)
}

const result = spawnSync('npx', ['vitest', 'run', '.integration.test.', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: {
    ...process.env,
    SUPABASE_TEST_URL: status.API_URL,
    SUPABASE_TEST_ANON_KEY: status.ANON_KEY,
    SUPABASE_TEST_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    SUPABASE_TEST_MAILPIT_URL: status.MAILPIT_URL ?? '',
  },
})
process.exit(result.status ?? 1)
