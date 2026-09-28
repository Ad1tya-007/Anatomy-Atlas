import type {
  AnatomicalRegion,
  AnchorFrame,
  Bone,
  BoneClassification,
  Landmark,
  Side,
} from '@/types/anatomy'

export interface LandmarkInput {
  suffix: string
  name: string
  description: string
  significance?: string
  anchor: [number, number, number]
  mesh?: string
  bothSides?: boolean
}

interface BoneInput {
  id: string
  name: string
  displayName?: string
  side: Side
  alternateNames?: string[]
  keywords?: string[]
  region: AnatomicalRegion
  classification: BoneClassification
  description: string
  articulations: string[]
  landmarks?: LandmarkInput[]
  compositeOf?: string[]
  partOf?: string
  quiz?: boolean
  anchorFrame: AnchorFrame
  primaryMesh: string
}

function toLandmark(boneId: string, input: LandmarkInput): Landmark {
  return {
    id: `${boneId}_${input.suffix}`,
    name: input.name,
    description: input.description,
    significance: input.significance,
    anchor: { x: input.anchor[0], y: input.anchor[1], z: input.anchor[2] },
    mesh: input.mesh,
    bothSides: input.bothSides,
  }
}

export function bone(input: BoneInput): Bone {
  return {
    id: input.id,
    name: input.name,
    displayName: input.displayName ?? input.name,
    side: input.side,
    alternateNames: input.alternateNames ?? [],
    keywords: input.keywords ?? [],
    region: input.region,
    classification: input.classification,
    description: input.description,
    articulations: input.articulations,
    landmarks: (input.landmarks ?? []).map((landmark) => toLandmark(input.id, landmark)),
    compositeOf: input.compositeOf,
    partOf: input.partOf,
    quiz: input.quiz ?? false,
    anchorFrame: input.anchorFrame,
    primaryMesh: input.primaryMesh,
  }
}

type PairedInput = Omit<BoneInput, 'id' | 'name' | 'side' | 'displayName' | 'anchorFrame'> & {
  anchorFrame?: AnchorFrame
}

export function paired(stem: string, name: string, input: PairedInput): Bone[] {
  return (['left', 'right'] as const).map((side) =>
    bone({
      ...input,
      id: `${stem}_${side}`,
      name,
      displayName: `${side === 'left' ? 'Left' : 'Right'} ${name}`,
      side,
      anchorFrame: input.anchorFrame ?? 'side',
      alternateNames: [...(input.alternateNames ?? []), `${side} ${name.toLowerCase()}`],
    }),
  )
}
