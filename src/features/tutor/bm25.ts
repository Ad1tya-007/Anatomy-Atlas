const STOPWORDS = new Set(
  (
    'a an and are as at be by can do does for from has have how i in is it its me my of on or show tell that the ' +
    'their them there these this to was what when where which who why will with you your about into also than then'
  ).split(' '),
)

/** Lowercase words with light suffix stripping, so "ribs" finds "rib" and "articulates" finds "articulate". */
export function tokenize(text: string): string[] {
  const words = text
    .toLowerCase()
    .normalize('NFKD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
  const tokens: string[] = []
  for (const word of words) {
    if (word.length < 2 || STOPWORDS.has(word)) continue
    tokens.push(stem(word))
  }
  return tokens
}

function stem(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`
  if (word.length > 4 && word.endsWith('es') && /(ch|sh|x|ss)es$/.test(word)) return word.slice(0, -2)
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us') && !word.endsWith('is')) {
    return word.slice(0, -1)
  }
  return word
}

export interface Bm25Field<T> {
  get: (item: T) => string | readonly string[]
  /** Term frequency multiplier for this field. */
  weight: number
}

export interface Bm25Hit<T> {
  item: T
  score: number
}

/** Okapi BM25 over weighted fields. */
export function createBm25<T>(items: readonly T[], fields: readonly Bm25Field<T>[], { k1 = 1.2, b = 0.75 } = {}) {
  const docs = items.map((item) => {
    const frequencies = new Map<string, number>()
    let length = 0
    for (const field of fields) {
      const value = field.get(item)
      for (const token of tokenize(typeof value === 'string' ? value : value.join(' '))) {
        frequencies.set(token, (frequencies.get(token) ?? 0) + field.weight)
        length += field.weight
      }
    }
    return { item, frequencies, length }
  })
  const averageLength = docs.reduce((sum, doc) => sum + doc.length, 0) / Math.max(docs.length, 1)
  const documentFrequency = new Map<string, number>()
  for (const doc of docs) {
    for (const token of doc.frequencies.keys()) documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1)
  }
  const idf = (token: string) => {
    const n = documentFrequency.get(token) ?? 0
    return Math.log(1 + (docs.length - n + 0.5) / (n + 0.5))
  }

  return {
    search(query: string, limit = 5): Bm25Hit<T>[] {
      const terms = [...new Set(tokenize(query))]
      if (terms.length === 0) return []
      const hits: Bm25Hit<T>[] = []
      for (const doc of docs) {
        let score = 0
        for (const term of terms) {
          const tf = doc.frequencies.get(term)
          if (!tf) continue
          score += (idf(term) * tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * doc.length) / averageLength))
        }
        if (score > 0) hits.push({ item: doc.item, score })
      }
      return hits.toSorted((left, right) => right.score - left.score).slice(0, limit)
    },
  }
}
