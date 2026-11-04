import { handleNodeTutorRequest } from '@/server/tutor/nodeHandler'
import type { IncomingMessage, ServerResponse } from 'node:http'

/** Entry point of the `api/tutor` Vercel function, bundled by scripts/build-vercel.ts. */
export default function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  return handleNodeTutorRequest(req, res, process.env)
}
