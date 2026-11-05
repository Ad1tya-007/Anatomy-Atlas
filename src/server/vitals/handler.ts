import { z } from 'zod'

export const VITALS_MAX_BYTES = 4096

const payloadSchema = z.object({
  path: z.string().max(200),
  metrics: z
    .array(
      z.object({
        name: z.enum(['CLS', 'FCP', 'INP', 'LCP', 'TTFB']),
        value: z.number().finite().nonnegative().max(600_000),
        rating: z.enum(['good', 'needs-improvement', 'poor']),
        id: z.string().max(80),
        navigationType: z.string().max(40),
      }),
    )
    .min(1)
    .max(5),
  viewport: z.tuple([z.number().int().nonnegative().max(20_000), z.number().int().nonnegative().max(20_000)]),
  dpr: z.number().positive().max(8),
  connection: z.string().max(20).optional(),
})

export type VitalsLog = (line: string) => void

/**
 * Accepts a beacon from `startVitals` and writes one JSON line per metric, which a log drain can aggregate into
 * p75 by metric and page. Nothing is stored, and no IP or user id is logged.
 */
function stdout(line: string): void {
  process.stdout.write(`${line}\n`)
}

export async function handleVitalsRequest(request: Request, log: VitalsLog = stdout): Promise<Response> {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } })
  const text = await request.text()
  if (text.length > VITALS_MAX_BYTES) return new Response(null, { status: 413 })
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return new Response(null, { status: 400 })
  }
  const parsed = payloadSchema.safeParse(body)
  if (!parsed.success) return new Response(null, { status: 400 })
  const { metrics, ...context } = parsed.data
  const at = new Date().toISOString()
  for (const metric of metrics) log(JSON.stringify({ type: 'web-vital', at, ...metric, ...context }))
  return new Response(null, { status: 204 })
}
