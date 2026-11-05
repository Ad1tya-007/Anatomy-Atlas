import { createBm25 } from '@/features/tutor/bm25'
import { atlasCorpus, type AtlasDoc } from '@/features/tutor/corpus'

export type RetrievalMode = 'bm25' | 'embedding' | 'hybrid'

export interface RetrievedDoc {
  doc: AtlasDoc
  score: number
}

const bm25 = createBm25(atlasCorpus, [
  // A landmark title names its bone, "Head (Femur)"; only its own name should outrank the bone's document.
  { get: (doc) => doc.title.replace(/\s*\(.*\)$/, ''), weight: 3 },
  { get: (doc) => doc.aliases, weight: 2 },
  { get: (doc) => doc.text, weight: 1 },
])

export function searchBm25(query: string, limit = 6): RetrievedDoc[] {
  return bm25.search(query, limit).map((hit) => ({ doc: hit.item, score: hit.score }))
}

/** Precomputed document vectors, keyed by citation key. Built by `npm run tutor:embeddings`. */
export interface EmbeddingIndex {
  model: string
  dimensions: number
  vectors: Record<string, number[]>
}

function cosine(a: readonly number[], b: readonly number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index]! * b[index]!
    normA += a[index]! * a[index]!
    normB += b[index]! * b[index]!
  }
  return dot / (Math.sqrt(normA * normB) || 1)
}

export function searchEmbedding(index: EmbeddingIndex, queryVector: readonly number[], limit = 6): RetrievedDoc[] {
  return atlasCorpus
    .flatMap((doc) => {
      const vector = index.vectors[doc.key]
      return vector ? [{ doc, score: cosine(queryVector, vector) }] : []
    })
    .toSorted((a, b) => b.score - a.score)
    .slice(0, limit)
}

/** Reciprocal rank fusion: robust to the very different score scales of BM25 and cosine similarity. */
export function fuse(lists: readonly RetrievedDoc[][], limit = 6, k = 60): RetrievedDoc[] {
  const scores = new Map<string, RetrievedDoc>()
  for (const list of lists) {
    list.forEach((hit, rank) => {
      const current = scores.get(hit.doc.key)
      const score = 1 / (k + rank + 1)
      scores.set(hit.doc.key, { doc: hit.doc, score: (current?.score ?? 0) + score })
    })
  }
  return [...scores.values()].toSorted((a, b) => b.score - a.score).slice(0, limit)
}

/** Renders documents as numbered context for the model, each tagged with the key it must cite. */
export function formatContext(hits: readonly RetrievedDoc[]): string {
  return hits
    .map((hit) => `<doc cite="[[${hit.doc.key}]]" title="${hit.doc.title}">\n${hit.doc.text}\n</doc>`)
    .join('\n')
}
