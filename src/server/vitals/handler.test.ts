import { handleVitalsRequest, VITALS_MAX_BYTES } from '@/server/vitals/handler'
import { describe, expect, it } from 'vitest'

const payload = {
  path: '/',
  metrics: [
    { name: 'LCP', value: 1840, rating: 'good', id: 'v5-1', navigationType: 'navigate' },
    { name: 'CLS', value: 0.012, rating: 'good', id: 'v5-2', navigationType: 'navigate' },
  ],
  viewport: [1440, 900],
  dpr: 2,
  connection: '4g',
}

function log() {}

function post(body: string): Request {
  return new Request('https://atlas.test/api/vitals', { method: 'POST', body })
}

describe('vitals endpoint', () => {
  it('logs one JSON line per metric with the page context', async () => {
    const lines: string[] = []
    const response = await handleVitalsRequest(post(JSON.stringify(payload)), (line) => lines.push(line))
    expect(response.status).toBe(204)
    expect(lines.map((line) => JSON.parse(line))).toEqual([
      expect.objectContaining({ type: 'web-vital', name: 'LCP', value: 1840, path: '/', viewport: [1440, 900] }),
      expect.objectContaining({ type: 'web-vital', name: 'CLS', value: 0.012, dpr: 2, connection: '4g' }),
    ])
  })

  it('rejects other methods, malformed bodies, unknown metrics, and oversize beacons', async () => {
    expect((await handleVitalsRequest(new Request('https://atlas.test/api/vitals'), log)).status).toBe(405)
    expect((await handleVitalsRequest(post('{not json'), log)).status).toBe(400)
    const unknown = { ...payload, metrics: [{ ...payload.metrics[0], name: 'FID' }] }
    expect((await handleVitalsRequest(post(JSON.stringify(unknown)), log)).status).toBe(400)
    expect((await handleVitalsRequest(post('x'.repeat(VITALS_MAX_BYTES + 1)), log)).status).toBe(413)
  })
})
