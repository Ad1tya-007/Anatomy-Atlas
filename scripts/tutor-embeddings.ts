/**
 * Embeds every atlas document for the embedding and hybrid retrieval evals.
 *
 *   npm run tutor:embeddings
 *
 * Needs AI Gateway credentials (AI_GATEWAY_API_KEY, or VERCEL_OIDC_TOKEN from `vercel env pull`) in .env.local.
 */
import { writeFileSync } from 'node:fs'
import { EMBEDDING_DIMENSIONS, embeddingModel } from '../src/server/tutor/env'
import { buildEmbeddingIndex } from '../src/server/tutor/embeddingRetriever'
import { loadLocalEnv } from './localEnv'

const OUTPUT = 'evals/embeddings.json'

loadLocalEnv()
const index = await buildEmbeddingIndex(embeddingModel(process.env), EMBEDDING_DIMENSIONS)
writeFileSync(OUTPUT, `${JSON.stringify(index)}\n`)
console.log(`Embedded ${Object.keys(index.vectors).length} documents with ${index.model} into ${OUTPUT}.`)
