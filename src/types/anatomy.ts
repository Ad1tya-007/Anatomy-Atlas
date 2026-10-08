export type AnatomicalRegion =
  | 'head'
  | 'vertebral-column'
  | 'thorax'
  | 'shoulder-girdle'
  | 'upper-limb'
  | 'pelvis'
  | 'lower-limb'

export type BoneClassification = 'long' | 'short' | 'flat' | 'irregular' | 'sesamoid'

export type Side = 'left' | 'right' | 'midline'

export type AnchorFrame = 'side' | 'world'

/** Normalized point on a mesh bounding box. Axes depend on `frame`. */
export interface Anchor {
  /**
   * Side frame: 0 medial → 1 lateral.
   * World frame: 0 toward the model's minimum X → 1 toward maximum X.
   */
  x: number
  /** 0 inferior → 1 superior */
  y: number
  /** 0 posterior → 1 anterior */
  z: number
}

export interface Landmark {
  id: string
  name: string
  description: string
  significance?: string
  anchor: Anchor
  /** glTF mesh name used for placement. Defaults to every mesh of the bone. */
  mesh?: string
  /** Place the marker on both sides of a midline structure such as the ribs. */
  bothSides?: boolean
}

export interface Bone {
  id: string
  name: string
  displayName: string
  side: Side
  alternateNames: string[]
  keywords: string[]
  region: AnatomicalRegion
  classification: BoneClassification
  description: string
  articulations: string[]
  landmarks: Landmark[]
  /** Selecting this entry highlights these bone ids instead of a mesh of its own. */
  compositeOf?: string[]
  partOf?: string
  quiz: boolean
  anchorFrame: AnchorFrame
  primaryMesh: string
}

export interface NavEntry {
  label: string
  /** One id, or a left/right pair. */
  bones: string[]
  /** Selects this landmark suffix on the chosen bone. */
  landmarkSuffix?: string
  children?: NavEntry[]
}

export interface NavRegion {
  id: string
  label: string
  entries: NavEntry[]
}

export type CameraPresetName = 'default' | 'front' | 'back' | 'left' | 'right' | 'top'

export type Vec3 = [number, number, number]

export interface CameraRequest {
  id: number
  kind: 'preset' | 'focus'
  preset?: CameraPresetName
  position?: Vec3
  target?: Vec3
}

export type StudyKind = 'bone' | 'landmark'

export interface StudyQuestion {
  kind: StudyKind
  boneId: string
  landmarkId: string | null
}

export type ModelState = 'loading' | 'ready' | 'error'

export type MobilePanel = 'none' | 'nav' | 'info'

export interface Joint {
  id: string
  name: string
  alternateNames: string[]
  region: AnatomicalRegion
  description: string
  movements: string[]
  /** Bone ids for the left side, or the real ids of a midline joint. */
  bones: string[]
  /** Landmark ids that already exist on those bones. */
  landmarks: string[]
}

export interface WalkStop {
  boneId: string
  landmarkId?: string
  jointId?: string
  text: string
}

export interface Walk {
  id: string
  title: string
  summary: string
  stops: WalkStop[]
}

export type StudyScope = 'all' | 'region' | 'classification'

export type StudyAnswerMode = 'reveal' | 'choice' | 'type'

export type StudyResult = 'correct' | 'incorrect'

export interface SelectBoneOptions {
  landmarkId?: string | null
  fromStudy?: boolean
  /** Walk steps keep the walk active. Every other selection leaves it. */
  keepWalk?: boolean
}
