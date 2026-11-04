import { bones, getBone } from '@/data/bones'
import { allLandmarks, getLandmark } from '@/data/landmarks'
import { buildQuestion } from '@/features/study/engine'
import { formatContext, searchBm25 } from '@/features/tutor/retrieval'
import { generatedQuestionSchema, type GeneratedQuestion } from '@/features/tutor/tools'
import { generateText, Output, type LanguageModel } from 'ai'

type Kind = GeneratedQuestion['kind']

function atlasName(kind: Kind, id: string): string | null {
  if (kind === 'bone') return getBone(id)?.name ?? null
  return getLandmark(id)?.landmark.name ?? null
}

/**
 * Checks a model-written question against the atlas and replaces its labels with atlas names, so a choice can never
 * show a name the atlas does not use. Returns the problems found instead of the question when it is unusable.
 */
export function validateQuestion(
  question: GeneratedQuestion,
): { question: GeneratedQuestion } | { problems: string[] } {
  const problems: string[] = []
  const choices = question.choices.map((choice) => {
    const name = atlasName(question.kind, choice.id)
    if (!name) problems.push(`"${choice.id}" is not a ${question.kind} id in the atlas.`)
    return { id: choice.id, label: name ?? choice.label }
  })
  const labels = choices.map((choice) => choice.label.toLowerCase())
  if (new Set(labels).size !== labels.length) {
    problems.push('Two choices have the same atlas name (for example the left and right copy of one bone).')
  }
  if (!choices.some((choice) => choice.id === question.answerId)) problems.push('answerId must be one of the choices.')
  return problems.length > 0 ? { problems } : { question: { ...question, choices } }
}

/** A question built by the study engine, used when the model cannot produce a valid one. */
export function fallbackQuestion(kind: Kind, rng: () => number = Math.random): GeneratedQuestion {
  const config = {
    studyScope: 'all',
    studyRegionId: null,
    studyClassification: null,
    studyAnswerMode: 'choice',
    activeRegion: null,
  } as const
  const built = buildQuestion(config, kind, null, null, rng)
  const answerId = kind === 'landmark' ? built.landmarkId! : built.boneId
  const answer = atlasName(kind, answerId)!
  const idFor = (label: string) =>
    kind === 'landmark'
      ? allLandmarks.find((record) => record.landmark.name === label)?.landmark.id
      : bones.find((bone) => bone.name === label)?.id
  const choices = built.choices.map((label) => ({
    id: label === answer ? answerId : (idFor(label) ?? answerId),
    label,
  }))
  return {
    kind,
    prompt: kind === 'landmark' ? 'Which landmark is this?' : 'Which bone is this?',
    choices,
    answerId,
    explanation:
      (kind === 'landmark' ? getLandmark(answerId)?.landmark.description : getBone(answerId)?.description) ?? '',
  }
}

export interface QuestionResult {
  question: GeneratedQuestion
  /** True when the study engine wrote it because the model's attempts failed validation. */
  fallback: boolean
  attempts: number
}

export async function generateQuestion(
  model: LanguageModel,
  { kind, topic }: { kind: Kind; topic: string },
  { maxAttempts = 3, abortSignal }: { maxAttempts?: number; abortSignal?: AbortSignal } = {},
): Promise<QuestionResult> {
  const documents = formatContext(searchBm25(`${topic} ${kind}`, 8))
  let feedback = ''
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const { output } = await generateText({
      model,
      abortSignal,
      temperature: 0.7,
      output: Output.object({ schema: generatedQuestionSchema, name: 'question' }),
      system:
        'You write one multiple-choice anatomy question for a student, using only the atlas documents provided. ' +
        `Every choice id must be a ${kind} id that appears in a document's cite tag (the part after "${kind}:"). ` +
        'Use three or four choices with different names, exactly one correct. The explanation cites nothing and stays under 60 words.',
      prompt: `Topic: ${topic}\nQuestion kind: ${kind}\n\n<atlas>\n${documents}\n</atlas>${feedback}`,
    })
    const checked = validateQuestion({ ...output, kind })
    if ('question' in checked) return { question: checked.question, fallback: false, attempts: attempt }
    feedback = `\n\nYour previous question was rejected:\n- ${checked.problems.join('\n- ')}\nFix these problems.`
  }
  return { question: fallbackQuestion(kind), fallback: true, attempts: maxAttempts }
}
