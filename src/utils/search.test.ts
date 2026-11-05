import { searchAnatomy } from '@/utils/search'
import { describe, expect, it } from 'vitest'

describe('searchAnatomy', () => {
  it('returns nothing for an empty query', () => {
    expect(searchAnatomy('')).toEqual([])
    expect(searchAnatomy('   ')).toEqual([])
  })

  it('ranks exact bone matches first', () => {
    const results = searchAnatomy('femur')
    expect(
      results
        .slice(0, 2)
        .map((result) => result.boneId)
        .toSorted(),
    ).toEqual(['femur_left', 'femur_right'])
    expect(results[0]?.score).toBe(100)
  })

  it('is case-insensitive and ignores surrounding whitespace', () => {
    expect(searchAnatomy('  FEMUR ').map((result) => result.id)).toEqual(
      searchAnatomy('femur').map((result) => result.id),
    )
  })

  it('ranks exact matches above prefix matches above substring matches', () => {
    const results = searchAnatomy('ti')
    const scores = results
      .filter((result) => result.kind !== 'joint' && result.kind !== 'walk')
      .map((result) => result.score)
    expect(scores).toEqual(scores.toSorted((a, b) => b - a))
  })

  it('caps results at ten', () => {
    expect(searchAnatomy('a').length).toBeLessThanOrEqual(10)
    expect(searchAnatomy('e')).toHaveLength(10)
  })

  it('finds joints by alternate name', () => {
    const results = searchAnatomy('AC joint')
    expect(results[0]).toMatchObject({ kind: 'joint', jointId: 'acromioclavicular' })
  })

  it('finds guided walks and regions', () => {
    expect(searchAnatomy('shoulder to hand').some((result) => result.kind === 'walk')).toBe(true)
    expect(
      searchAnatomy('lower limb').some((result) => result.kind === 'region' && result.regionId === 'lower-limb'),
    ).toBe(true)
  })

  it('finds landmarks and links them to their bone', () => {
    const result = searchAnatomy('greater trochanter').find((item) => item.kind === 'landmark')
    expect(result?.landmarkId).toMatch(/^femur_(left|right)_greater_trochanter$/)
    expect(result?.boneId).toBe(result?.landmarkId?.replace(/_greater_trochanter$/, ''))
  })

  it('returns no results for unknown structures', () => {
    expect(searchAnatomy('zzzz-not-a-bone')).toEqual([])
  })
})
