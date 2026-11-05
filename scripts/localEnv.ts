import { loadEnv } from 'vite'

/** Copies .env and .env.local into process.env for scripts, without overriding variables that are already set. */
export function loadLocalEnv(): void {
  for (const [key, value] of Object.entries(loadEnv('development', process.cwd(), ''))) {
    process.env[key] ??= value
  }
}
