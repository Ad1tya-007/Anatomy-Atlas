import type { AnatomicalRegion, BoneClassification } from '@/types/anatomy'

export const REGION_LABEL: Record<AnatomicalRegion, string> = {
  head: 'Head',
  'vertebral-column': 'Vertebral column',
  thorax: 'Thorax',
  'shoulder-girdle': 'Shoulder girdle',
  'upper-limb': 'Upper limb',
  pelvis: 'Pelvis',
  'lower-limb': 'Lower limb',
}

export const CLASS_LABEL: Record<BoneClassification, string> = {
  long: 'Long bone',
  short: 'Short bone',
  flat: 'Flat bone',
  irregular: 'Irregular bone',
  sesamoid: 'Sesamoid bone',
}

export const CLASS_OPTIONS: Array<{ value: BoneClassification | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'long', label: 'Long' },
  { value: 'short', label: 'Short' },
  { value: 'flat', label: 'Flat' },
  { value: 'irregular', label: 'Irregular' },
  { value: 'sesamoid', label: 'Sesamoid' },
]
