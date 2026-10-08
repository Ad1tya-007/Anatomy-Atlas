import { Button } from '@/components/ui/button'
import { useAnatomyStore } from '@/store/anatomyStore'
import type { Landmark } from '@/types/anatomy'
import { cn } from '@/lib/utils'

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
      <h3 id={`landmarks-${boneId}`} className="kicker">
        Bony landmarks
      </h3>
      <ul className="mt-2">
        {landmarks.map((landmark) => {
          const active = !answerHidden && landmark.id === selectedLandmarkId
          return (
            <li key={landmark.id}>
              <Button
                type="button"
                variant="ghost"
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'h-auto w-full justify-start gap-2 px-2 py-2 text-left font-normal whitespace-normal',
                  active && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
                )}
                onClick={() => selectLandmark(landmark.id)}
              >
                <span className={cn('size-1.5 shrink-0', active ? 'bg-primary' : 'bg-muted-foreground')} aria-hidden />
                <span className="text-sm">{landmark.name}</span>
                {active ? <span className="sr-only"> selected</span> : null}
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
