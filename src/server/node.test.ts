import { sendWebResponse, toWebRequest } from '@/server/node'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'

let server: Server | null = null

afterEach(async () => {
  server?.closeAllConnections()
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()))
  server = null
})

async function serve(handle: (request: Request) => Promise<Response>, maxBytes = 1024): Promise<string> {
  server = createServer((req, res) => {
    toWebRequest(req, 'http://localhost', maxBytes)
      .then(handle)
      .then((response) => sendWebResponse(res, response))
      .catch(() => res.destroy())
  })
  await new Promise<void>((resolve) => server!.listen(0, resolve))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

describe('Node adapter', () => {
  it('passes method, headers, and body through and streams the response', async () => {
    const url = await serve(async (request) => {
      const body = await request.text()
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(`${request.method} ${new URL(request.url).pathname} `))
          controller.enqueue(new TextEncoder().encode(`${request.headers.get('x-test')} ${body}`))
          controller.close()
        },
      })
      return new Response(stream, { status: 201, headers: { 'x-reply': 'yes' } })
    })

    const response = await fetch(`${url}/api/tutor`, { method: 'POST', headers: { 'x-test': 'hello' }, body: 'ping' })
    expect(response.status).toBe(201)
    expect(response.headers.get('x-reply')).toBe('yes')
    expect(await response.text()).toBe('POST /api/tutor hello ping')
  })

  it('stops reading a body once it is over the limit', async () => {
    const url = await serve(async (request) => new Response(String((await request.arrayBuffer()).byteLength)), 10)
    const response = await fetch(url, { method: 'POST', body: 'x'.repeat(600_000) })
    const read = Number(await response.text())
    expect(read).toBeGreaterThan(10)
    expect(read).toBeLessThan(600_000)
  })

  it('sends empty responses', async () => {
    const url = await serve(async () => new Response(null, { status: 204 }))
    const response = await fetch(url)
    expect(response.status).toBe(204)
  })
})
