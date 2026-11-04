import { getBone } from '@/data/bones'
import { getJoint } from '@/data/joints'
import { CLASS_LABEL, REGION_LABEL } from '@/data/labels'
import { getLandmark } from '@/data/landmarks'
import { getWalk } from '@/data/walks'
import type { AtlasDoc } from '@/features/tutor/corpus'
import { isViewerTool, viewerToolSchemas } from '@/features/tutor/tools'
import { useAnatomyStore } from '@/store/anatomyStore'
import type { ViewState } from '@/types/anatomy'
import { viewFromState } from '@/utils/urlState'
import { CAMERA_PRESETS } from '@/utils/camera'

export interface ViewerActionResult {
  /** Sent back to the model as the tool output. */
  output: { ok: true; done: string } | { ok: false; error: string }
  /** Shown in the chat, for example "Selected the left femur". */
  note: string
  /** The view before the action, for Undo. */
  before: ViewState
}

function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Runs a viewer tool call from the tutor against the store. Inputs are validated again here: the model's output is
 * untrusted, and an unknown id must never reach the viewer.
 */
export function runViewerTool(name: string, rawInput: unknown): ViewerActionResult {
  const store = useAnatomyStore.getState()
  const before = viewFromState(store)
  const fail = (error: string): ViewerActionResult => ({ output: { ok: false, error }, note: error, before })
  if (!isViewerTool(name)) return fail(`Unknown viewer tool ${name}.`)
  const parsed = viewerToolSchemas[name].safeParse(rawInput)
  if (!parsed.success) return fail(`The tutor asked for something the atlas does not have.`)
  const input = parsed.data as Record<string, unknown>

  let done: string
  switch (name) {
    case 'select_bone': {
      const bone = getBone(input.boneId as string)!
      store.selectBone(bone.id)
      done = `selected the ${bone.displayName.toLowerCase()}`
      break
    }
    case 'select_landmark': {
      const record = getLandmark(input.landmarkId as string)!
      store.selectLandmark(record.landmark.id)
      done = `showed the ${record.landmark.name.toLowerCase()} on the ${record.displayName.toLowerCase()}`
      break
    }
    case 'select_joint': {
      const joint = getJoint(input.jointId as string)!
      store.selectJoint(joint.id, input.side as 'left' | 'right' | undefined)
      done = `showed the ${joint.name.toLowerCase()}`
      break
    }
    case 'frame_region': {
      const region = input.region as keyof typeof REGION_LABEL
      store.frameRegion(region)
      done = `framed the ${REGION_LABEL[region].toLowerCase()}`
      break
    }
    case 'set_look': {
      store.setLook(input.look as Parameters<typeof store.setLook>[0])
      done = `switched to the ${input.look as string} look`
      break
    }
    case 'set_section': {
      const axis = input.axis as Parameters<typeof store.setSectionAxis>[0]
      store.setSectionAxis(axis)
      if (axis !== 'off' && typeof input.amount === 'number') store.setSectionAmount(input.amount)
      done = axis === 'off' ? 'turned off the section' : `cut a ${axis} section`
      break
    }
    case 'set_spread': {
      const amount = input.amount as number
      store.setSpread(amount)
      done = amount === 0 ? 'reassembled the skeleton' : 'exploded the skeleton'
      break
    }
    case 'start_walk': {
      const walk = getWalk(input.walkId as string)!
      store.startWalk(walk.id)
      done = `started the walk "${walk.title}"`
      break
    }
    case 'start_quiz': {
      const { kind, region, classification, answerMode, review } = parsed.data as {
        kind: 'bone' | 'landmark'
        region?: keyof typeof REGION_LABEL
        classification?: keyof typeof CLASS_LABEL
        answerMode?: Parameters<typeof store.setStudyAnswerMode>[0]
        review?: boolean
      }
      store.clearSelection()
      useAnatomyStore.setState({
        studyScope: region ? 'region' : classification ? 'classification' : 'all',
        ...(region ? { studyRegionId: region } : {}),
        ...(classification ? { studyClassification: classification } : {}),
        ...(answerMode ? { studyAnswerMode: answerMode } : {}),
        studyQueue: review ? 'review' : 'practice',
      })
      useAnatomyStore.getState().enterStudy(kind)
      const scope = region
        ? ` on the ${REGION_LABEL[region].toLowerCase()}`
        : classification
          ? ` on ${CLASS_LABEL[classification].toLowerCase()} bones`
          : ''
      done = `started ${review ? 'reviewing due' : 'a'} ${kind} ${review ? 'cards' : 'quiz'}${scope}`
      break
    }
  }
  return { output: { ok: true, done }, note: sentence(done), before }
}

/** Puts the viewer back the way it was before a tutor action. */
export function undoViewerAction(before: ViewState): void {
  const store = useAnatomyStore.getState()
  store.clearSelection()
  store.setSpread(0)
  store.setSectionAxis('off')
  store.setLook(before.look ?? 'atlas')
  store.restoreView(before)
  if (!before.camera) store.focusCamera(CAMERA_PRESETS.default.position, CAMERA_PRESETS.default.target)
}

/** Opens the structure a citation chip points at. */
export function openCitation(doc: AtlasDoc): void {
  const store = useAnatomyStore.getState()
  const id = doc.ids[0]!
  if (doc.kind === 'bone') store.selectBone(id)
  else if (doc.kind === 'landmark') store.selectLandmark(id)
  else if (doc.kind === 'joint') store.selectJoint(id)
  else store.startWalk(id)
}
