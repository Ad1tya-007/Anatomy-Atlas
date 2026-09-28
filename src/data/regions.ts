import type { NavRegion } from '@/types/anatomy'

const pair = (label: string, stem: string): NavRegion['entries'][number] => ({
  label,
  bones: [`${stem}_left`, `${stem}_right`],
})

export const navRegions: NavRegion[] = [
  {
    id: 'head',
    label: 'Head',
    entries: [
      { label: 'Frontal bone', bones: ['frontal'] },
      pair('Parietal bone', 'parietal'),
      pair('Temporal bone', 'temporal'),
      { label: 'Occipital bone', bones: ['occipital'] },
      { label: 'Sphenoid', bones: ['sphenoid'] },
      { label: 'Ethmoid', bones: ['ethmoid'] },
      { label: 'Mandible', bones: ['mandible'] },
      pair('Maxilla', 'maxilla'),
      pair('Zygomatic bone', 'zygomatic'),
      {
        label: 'Nasal cavity and orbit',
        bones: [],
        children: [
          pair('Nasal bone', 'nasal'),
          pair('Lacrimal bone', 'lacrimal'),
          pair('Palatine bone', 'palatine'),
          pair('Inferior nasal concha', 'inferior_nasal_concha'),
          { label: 'Vomer', bones: ['vomer'] },
        ],
      },
    ],
  },
  {
    id: 'vertebral-column',
    label: 'Vertebral column',
    entries: [
      {
        label: 'Cervical vertebrae',
        bones: ['cervical_column'],
        children: [
          { label: 'Atlas (C1)', bones: ['atlas'] },
          { label: 'Axis (C2)', bones: ['axis'] },
          { label: 'C3–C7', bones: ['cervical_vertebrae'] },
        ],
      },
      { label: 'Thoracic vertebrae', bones: ['thoracic_vertebrae'] },
      { label: 'Lumbar vertebrae', bones: ['lumbar_vertebrae'] },
      { label: 'Sacrum', bones: ['sacrum'] },
      { label: 'Coccyx', bones: ['coccyx'] },
    ],
  },
  {
    id: 'thorax',
    label: 'Thorax',
    entries: [
      { label: 'Sternum', bones: ['sternum'] },
      { label: 'Ribs', bones: ['ribs'] },
    ],
  },
  {
    id: 'shoulder-girdle',
    label: 'Shoulder girdle',
    entries: [pair('Clavicle', 'clavicle'), pair('Scapula', 'scapula')],
  },
  {
    id: 'upper-limb',
    label: 'Upper limb',
    entries: [
      pair('Humerus', 'humerus'),
      pair('Radius', 'radius'),
      pair('Ulna', 'ulna'),
      {
        label: 'Carpals',
        bones: [],
        children: [
          pair('Scaphoid', 'scaphoid'),
          pair('Lunate', 'lunate'),
          pair('Triquetrum', 'triquetrum'),
          pair('Pisiform', 'pisiform'),
          pair('Trapezium', 'trapezium'),
          pair('Trapezoid', 'trapezoid'),
          pair('Capitate', 'capitate'),
          pair('Hamate', 'hamate'),
        ],
      },
      pair('Metacarpals', 'metacarpals'),
      pair('Phalanges', 'hand_phalanges'),
      pair('Sesamoid bones', 'hand_sesamoids'),
    ],
  },
  {
    id: 'pelvis',
    label: 'Pelvis',
    entries: [
      {
        ...pair('Pelvic bone', 'hip_bone'),
        children: [
          { ...pair('Ilium', 'hip_bone'), landmarkSuffix: 'ilium' },
          { ...pair('Ischium', 'hip_bone'), landmarkSuffix: 'ischium' },
          { ...pair('Pubis', 'hip_bone'), landmarkSuffix: 'pubis' },
        ],
      },
      { label: 'Sacrum', bones: ['sacrum'] },
    ],
  },
  {
    id: 'lower-limb',
    label: 'Lower limb',
    entries: [
      pair('Femur', 'femur'),
      pair('Patella', 'patella'),
      pair('Tibia', 'tibia'),
      pair('Fibula', 'fibula'),
      {
        label: 'Tarsals',
        bones: [],
        children: [
          pair('Talus', 'talus'),
          pair('Calcaneus', 'calcaneus'),
          pair('Navicular', 'navicular'),
          pair('Cuboid', 'cuboid'),
          pair('Medial cuneiform', 'medial_cuneiform'),
          pair('Intermediate cuneiform', 'intermediate_cuneiform'),
          pair('Lateral cuneiform', 'lateral_cuneiform'),
        ],
      },
      pair('Metatarsals', 'metatarsals'),
      pair('Phalanges', 'foot_phalanges'),
      pair('Sesamoid bones', 'foot_sesamoids'),
    ],
  },
]

export const REGION_FOCUS: Record<
  string,
  { position: [number, number, number]; target: [number, number, number] }
> = {
  head: { position: [0.55, 0.95, 0.85], target: [0, 0.78, 0.02] },
  'vertebral-column': { position: [0.85, 0.35, 1.15], target: [0, 0.15, -0.02] },
  thorax: { position: [0.7, 0.45, 1.25], target: [0, 0.32, 0.02] },
  'shoulder-girdle': { position: [0.15, 0.75, 1.35], target: [0, 0.52, 0] },
  'upper-limb': { position: [-1.15, 0.35, 1.15], target: [-0.22, 0.15, 0] },
  pelvis: { position: [0.85, 0.25, 1.05], target: [0, 0.02, 0] },
  'lower-limb': { position: [0.95, -0.15, 1.45], target: [0.05, -0.35, 0.02] },
}
