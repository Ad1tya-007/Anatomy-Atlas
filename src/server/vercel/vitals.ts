import { sendWebResponse, toWebRequest } from '@/server/node'
import { handleVitalsRequest, VITALS_MAX_BYTES } from '@/server/vitals/handler'
import type { IncomingMessage, ServerResponse } from 'node:http'

/** Entry point of the `api/vitals` Vercel function, bundled by scripts/build-vercel.ts. */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const request = await toWebRequest(req, `https://${req.headers.host ?? 'localhost'}`, VITALS_MAX_BYTES)
  await sendWebResponse(res, await handleVitalsRequest(request))
}
