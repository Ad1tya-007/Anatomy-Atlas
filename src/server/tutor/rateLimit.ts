import type { ServerEnv } from '@/server/tutor/env'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export interface LimitResult {
  success: boolean
  /** Epoch milliseconds when the caller may try again. */
  reset: number
}

export interface RateLimiter {
  limit(ip: string): Promise<LimitResult>
}

/** Per visitor: enough for a real study session, not enough to farm the endpoint. */
export const PER_IP = { requests: 20, windowMs: 10 * 60_000 }
/** Across everyone: caps the worst-case daily bill. */
export const GLOBAL_PER_DAY = 3000

/** Sliding window in memory. Each serverless instance counts separately, so this only backs up Upstash. */
export function createMemoryRateLimiter(
  { requests, windowMs } = PER_IP,
  now: () => number = Date.now,
): RateLimiter & { reset(): void } {
  const hits = new Map<string, number[]>()
  return {
    async limit(ip) {
      const time = now()
      const recent = (hits.get(ip) ?? []).filter((at) => at > time - windowMs)
      if (recent.length >= requests) {
        hits.set(ip, recent)
        return { success: false, reset: recent[0]! + windowMs }
      }
      recent.push(time)
      hits.set(ip, recent)
      if (hits.size > 10_000) hits.delete(hits.keys().next().value!)
      return { success: true, reset: time + windowMs }
    },
    reset() {
      hits.clear()
    },
  }
}

function upstashCredentials(env: ServerEnv): { url: string; token: string } | null {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN
  return url && token ? { url, token } : null
}

/** Upstash Redis when configured (shared across instances), otherwise in memory. */
export function createRateLimiter(env: ServerEnv): RateLimiter {
  const credentials = upstashCredentials(env)
  if (!credentials) return createMemoryRateLimiter()
  const redis = new Redis(credentials)
  const perIp = new Ratelimit({
    redis,
    prefix: 'tutor:ip',
    limiter: Ratelimit.slidingWindow(PER_IP.requests, `${PER_IP.windowMs / 60_000} m`),
  })
  const global = new Ratelimit({ redis, prefix: 'tutor:all', limiter: Ratelimit.fixedWindow(GLOBAL_PER_DAY, '1 d') })
  return {
    async limit(ip) {
      const visitor = await perIp.limit(ip)
      if (!visitor.success) return { success: false, reset: visitor.reset }
      const everyone = await global.limit('all')
      return { success: everyone.success, reset: everyone.reset }
    },
  }
}

/** The client address behind Vercel's proxy. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || request.headers.get('x-real-ip') || 'unknown'
}
