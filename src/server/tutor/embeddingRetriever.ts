import { atlasCorpus, type AtlasDoc } from '@/features/tutor/corpus'
import { fuse, searchBm25, searchEmbedding, type EmbeddingIndex, type RetrievalMode } from '@/features/tutor/retrieval'
import type { Retriever } from '@/server/tutor/handler'
import { embed, embedMany, type EmbeddingModel } from 'ai'

export function embeddingText(doc: AtlasDoc): string {
  return [doc.title, doc.aliases.join(', '), doc.text].filter(Boolean).join('\n')
}

export async function buildEmbeddingIndex(model: EmbeddingModel, dimensions: number): Promise<EmbeddingIndex> {
  const { embeddings } = await embedMany({
    model,
    values: atlasCorpus.map(embeddingText),
    maxParallelCalls: 2,
    providerOptions: { openai: { dimensions } },
  })
  const vectors: Record<string, number[]> = {}
  atlasCorpus.forEach((doc, index) => {
    vectors[doc.key] = embeddings[index]!.map((value) => Math.round(value * 10_000) / 10_000)
  })
  const modelId = typeof model === 'string' ? model : model.modelId
  return { model: modelId, dimensions, vectors }
}

/** A retriever for `mode`. Embedding modes embed each query, so they cost one extra call per question. */
export function createRetriever(
  mode: RetrievalMode,
  options: { model?: EmbeddingModel; index?: EmbeddingIndex; limit?: number } = {},
): Retriever {
  const limit = options.limit ?? 6
  if (mode === 'bm25') return (query) => searchBm25(query, limit)
  const { model, index } = options
  if (!model || !index) throw new Error(`Retrieval mode "${mode}" needs an embedding model and index.`)
  return async (query, abortSignal) => {
    const { embedding } = await embed({
      model,
      value: query,
      abortSignal,
      providerOptions: { openai: { dimensions: index.dimensions } },
    })
    const semantic = searchEmbedding(index, embedding, mode === 'hybrid' ? limit * 2 : limit)
    if (mode === 'embedding') return semantic
    return fuse([searchBm25(query, limit * 2), semantic], limit)
  }
}
