import { getDoc, type AtlasDoc } from '@/features/tutor/corpus'

/** The tutor cites atlas content inline as `[[bone:femur_left]]`. */
export const CITATION_PATTERN = /\[\[(bone|landmark|joint|walk):([a-z0-9_]+)\]\]/g

export type TextSegment = { type: 'text'; text: string } | { type: 'citation'; doc: AtlasDoc }

/** Splits a reply into text and citation chips. Citations of unknown ids are dropped, never shown. */
export function splitCitations(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  let last = 0
  for (const match of text.matchAll(CITATION_PATTERN)) {
    const start = match.index
    if (start > last) segments.push({ type: 'text', text: text.slice(last, start) })
    const doc = getDoc(`${match[1]}:${match[2]}`)
    if (doc) segments.push({ type: 'citation', doc })
    last = start + match[0].length
  }
  if (last < text.length) segments.push({ type: 'text', text: text.slice(last) })
  return segments
}

/** Every citation in a reply, split into ones that resolve to atlas content and ones that do not. */
export function auditCitations(text: string): { valid: string[]; invalid: string[] } {
  const valid: string[] = []
  const invalid: string[] = []
  for (const match of text.matchAll(CITATION_PATTERN)) {
    const key = `${match[1]}:${match[2]}`
    ;(getDoc(key) ? valid : invalid).push(key)
  }
  return { valid, invalid }
}
