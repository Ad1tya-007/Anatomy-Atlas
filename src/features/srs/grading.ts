import type { Grade, StudyAnswer } from '@/features/srs/types'

/** Response-time cut-offs in milliseconds: at or under `easy` is Easy, at or under `good` is Good, else Hard. */
const THRESHOLDS = {
  type: { easy: 6000, good: 15_000 },
  locate: { easy: 4000, good: 10_000 },
  // Recognizing a name among four is easier than recalling it, so a correct choice never counts as Easy.
  choice: { easy: 0, good: 8000 },
} as const

/** Maps an answered question to an FSRS grade. */
export function gradeAnswer(answer: Pick<StudyAnswer, 'answerMode' | 'correct' | 'responseMs' | 'selfGrade'>): Grade {
  if (answer.answerMode === 'reveal') return answer.selfGrade ?? (answer.correct ? 3 : 1)
  if (!answer.correct) return 1
  const limits = THRESHOLDS[answer.answerMode]
  const ms = answer.responseMs
  if (ms === null || !Number.isFinite(ms)) return 3
  if (ms <= limits.easy) return 4
  if (ms <= limits.good) return 3
  return 2
}

export const GRADE_LABEL: Record<Grade, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' }
