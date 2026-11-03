import type { StudyAnswerMode, StudyKind } from '@/types/anatomy'

/** FSRS grades: 1 Again, 2 Hard, 3 Good, 4 Easy. */
export type Grade = 1 | 2 | 3 | 4

/**
 * One answered study question. Review events are append-only and are the source of truth: card state is always
 * rebuilt by replaying them in order, which is what lets two devices merge without conflicts.
 */
export interface ReviewEvent {
  /** Random UUID, so the same event arriving twice is stored once. */
  id: string
  /** `bone:<boneId>` or `landmark:<landmarkId>`. */
  cardId: string
  grade: Grade
  /** ISO timestamp. */
  reviewedAt: string
  answerMode: StudyAnswerMode
  correct: boolean
  responseMs: number | null
}

export interface StudyAnswer {
  kind: StudyKind
  boneId: string
  landmarkId: string | null
  answerMode: StudyAnswerMode
  correct: boolean
  responseMs: number | null
  /** Reveal mode has no automatic check, so the learner grades themselves. */
  selfGrade: Grade | null
}

export function cardIdFor(kind: StudyKind, boneId: string, landmarkId: string | null): string {
  return kind === 'landmark' && landmarkId ? `landmark:${landmarkId}` : `bone:${boneId}`
}

export function parseCardId(cardId: string): { kind: StudyKind; id: string } | null {
  const split = cardId.indexOf(':')
  if (split < 0) return null
  const kind = cardId.slice(0, split)
  const id = cardId.slice(split + 1)
  if ((kind !== 'bone' && kind !== 'landmark') || !id) return null
  return { kind, id }
}
