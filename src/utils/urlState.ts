import { getBone } from '@/data/bones'
import { getJoint, isPairedJoint } from '@/data/joints'
import { getLandmark } from '@/data/landmarks'
import { getWalk, resolvedStops } from '@/data/walks'
import type { CameraPose, LookName, SectionAxis, Vec3, ViewState } from '@/types/anatomy'
import { CAMERA_PRESETS } from '@/utils/camera'
import { z } from 'zod/mini'

/** Query parameter names. Short so shared links stay readable. */
const KEY = {
  bone: 'b',
  landmark: 'l',
  joint: 'j',
  side: 'side',
  look: 'look',
  sectionAxis: 'sx',
  sectionAmount: 'sa',
  spread: 'sp',
  walk: 'w',
  walkIndex: 'wi',
  camera: 'cam',
} as const

/** Larger than the orbit controls' max distance, so any real pose fits. */
const CAMERA_LIMIT = 20

const knownId = (exists: (id: string) => boolean) => z.string().check(z.refine(exists))

const boneId = knownId((id) => getBone(id) !== undefined)
const landmarkId = knownId((id) => getLandmark(id) !== undefined)
const jointId = knownId((id) => getJoint(id) !== undefined)
const walkId = knownId((id) => {
  const walk = getWalk(id)
  return walk !== undefined && resolvedStops(walk).length > 0
})
const side = z.enum(['left', 'right'])
const look = z.enum(['atlas', 'ivory', 'radiograph'] satisfies LookName[])
const sectionAxis = z.enum(['sagittal', 'coronal', 'transverse'] satisfies Exclude<SectionAxis, 'off'>[])
// Zod 4 numbers reject Infinity and NaN, so no separate finite check is needed.
const unit = z.coerce.number().check(z.minimum(0), z.maximum(1))
const walkIndex = z.coerce.number().check(z.int(), z.minimum(0))
const coordinates = z.array(z.number().check(z.minimum(-CAMERA_LIMIT), z.maximum(CAMERA_LIMIT))).check(z.length(6))
const camera = z.pipe(
  z.pipe(
    z.string(),
    z.transform((raw) => raw.split(',').map(Number)),
  ),
  z.pipe(
    coordinates,
    z.transform((values): CameraPose => ({
      position: values.slice(0, 3) as Vec3,
      target: values.slice(3, 6) as Vec3,
    })),
  ),
)

function read<T>(params: URLSearchParams, key: string, schema: z.ZodMiniType<T, unknown>): T | undefined {
  const raw = params.get(key)
  if (raw === null || raw === '') return undefined
  const parsed = schema.safeParse(raw)
  return parsed.success ? parsed.data : undefined
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/** Parses a query string into a view. Invalid or unknown values are dropped one field at a time. */
export function decodeView(search: string): ViewState {
  const params = new URLSearchParams(search)
  const view: ViewState = {}

  const walk = read(params, KEY.walk, walkId)
  if (walk) {
    view.walkId = walk
    const stops = resolvedStops(getWalk(walk)!).length
    const index = read(params, KEY.walkIndex, walkIndex)
    if (index !== undefined && index < stops) view.walkIndex = index
  } else {
    const joint = read(params, KEY.joint, jointId)
    const landmark = read(params, KEY.landmark, landmarkId)
    const bone = read(params, KEY.bone, boneId)
    if (joint) {
      view.jointId = joint
      const jointSide = read(params, KEY.side, side)
      if (jointSide && isPairedJoint(getJoint(joint)!)) view.jointSide = jointSide
    } else if (landmark) {
      view.landmarkId = landmark
      view.boneId = getLandmark(landmark)!.boneId
    } else if (bone) {
      view.boneId = bone
    }
  }

  const lookName = read(params, KEY.look, look)
  if (lookName && lookName !== 'atlas') view.look = lookName

  const spread = read(params, KEY.spread, unit)
  if (spread !== undefined && spread > 0) {
    view.spread = spread
  } else {
    const axis = read(params, KEY.sectionAxis, sectionAxis)
    if (axis) {
      view.sectionAxis = axis
      const amount = read(params, KEY.sectionAmount, unit)
      if (amount !== undefined) view.sectionAmount = amount
    }
  }

  const pose = read(params, KEY.camera, camera)
  if (pose) view.camera = pose

  return view
}

/** Serializes a view into a query string without the leading `?`. Defaults are omitted. */
export function encodeView(view: ViewState): string {
  const params = new URLSearchParams()
  if (view.walkId) {
    params.set(KEY.walk, view.walkId)
    if (view.walkIndex) params.set(KEY.walkIndex, String(view.walkIndex))
  } else if (view.jointId) {
    params.set(KEY.joint, view.jointId)
    if (view.jointSide) params.set(KEY.side, view.jointSide)
  } else if (view.landmarkId) {
    params.set(KEY.landmark, view.landmarkId)
  } else if (view.boneId) {
    params.set(KEY.bone, view.boneId)
  }
  if (view.look && view.look !== 'atlas') params.set(KEY.look, view.look)
  if (view.spread && view.spread > 0) {
    params.set(KEY.spread, String(round(view.spread, 2)))
  } else if (view.sectionAxis) {
    params.set(KEY.sectionAxis, view.sectionAxis)
    if (view.sectionAmount !== undefined) params.set(KEY.sectionAmount, String(round(view.sectionAmount, 2)))
  }
  if (view.camera) {
    const values = [...view.camera.position, ...view.camera.target].map((value) => round(value, 3))
    params.set(KEY.camera, values.join(','))
  }
  // Commas are safe in a query string and keep the camera readable.
  return params.toString().replaceAll('%2C', ',')
}

export interface ShareableState {
  selectedBoneId: string | null
  selectedLandmarkId: string | null
  selectedJointId: string | null
  jointSide: 'left' | 'right' | null
  walkId: string | null
  walkIndex: number
  studyMode: boolean
  studyRevealed: boolean
  look: LookName
  sectionAxis: SectionAxis
  sectionAmount: number
  spread: number
  cameraPose: CameraPose | null
}

/** Reads the shareable view from store state. An unanswered study question never leaks into the URL. */
export function viewFromState(state: ShareableState): ViewState {
  const view: ViewState = {}
  const hideSelection = state.studyMode && !state.studyRevealed
  if (state.walkId) {
    view.walkId = state.walkId
    if (state.walkIndex > 0) view.walkIndex = state.walkIndex
  } else if (!hideSelection) {
    if (state.selectedJointId) {
      view.jointId = state.selectedJointId
      if (state.jointSide) view.jointSide = state.jointSide
    } else if (state.selectedLandmarkId) {
      view.landmarkId = state.selectedLandmarkId
    } else if (state.selectedBoneId) {
      view.boneId = state.selectedBoneId
    }
  }
  if (state.look !== 'atlas') view.look = state.look
  if (state.spread > 0) view.spread = state.spread
  else if (state.sectionAxis !== 'off') {
    view.sectionAxis = state.sectionAxis
    view.sectionAmount = state.sectionAmount
  }
  if (state.cameraPose && !hideSelection && !isHomePose(state.cameraPose)) view.camera = state.cameraPose
  return view
}

function near(a: Vec3, b: Vec3): boolean {
  return a.every((value, axis) => Math.abs(value - b[axis]!) < 1e-3)
}

function isHomePose(pose: CameraPose): boolean {
  const home = CAMERA_PRESETS.default
  return near(pose.position, home.position) && near(pose.target, home.target)
}

export function hasView(view: ViewState): boolean {
  return Object.keys(view).length > 0
}
