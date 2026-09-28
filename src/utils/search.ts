import { bones } from '@/data/bones'
import { allLandmarks } from '@/data/landmarks'
import { navRegions } from '@/data/regions'
import { CLASS_LABEL, REGION_LABEL } from '@/data/labels'

export interface SearchResult {
  id: string
  kind: 'bone' | 'landmark' | 'region'
  title: string
  subtitle: string
  boneId?: string
  landmarkId?: string
  regionId?: string
  score: number
}

function norm(value: string): string {
  return value.trim().toLowerCase()
}

function scoreText(query: string, text: string): number {
  const value = norm(text)
  if (!value || !query) return 0
  if (value === query) return 100
  if (value.startsWith(query)) return 82
  if (value.includes(query)) return 64
  return 0
}

export function searchAnatomy(rawQuery: string): SearchResult[] {
  const query = norm(rawQuery)
  if (query.length < 1) return []

  const results: SearchResult[] = []

  for (const region of navRegions) {
    const score = scoreText(query, region.label)
    if (score > 0) {
      results.push({
        id: `region:${region.id}`,
        kind: 'region',
        title: region.label,
        subtitle: 'Anatomical region',
        regionId: region.id,
        score: score - 8,
      })
    }
  }

  for (const bone of bones) {
    const fields = [bone.name, bone.displayName, ...bone.alternateNames, ...bone.keywords, REGION_LABEL[bone.region]]
    let best = 0
    for (const field of fields) best = Math.max(best, scoreText(query, field))
    if (best === 0 && norm(CLASS_LABEL[bone.classification]).includes(query)) best = 40
    if (best > 0) {
      results.push({
        id: `bone:${bone.id}`,
        kind: 'bone',
        title: bone.displayName,
        subtitle: `${REGION_LABEL[bone.region]} · ${CLASS_LABEL[bone.classification]}`,
        boneId: bone.id,
        score: best,
      })
    }
  }

  for (const record of allLandmarks) {
    const score = Math.max(scoreText(query, record.landmark.name), scoreText(query, record.landmark.id.replaceAll('_', ' ')))
    if (score === 0) continue
    results.push({
      id: `landmark:${record.landmark.id}`,
      kind: 'landmark',
      title: record.landmark.name,
      subtitle: `${record.displayName} · Bony landmark`,
      boneId: record.boneId,
      landmarkId: record.landmark.id,
      score,
    })
  }

  results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
  return results.slice(0, 10)
}
