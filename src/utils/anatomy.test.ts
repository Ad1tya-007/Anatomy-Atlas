import { bones } from '@/data/bones'
import { highlightedIds, selectionHighlight, visualFor } from '@/utils/anatomy'
import { describe, expect, it } from 'vitest'

const none = { selectedBoneId: null, selectedJointId: null, jointSide: null, compareSides: false }

const base = {
  showBones: true,
  highlighted: new Set<string>(),
  hoveredBoneId: null,
  isolated: false,
  classification: 'all' as const,
  hasSelection: false,
}

describe('highlightedIds', () => {
  it('highlights a single bone', () => {
    expect([...highlightedIds('femur_left')]).toEqual(['femur_left'])
    expect(highlightedIds(null).size).toBe(0)
  })

  it('expands a composite entry into its parts', () => {
    const composite = bones.find((bone) => bone.compositeOf?.length)
    expect(composite).toBeDefined()
    expect([...highlightedIds(composite!.id)]).toEqual(composite!.compositeOf)
  })
})

describe('selectionHighlight', () => {
  it('highlights the members of a joint as a group', () => {
    const result = selectionHighlight({
      ...none,
      selectedBoneId: 'femur_right',
      selectedJointId: 'knee',
      jointSide: 'right',
    })
    expect(result.group).toBe(true)
    expect(result.selectedIds.has('femur_right')).toBe(true)
    expect(result.selectedIds.has('tibia_right')).toBe(true)
    expect(result.selectedIds.has('femur_left')).toBe(false)
  })

  it('adds the opposite bone when comparing sides', () => {
    const result = selectionHighlight({ ...none, selectedBoneId: 'humerus_left', compareSides: true })
    expect(result).toEqual({ selectedIds: new Set(['humerus_left', 'humerus_right']), group: true })
  })

  it('does not group a midline bone when comparing', () => {
    expect(selectionHighlight({ ...none, selectedBoneId: 'sacrum', compareSides: true })).toEqual({
      selectedIds: new Set(['sacrum']),
      group: false,
    })
  })

  it('falls back to the bone for an unknown joint', () => {
    expect(selectionHighlight({ ...none, selectedBoneId: 'sacrum', selectedJointId: 'nope' }).selectedIds).toEqual(
      new Set(['sacrum']),
    )
  })
})

describe('visualFor', () => {
  it('hides every bone when bones are switched off', () => {
    expect(visualFor('femur_left', { ...base, showBones: false })).toBe('hidden')
  })

  it('draws the selection, then hover, then isolation, in that order', () => {
    const highlighted = new Set(['femur_left'])
    const selected = { ...base, highlighted, hasSelection: true }
    expect(visualFor('femur_left', { ...selected, isolated: true, hoveredBoneId: 'femur_left' })).toBe('selected')
    expect(visualFor('tibia_left', { ...selected, hoveredBoneId: 'tibia_left', isolated: true })).toBe('hover')
    expect(visualFor('tibia_left', { ...selected, pulseBoneId: 'tibia_left' })).toBe('hover')
    expect(visualFor('tibia_left', { ...selected, isolated: true })).toBe('ghost')
    expect(visualFor('tibia_left', { ...selected, group: true })).toBe('subdued')
    expect(visualFor('tibia_left', selected)).toBe('subdued')
    expect(visualFor('tibia_left', base)).toBe('default')
  })

  it('emphasizes the chosen classification', () => {
    expect(visualFor('femur_left', { ...base, classification: 'long' })).toBe('emphasized')
    expect(visualFor('sacrum', { ...base, classification: 'long' })).toBe('subdued')
  })

  it('treats meshes without a bone as background', () => {
    expect(visualFor('__unmapped__', base)).toBe('default')
    expect(visualFor('__unmapped__', { ...base, hasSelection: true })).toBe('subdued')
    expect(visualFor('__unmapped__', { ...base, isolated: true })).toBe('ghost')
  })
})
