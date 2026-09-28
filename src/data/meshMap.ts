import type { Side } from '@/types/anatomy'

const UNPAIRED = new Set([
  'atlas',
  'axis',
  'cervical_vertebrae',
  'thoracic_vertebrae',
  'lumbar_vertebrae',
  'sacrum',
  'coccyx',
  'frontal',
  'occipital',
  'sphenoid',
  'ethmoid',
  'mandible',
  'vomer',
  'sternum',
  'ribs',
])

/** glTF runtime names replace spaces with underscores and drop periods. */
function normalizedMeshName(meshName: string): string {
  return meshName.trim().toLowerCase().replace(/_/g, ' ').replace(/\./g, '').replace(/\s+/g, ' ').trim()
}

/** A collapsed ".r" side marker becomes a trailing r (`Femur.r` → `Femurr`). */
function withoutSideMarker(name: string): string {
  return name.endsWith('r') ? name.slice(0, -1).trim() : name
}

export function baseMeshName(meshName: string, side: Side = 'midline'): string {
  const name = normalizedMeshName(meshName)
  if (side === 'midline') return name
  return withoutSideMarker(name)
}

/** Compare authored landmark mesh names with loader-sanitized runtime names. */
export function meshKey(meshName: string): string {
  return withoutSideMarker(normalizedMeshName(meshName))
}

function stemFor(base: string): string | null {
  if (base === 'parietal bone left' || base === 'parietal bone right') return null
  if (base.startsWith('atlas')) return 'atlas'
  if (base.startsWith('axis')) return 'axis'
  if (base.startsWith('cervical vertebrae')) return 'cervical_vertebrae'
  if (base.startsWith('thoracic vertebrae')) return 'thoracic_vertebrae'
  if (base.startsWith('lumbar vertebrae')) return 'lumbar_vertebrae'
  if (base === 'sacrum') return 'sacrum'
  if (base === 'coccyx') return 'coccyx'
  if (base === 'frontal bone') return 'frontal'
  if (base === 'occipital bone') return 'occipital'
  if (base === 'sphenoid bone') return 'sphenoid'
  if (base === 'ethmoid bone') return 'ethmoid'
  if (base === 'mandible bone') return 'mandible'
  if (base === 'vomer') return 'vomer'
  if (base === 'body of sternum' || base === 'manubrium of sternum') return 'sternum'
  if (base.startsWith('rib (') || base.startsWith('costal cart')) return 'ribs'
  if (base.includes('sesamoid') && base.includes('hand')) return 'hand_sesamoids'
  if (base.includes('sesamoid') && base.includes('foot')) return 'foot_sesamoids'
  if (base.includes('foot') && base.includes('phalanx')) return 'foot_phalanges'
  if (base.includes('phalanx')) return 'hand_phalanges'
  if (base.includes('metatarsal')) return 'metatarsals'
  if (base.includes('metacarpal')) return 'metacarpals'
  if (base.startsWith('upper ')) return 'maxilla'
  if (base.startsWith('lower ')) return 'mandible'
  if (base.includes('intermediate cuneiform')) return 'intermediate_cuneiform'
  if (base.includes('lateral cuneiform')) return 'lateral_cuneiform'
  if (base.includes('medial cuneiform')) return 'medial_cuneiform'

  const exact: Record<string, string> = {
    clavicle: 'clavicle',
    scapula: 'scapula',
    humerus: 'humerus',
    radius: 'radius',
    ulna: 'ulna',
    scaphoid: 'scaphoid',
    'lunate bone': 'lunate',
    triquetrum: 'triquetrum',
    pisiform: 'pisiform',
    trapezium: 'trapezium',
    trapezoid: 'trapezoid',
    capitate: 'capitate',
    hamate: 'hamate',
    'hip bone': 'hip_bone',
    femur: 'femur',
    patella: 'patella',
    tibia: 'tibia',
    fibula: 'fibula',
    calcaneus: 'calcaneus',
    talus: 'talus',
    'navicular bone': 'navicular',
    'cuboid bone': 'cuboid',
    'temporal bone': 'temporal',
    'maxilla bone': 'maxilla',
    'zygomatic bone': 'zygomatic',
    'nasal bone': 'nasal',
    'lacrimal bone': 'lacrimal',
    'palatine bone': 'palatine',
    'inferior nasal concha bone': 'inferior_nasal_concha',
  }

  return exact[base] ?? null
}

/** Map a glTF mesh to a stable bone id. `instanceSide` is the rendered side. */
export function resolveBoneId(meshName: string, instanceSide: Side): string | null {
  const normalized = normalizedMeshName(meshName)
  if (normalized.startsWith('parietal bone left')) return 'parietal_left'
  if (normalized.startsWith('parietal bone right')) return 'parietal_right'

  const stem = stemFor(baseMeshName(meshName, instanceSide))
  if (!stem) return null
  if (UNPAIRED.has(stem)) return stem
  if (instanceSide === 'midline') return stem
  return `${stem}_${instanceSide}`
}
