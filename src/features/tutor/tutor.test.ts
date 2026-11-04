import { bones } from '@/data/bones'
import { joints } from '@/data/joints'
import { allLandmarks } from '@/data/landmarks'
import { walks } from '@/data/walks'
import { tokenize } from '@/features/tutor/bm25'
import { auditCitations, splitCitations } from '@/features/tutor/citations'
import { atlasCorpus, getDoc } from '@/features/tutor/corpus'
import { fuse, searchBm25, searchEmbedding, type EmbeddingIndex } from '@/features/tutor/retrieval'
import { BONE_IDS, isViewerTool, viewerToolSchemas } from '@/features/tutor/tools'
import { describe, expect, it } from 'vitest'

const ids = (kind: string) => atlasCorpus.filter((doc) => doc.kind === kind).flatMap((doc) => doc.ids)

describe('atlas corpus', () => {
  it('covers every bone, landmark, joint, and walk exactly once', () => {
    expect(ids('bone').toSorted()).toEqual(bones.map((bone) => bone.id).toSorted())
    expect(ids('landmark').toSorted()).toEqual(allLandmarks.map((record) => record.landmark.id).toSorted())
    expect(ids('joint').toSorted()).toEqual(joints.map((joint) => joint.id).toSorted())
    expect(ids('walk').toSorted()).toEqual(walks.map((walk) => walk.id).toSorted())
    expect(new Set(atlasCorpus.map((doc) => doc.key)).size).toBe(atlasCorpus.length)
  })

  it('shares one document between the left and right copy', () => {
    expect(getDoc('bone:femur_right')).toBe(getDoc('bone:femur_left'))
    expect(getDoc('bone:femur_left')?.ids).toEqual(['femur_left', 'femur_right'])
    expect(getDoc('landmark:femur_right_greater_trochanter')?.key).toBe('landmark:femur_left_greater_trochanter')
    expect(getDoc('bone:sternum')?.ids).toEqual(['sternum'])
  })
})

describe('tokenize', () => {
  it('drops stopwords and folds plurals', () => {
    expect(tokenize('What are the ribs and vertebrae?')).toEqual(['rib', 'vertebrae'])
    expect(tokenize('Bodies, processes, and the sinus')).toEqual(['body', 'process', 'sinus'])
  })
})

describe('searchBm25', () => {
  it.each([
    ['thigh bone', 'bone:femur_left'],
    ['collarbone', 'bone:clavicle_left'],
    ['where is the greater trochanter', 'landmark:femur_left_greater_trochanter'],
    ['movements of the shoulder joint', 'joint:glenohumeral'],
  ])('ranks the right document first for "%s"', (query, key) => {
    expect(searchBm25(query, 3)[0]?.doc.key).toBe(key)
  })

  it('finds nothing for questions outside the atlas', () => {
    expect(searchBm25('ibuprofen dosage', 5)).toEqual([])
  })
})

describe('embedding search and fusion', () => {
  const index: EmbeddingIndex = {
    model: 'test',
    dimensions: 2,
    vectors: { 'bone:femur_left': [1, 0], 'bone:tibia_left': [0.7, 0.7], 'bone:ulna_left': [0, 1] },
  }

  it('ranks by cosine similarity', () => {
    expect(searchEmbedding(index, [0.9, 0.1], 2).map((hit) => hit.doc.key)).toEqual([
      'bone:femur_left',
      'bone:tibia_left',
    ])
  })

  it('rewards documents that both retrievers rank well', () => {
    const lexical = searchBm25('tibia shin', 3)
    const semantic = searchEmbedding(index, [0.7, 0.7], 3)
    expect(fuse([lexical, semantic], 3)[0]?.doc.key).toBe('bone:tibia_left')
  })
})

describe('citations', () => {
  it('turns valid citations into chips and drops invented ones', () => {
    const segments = splitCitations(
      'The femur [[bone:femur_left]] meets the tibia [[bone:tibia_right]] and [[bone:wishbone]].',
    )
    expect(segments.map((segment) => (segment.type === 'text' ? segment.text : segment.doc.key))).toEqual([
      'The femur ',
      'bone:femur_left',
      ' meets the tibia ',
      'bone:tibia_left',
      ' and ',
      '.',
    ])
    expect(auditCitations('[[bone:femur_left]] [[joint:elbow_of_doom]]')).toEqual({
      valid: ['bone:femur_left'],
      invalid: ['joint:elbow_of_doom'],
    })
  })
})

describe('viewer tool schemas', () => {
  it('only accept real atlas ids', () => {
    expect(BONE_IDS).toContain('femur_left')
    expect(viewerToolSchemas.select_bone.safeParse({ boneId: 'femur_left' }).success).toBe(true)
    expect(viewerToolSchemas.select_bone.safeParse({ boneId: 'femur' }).success).toBe(false)
    expect(viewerToolSchemas.set_spread.safeParse({ amount: 2 }).success).toBe(false)
    expect(isViewerTool('select_bone')).toBe(true)
    expect(isViewerTool('toString')).toBe(false)
  })
})
