import { sendWebResponse, toWebRequest } from '@/server/node'
import { tutorModel, type ServerEnv } from '@/server/tutor/env'
import { handleTutorRequest, LIMITS, type TutorDeps } from '@/server/tutor/handler'
import { createRateLimiter } from '@/server/tutor/rateLimit'
import type { IncomingMessage, ServerResponse } from 'node:http'

let deps: TutorDeps | null = null

/**
 * The tutor as a Node handler, for the Vercel function and the Vite dev server.
 *
 * On Vercel, functions receive their OIDC token in a request header; the AI Gateway client reads it from the
 * environment, so it is copied there when no API key is configured.
 */
export async function handleNodeTutorRequest(req: IncomingMessage, res: ServerResponse, env: ServerEnv): Promise<void> {
  const oidc = req.headers['x-vercel-oidc-token']
  if (typeof oidc === 'string' && !env.AI_GATEWAY_API_KEY) process.env.VERCEL_OIDC_TOKEN = oidc
  if (!deps) {
    const model = env.TUTOR_MOCK === '1' ? (await import('@/server/tutor/demoModel')).demoTutorModel() : tutorModel(env)
    deps = { model, rateLimiter: createRateLimiter(env) }
  }
  const host = req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost'
  const protocol = req.headers['x-forwarded-proto'] ?? 'http'
  const request = await toWebRequest(req, `${protocol}://${host}`, LIMITS.bodyBytes)
  await sendWebResponse(res, await handleTutorRequest(request, deps))
}
