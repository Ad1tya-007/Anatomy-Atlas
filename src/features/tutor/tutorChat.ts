import { Chat } from '@ai-sdk/react'
import { BONE_IDS, isViewerTool, JOINT_IDS, LANDMARK_IDS } from '@/features/tutor/tools'
import { runViewerTool } from '@/features/tutor/viewerActions'
import { useAnatomyStore } from '@/store/anatomyStore'
import type { TutorUIMessage } from '@/features/tutor/messages'
import type { ViewState } from '@/types/anatomy'
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from 'ai'
import { create } from 'zustand'

export const TUTOR_API = '/api/tutor'
export const QUESTION_MAX = 1000

export interface ViewerNote {
  note: string
  ok: boolean
  before: ViewState
  undone: boolean
}

interface TutorNotes {
  /** What each viewer tool call did, keyed by tool call id. */
  notes: Record<string, ViewerNote>
  record: (toolCallId: string, note: ViewerNote) => void
  markUndone: (toolCallId: string) => void
  reset: () => void
}

export const useTutorNotes = create<TutorNotes>((set) => ({
  notes: {},
  record: (toolCallId, note) => set((state) => ({ notes: { ...state.notes, [toolCallId]: note } })),
  markUndone: (toolCallId) =>
    set((state) => {
      const note = state.notes[toolCallId]
      return note ? { notes: { ...state.notes, [toolCallId]: { ...note, undone: true } } } : state
    }),
  reset: () => set({ notes: {} }),
}))

const known = {
  bone: new Set<string>(BONE_IDS),
  landmark: new Set<string>(LANDMARK_IDS),
  joint: new Set<string>(JOINT_IDS),
}

/** What the tutor may know about the viewer. Nothing is selected as far as it knows during a study question. */
export function viewerContext() {
  const state = useAnatomyStore.getState()
  const studying = state.studyMode && !state.studyRevealed
  const selection = studying
    ? null
    : state.selectedJointId && known.joint.has(state.selectedJointId)
      ? { kind: 'joint' as const, id: state.selectedJointId }
      : state.selectedLandmarkId && known.landmark.has(state.selectedLandmarkId)
        ? { kind: 'landmark' as const, id: state.selectedLandmarkId }
        : state.selectedBoneId && known.bone.has(state.selectedBoneId)
          ? { kind: 'bone' as const, id: state.selectedBoneId }
          : null
  return { selection, look: state.look, studying }
}

export function createTutorChat(api = TUTOR_API): Chat<TutorUIMessage> {
  const chat: Chat<TutorUIMessage> = new Chat<TutorUIMessage>({
    transport: new DefaultChatTransport<TutorUIMessage>({ api, body: () => ({ context: viewerContext() }) }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall: ({ toolCall }) => {
      if (toolCall.dynamic || !isViewerTool(toolCall.toolName)) return
      const result = runViewerTool(toolCall.toolName, toolCall.input)
      useTutorNotes.getState().record(toolCall.toolCallId, {
        note: result.note,
        ok: result.output.ok,
        before: result.before,
        undone: false,
      })
      // Not awaited: awaiting inside onToolCall deadlocks the automatic follow-up request.
      void chat.addToolOutput({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId, output: result.output })
    },
  })
  return chat
}

let shared: Chat<TutorUIMessage> | null = null

/** One conversation for the whole page, so it survives switching between the panel and the mobile sheet. */
export function tutorChat(): Chat<TutorUIMessage> {
  shared ??= createTutorChat()
  return shared
}

/** The server's error message, which arrives as the JSON body of a failed request. */
export function tutorErrorMessage(error: Error): string {
  try {
    const parsed = JSON.parse(error.message) as { error?: unknown }
    if (typeof parsed.error === 'string') return parsed.error
  } catch {
    // Not JSON: a network error or a stream error with a plain message.
  }
  if (/fetch|network/i.test(error.message)) return 'Could not reach the tutor. Check your connection and try again.'
  return error.message || 'The tutor could not answer just now.'
}
