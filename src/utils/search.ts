import { bones } from '@/data/bones'
import { joints } from '@/data/joints'
import { allLandmarks } from '@/data/landmarks'
import { navRegions } from '@/data/regions'
import { walks } from '@/data/walks'
import { CLASS_LABEL, REGION_LABEL } from '@/data/labels'

export interface SearchResult {
  id: string
  kind: 'bone' | 'landmark' | 'region' | 'joint' | 'walk'
  title: string
  subtitle: string
  boneId?: string
  landmarkId?: string
  regionId?: string
  jointId?: string
  walkId?: string
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

  for (const joint of joints) {
    const fields = [joint.name, ...joint.alternateNames]
    let best = 0
    for (const field of fields) best = Math.max(best, scoreText(query, field))
    if (best > 0) {
      results.push({
        id: `joint:${joint.id}`,
        kind: 'joint',
        title: joint.name,
        subtitle: `Joint · ${REGION_LABEL[joint.region]}`,
        jointId: joint.id,
        score: best,
      })
    }
  }

  for (const walk of walks) {
    const best = scoreText(query, walk.title)
    if (best > 0) {
      results.push({
        id: `walk:${walk.id}`,
        kind: 'walk',
        title: walk.title,
        subtitle: 'Guided walk',
        walkId: walk.id,
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

  const ranked = rankResults(results)
  return ranked.slice(0, 10)
}

function rankResults(results: SearchResult[]): SearchResult[] {
  const byScore = (a: SearchResult, b: SearchResult) => b.score - a.score || a.title.localeCompare(b.title)
  const exact = results.filter((result) => result.score === 100 && result.kind !== 'walk').sort(byScore)
  const exactWalks = results.filter((result) => result.score === 100 && result.kind === 'walk').sort(byScore)
  const featured = results
    .filter((result) => result.score >= 82 && result.score < 100 && (result.kind === 'joint' || result.kind === 'walk'))
    .sort(byScore)
  const rest = results
    .filter((result) => result.score < 100 && !(result.score >= 82 && (result.kind === 'joint' || result.kind === 'walk')))
    .sort((a, b) => b.score - a.score || kindRank(a.kind) - kindRank(b.kind) || a.title.localeCompare(b.title))
  return [...exact, ...exactWalks, ...featured, ...rest]
}

function kindRank(kind: SearchResult['kind']): number {
  return kind === 'walk' ? 1 : 0
}
