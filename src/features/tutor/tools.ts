import { bones } from '@/data/bones'
import { joints } from '@/data/joints'
import { allLandmarks } from '@/data/landmarks'
import { walks } from '@/data/walks'
import type { AnatomicalRegion, BoneClassification, LookName, StudyAnswerMode } from '@/types/anatomy'
import { z } from 'zod'

type NonEmpty = [string, ...string[]]

function ids(values: string[]): NonEmpty {
  if (values.length === 0) throw new Error('Tool enums need at least one id')
  return values as NonEmpty
}

export const BONE_IDS = ids(bones.map((bone) => bone.id))
export const LANDMARK_IDS = ids(allLandmarks.map((record) => record.landmark.id))
export const JOINT_IDS = ids(joints.map((joint) => joint.id))
export const WALK_IDS = ids(walks.map((walk) => walk.id))
export const REGIONS = [
  'head',
  'vertebral-column',
  'thorax',
  'shoulder-girdle',
  'upper-limb',
  'pelvis',
  'lower-limb',
] as const satisfies readonly AnatomicalRegion[]
export const CLASSIFICATIONS = [
  'long',
  'short',
  'flat',
  'irregular',
  'sesamoid',
] as const satisfies readonly BoneClassification[]
export const LOOKS = ['atlas', 'ivory', 'radiograph', 'mastery'] as const satisfies readonly LookName[]
export const ANSWER_MODES = ['reveal', 'choice', 'type', 'locate'] as const satisfies readonly StudyAnswerMode[]

/**
 * Tools the model calls to drive the viewer. They have no server-side `execute`: the browser validates the input
 * with the same schema, runs the matching store action, and returns what it showed.
 */
export const viewerToolSchemas = {
  select_bone: z.object({
    boneId: z.enum(BONE_IDS).describe('Side-specific bone id, for example femur_left.'),
  }),
  select_landmark: z.object({
    landmarkId: z.enum(LANDMARK_IDS).describe('Side-specific landmark id, for example femur_left_greater_trochanter.'),
  }),
  select_joint: z.object({
    jointId: z.enum(JOINT_IDS),
    side: z.enum(['left', 'right']).optional().describe('Which side to show for a paired joint. Defaults to left.'),
  }),
  frame_region: z.object({ region: z.enum(REGIONS) }),
  set_look: z.object({ look: z.enum(LOOKS) }),
  set_section: z.object({
    axis: z.enum(['off', 'sagittal', 'coronal', 'transverse']),
    amount: z.number().min(0).max(1).optional().describe('How far the cut moves through the body, 0 to 1.'),
  }),
  set_spread: z.object({
    amount: z.number().min(0).max(1).describe('0 is assembled, 1 is fully exploded.'),
  }),
  start_walk: z.object({ walkId: z.enum(WALK_IDS) }),
  start_quiz: z.object({
    kind: z.enum(['bone', 'landmark']),
    region: z.enum(REGIONS).optional().describe('Limit questions to one region.'),
    classification: z.enum(CLASSIFICATIONS).optional().describe('Limit questions to one bone classification.'),
    answerMode: z.enum(ANSWER_MODES).optional(),
    review: z.boolean().optional().describe('Ask spaced-repetition cards that are due instead of random ones.'),
  }),
} as const

export type ViewerToolName = keyof typeof viewerToolSchemas
export type ViewerToolInput<Name extends ViewerToolName> = z.infer<(typeof viewerToolSchemas)[Name]>

export const VIEWER_TOOL_DESCRIPTIONS: Record<ViewerToolName, string> = {
  select_bone: 'Select and frame a bone in the 3D viewer.',
  select_landmark: 'Select a bony landmark and show its marker.',
  select_joint: 'Select a joint and highlight the bones that form it.',
  frame_region: 'Move the camera to a body region.',
  set_look: 'Change the rendering look. "radiograph" resembles an X-ray; "mastery" colors bones by study progress.',
  set_section: 'Cut the skeleton with a section plane, or turn the cut off.',
  set_spread: 'Pull the bones apart (exploded view) to show how they fit together.',
  start_walk: 'Start one of the guided walks.',
  start_quiz: 'Start a study session in the viewer.',
}

export function isViewerTool(name: string): name is ViewerToolName {
  return Object.hasOwn(viewerToolSchemas, name)
}

/** A multiple-choice question from `generate_question`. Every id is checked against the atlas before it is sent. */
export const generatedQuestionSchema = z.object({
  kind: z.enum(['bone', 'landmark']),
  prompt: z.string().min(10).max(300),
  choices: z
    .array(z.object({ id: z.string(), label: z.string() }))
    .min(3)
    .max(4),
  answerId: z.string(),
  explanation: z.string().max(500),
})

export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>

export const searchAtlasInput = z.object({
  query: z.string().min(2).max(200).describe('Words to look up in the atlas.'),
})

export const generateQuestionInput = z.object({
  kind: z.enum(['bone', 'landmark']),
  topic: z.string().min(2).max(200).describe('What the question should test, for example "landmarks of the femur".'),
})
