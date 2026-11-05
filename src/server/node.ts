import type { IncomingMessage, ServerResponse } from 'node:http'

/** Converts a Node request to a web Request. Reads at most `maxBytes + 1` bytes so oversize bodies fail fast. */
export async function toWebRequest(req: IncomingMessage, origin: string, maxBytes: number): Promise<Request> {
  const chunks: Buffer[] = []
  let size = 0
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    for await (const chunk of req as AsyncIterable<Buffer>) {
      size += chunk.length
      chunks.push(chunk)
      if (size > maxBytes) break
    }
  }
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    headers.set(name, Array.isArray(value) ? value.join(', ') : value)
  }
  const controller = new AbortController()
  req.once('close', () => {
    if (!req.complete) controller.abort()
  })
  return new Request(new URL(req.url ?? '/', origin), {
    method: req.method,
    headers,
    body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
    signal: controller.signal,
  })
}

/** Streams a web Response to a Node response, flushing each chunk as it arrives. */
export async function sendWebResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status
  response.headers.forEach((value, name) => res.setHeader(name, value))
  if (!response.body) {
    res.end()
    return
  }
  const reader = response.body.getReader()
  res.once('close', () => void reader.cancel().catch(() => {}))
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    res.write(value)
  }
  res.end()
}
