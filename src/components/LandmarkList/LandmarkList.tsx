import { useAnatomyStore } from '@/store/anatomyStore'
import type { Landmark } from '@/types/anatomy'
import { cn } from '@/utils/cn'

export function LandmarkList({ landmarks, boneId }: { landmarks: Landmark[]; boneId: string }) {
  const selectedLandmarkId = useAnatomyStore((state) => state.selectedLandmarkId)
  const selectLandmark = useAnatomyStore((state) => state.selectLandmark)
  const studyMode = useAnatomyStore((state) => state.studyMode)
  const studyRevealed = useAnatomyStore((state) => state.studyRevealed)
  const studyKind = useAnatomyStore((state) => state.studyKind)

  if (landmarks.length === 0) return null
  if (studyMode && !studyRevealed) return null

  const answerHidden = studyMode && !studyRevealed && studyKind === 'landmark'

  return (
    <section className="mt-6" aria-labelledby={`landmarks-${boneId}`}>
      <h3 id={`landmarks-${boneId}`} className="text-[12px] font-medium tracking-[0.14em] text-faint uppercase">
        Bony landmarks
      </h3>
      <ul className="mt-2">
        {landmarks.map((landmark) => {
          const active = !answerHidden && landmark.id === selectedLandmarkId
          return (
            <li key={landmark.id}>
              <button
                type="button"
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors',
                  active ? 'bg-accent/10' : 'hover:bg-white/[0.04]',
                )}
                onClick={() => selectLandmark(landmark.id)}
              >
                <span
                  className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', active ? 'bg-accent' : 'bg-faint')}
                  aria-hidden
                />
                <span>
                  <span className={cn('block text-[14px]', active ? 'text-accent' : 'text-text')}>{landmark.name}</span>
                  {active ? <span className="sr-only"> selected</span> : null}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
