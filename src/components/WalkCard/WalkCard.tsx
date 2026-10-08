import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { getBone } from '@/data/bones'
import { getJoint } from '@/data/joints'
import { getLandmark } from '@/data/landmarks'
import { getWalk, resolvedStops } from '@/data/walks'
import { useAnatomyStore } from '@/store/anatomyStore'
import type { WalkStop } from '@/types/anatomy'

function stopTitle(stop: WalkStop): string {
  if (stop.jointId) return getJoint(stop.jointId)?.name ?? 'Joint'
  if (stop.landmarkId) return getLandmark(stop.landmarkId)?.landmark.name ?? 'Landmark'
  return getBone(stop.boneId)?.name ?? 'Bone'
}

export function WalkCard() {
  const walkId = useAnatomyStore((state) => state.walkId)
  const walkIndex = useAnatomyStore((state) => state.walkIndex)
  const stepWalk = useAnatomyStore((state) => state.stepWalk)
  const exitWalk = useAnatomyStore((state) => state.exitWalk)
  const walk = getWalk(walkId)
  if (!walk) return null
  const stops = resolvedStops(walk)
  const stop = stops[walkIndex]
  if (!stop) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-3">
      <Card
        size="sm"
        className="atlas-in pointer-events-auto w-full max-w-md gap-3 bg-card/95 py-4 ring-foreground/15 backdrop-blur-sm"
        aria-live="polite"
      >
        <div className="px-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="kicker text-primary!">{walk.title}</h2>
            <p className="font-mono text-[11px] text-muted-foreground">
              {walkIndex + 1} of {stops.length}
            </p>
          </div>
          <Progress className="mt-3" value={((walkIndex + 1) / stops.length) * 100} aria-label="Walk progress" />
          <p className="mt-3 text-xl leading-tight font-medium tracking-tight">{stopTitle(stop)}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{stop.text}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={walkIndex === 0} onClick={() => stepWalk(-1)}>
              Back
            </Button>
            <Button type="button" onClick={() => stepWalk(1)}>
              Next
            </Button>
            <Button type="button" variant="ghost" onClick={exitWalk}>
              Exit walk
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
