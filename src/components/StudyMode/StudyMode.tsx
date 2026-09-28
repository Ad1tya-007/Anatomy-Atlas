import { buttonClass } from '@/components/buttonStyles'
import { getBone } from '@/data/bones'
import { getLandmark } from '@/data/landmarks'
import { useAnatomyStore } from '@/store/anatomyStore'
import type { StudyKind } from '@/types/anatomy'

function KindToggle() {
  const kind = useAnatomyStore((state) => state.studyKind)
  const setStudyKind = useAnatomyStore((state) => state.setStudyKind)
  const options: Array<{ id: StudyKind; label: string }> = [
    { id: 'bone', label: 'Identify bone' },
    { id: 'landmark', label: 'Identify landmark' },
  ]
  return (
    <div className="flex rounded-md border border-line p-0.5" role="group" aria-label="Study question type">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={kind === option.id}
          className={`h-7 flex-1 rounded px-2 text-[12px] ${
            kind === option.id ? 'bg-white/[0.08] text-text' : 'text-muted hover:text-text'
          }`}
          onClick={() => setStudyKind(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function StudyCard() {
  const studyMode = useAnatomyStore((state) => state.studyMode)
  const studyKind = useAnatomyStore((state) => state.studyKind)
  const revealed = useAnatomyStore((state) => state.studyRevealed)
  const boneId = useAnatomyStore((state) => state.studyBoneId)
  const landmarkId = useAnatomyStore((state) => state.studyLandmarkId)
  const revealStudy = useAnatomyStore((state) => state.revealStudy)
  const nextStudy = useAnatomyStore((state) => state.nextStudy)
  const exitStudy = useAnatomyStore((state) => state.exitStudy)
  const modelState = useAnatomyStore((state) => state.modelState)

  if (!studyMode) return null
  const bone = getBone(boneId)
  const landmark = getLandmark(landmarkId)
  const preparing = !boneId || modelState === 'loading'

  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-3">
      <section
        className="atlas-in pointer-events-auto w-full max-w-md rounded-xl border border-line bg-panel/95 p-4"
        aria-live="polite"
      >
        <p className="text-[11px] font-medium tracking-[0.16em] text-accent uppercase">Study mode</p>
        <div className="mt-3">
          <KindToggle />
        </div>
        {preparing ? (
          <p className="mt-4 text-[15px] text-muted">Preparing your study question...</p>
        ) : (
          <>
            <h2 className="mt-4 text-[15px] text-muted">
              {studyKind === 'bone' ? 'What bone is this?' : 'What anatomical landmark is highlighted?'}
            </h2>
            {studyKind === 'landmark' && bone ? (
              <p className="mt-2 text-[13px] text-faint">{bone.displayName}</p>
            ) : null}
            {!revealed ? (
              <div className="mt-4 grid h-16 place-items-center rounded-md border border-dashed border-line text-[28px] text-faint">
                ?
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-[28px] leading-none font-medium tracking-tight">
                  {studyKind === 'bone' ? bone?.name : landmark?.landmark.name}
                </p>
                <p className="mt-3 text-[14px] leading-6 text-muted">
                  {studyKind === 'bone' ? bone?.description : landmark?.landmark.description}
                </p>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {!revealed ? (
                <button type="button" className={buttonClass('solid')} onClick={revealStudy}>
                  Reveal answer
                </button>
              ) : (
                <button type="button" className={buttonClass('solid')} onClick={nextStudy}>
                  {studyKind === 'bone' ? 'Next bone' : 'Next landmark'}
                </button>
              )}
              <button type="button" className={buttonClass('quiet')} onClick={exitStudy}>
                Exit study
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

export function StudyPanelPrompt() {
  const studyMode = useAnatomyStore((state) => state.studyMode)
  const revealed = useAnatomyStore((state) => state.studyRevealed)
  const studyKind = useAnatomyStore((state) => state.studyKind)
  const boneId = useAnatomyStore((state) => state.studyBoneId)
  if (!studyMode || revealed) return null
  const bone = getBone(boneId)
  return (
    <div className="atlas-in">
      <p className="text-[12px] font-medium tracking-[0.14em] text-accent uppercase">Study mode</p>
      <h2 className="mt-4 text-[28px] leading-tight font-medium tracking-tight">
        {studyKind === 'bone' ? 'Identify the highlighted bone' : 'Identify the landmark'}
      </h2>
      <p className="mt-3 text-[15px] leading-6 text-muted">
        {studyKind === 'bone'
          ? 'A bone is highlighted on the skeleton. Answer in your head, then reveal it.'
          : `${bone?.displayName ?? 'A bone'} is shown with one landmark marked. Name that landmark, then reveal it.`}
      </p>
    </div>
  )
}
