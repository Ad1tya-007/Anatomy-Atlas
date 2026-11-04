import { createGateway, type EmbeddingModel, type LanguageModel } from 'ai'

export type ServerEnv = Readonly<Record<string, string | undefined>>

/** Cheap, fast, and good at tool use. Override with TUTOR_MODEL. */
export const DEFAULT_TUTOR_MODEL = 'anthropic/claude-haiku-5.5'
export const DEFAULT_EMBEDDING_MODEL = 'openai/text-embedding-3-small'
export const EMBEDDING_DIMENSIONS = 256

/**
 * AI Gateway, authenticated by AI_GATEWAY_API_KEY when set, otherwise by the Vercel OIDC token that Vercel injects
 * into functions (and `vercel env pull` writes to .env.local for local development).
 */
function provider(env: ServerEnv) {
  return createGateway({ apiKey: env.AI_GATEWAY_API_KEY || undefined })
}

export function tutorModel(env: ServerEnv): LanguageModel {
  return provider(env)(env.TUTOR_MODEL || DEFAULT_TUTOR_MODEL)
}

export function embeddingModel(env: ServerEnv): EmbeddingModel {
  return provider(env).embeddingModel(env.TUTOR_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL)
}
