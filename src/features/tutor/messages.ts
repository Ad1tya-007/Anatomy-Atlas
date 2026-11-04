import type { UIMessage } from 'ai'

export interface TutorMetadata {
  /** Citation keys of the documents the answer was grounded on. */
  retrieved: string[]
  model: string
}

export type TutorUIMessage = UIMessage<Partial<TutorMetadata>>
