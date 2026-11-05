import { Button } from '@/components/ui/button'
import { quizBones } from '@/data/bones'
import { bandFor, MASTERY_BANDS, UNSTUDIED_COLOR } from '@/features/srs/mastery'
import { startWeakestWalk } from '@/features/srs/startWeakestWalk'
import { useMasteryByBone } from '@/features/srs/useMastery'
import { useAnatomyStore } from '@/store/anatomyStore'
import { ChevronDown, Route } from 'lucide-react'
import { useId, useMemo, useState } from 'react'

function startsOpen(): boolean {
  return typeof window === 'undefined' || window.matchMedia('(min-width: 1280px)').matches
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function MasteryLegend() {
  const look = useAnatomyStore((state) => state.look)
  const mastery = useMasteryByBone()
  const [open, setOpen] = useState(startsOpen)
  const bodyId = useId()
  const counts = useMemo(() => {
    const byBand = new Map<string, number>()
    let unstudied = 0
    for (const bone of quizBones()) {
      const value = mastery.get(bone.id)
      if (value === undefined) unstudied += 1
      else byBand.set(bandFor(value).id, (byBand.get(bandFor(value).id) ?? 0) + 1)
    }
    return { byBand, unstudied }
  }, [mastery])
  if (look !== 'mastery') return null
  const bands = MASTERY_BANDS.toReversed()

  return (
    <section
      aria-label="Mastery legend"
      className="atlas-placard pointer-events-auto absolute top-4 right-4 z-20 w-56 px-3.5 py-3 text-[12px]"
    >
      <h2 className="kicker">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          Estimated recall
          <ChevronDown className={`size-3.5 transition-transform ${open ? '' : '-rotate-90'}`} aria-hidden />
        </button>
      </h2>
      <div id={bodyId} hidden={!open}>
        <ul className="mt-2 grid gap-1">
          {bands.map((band, index) => {
            const upper = index === 0 ? null : bands[index - 1]!.min
            const range = upper === null ? `≥ ${percent(band.min)}` : `${percent(band.min)}–${percent(upper)}`
            return (
              <li key={band.id} className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: band.color }} aria-hidden />
                <span className="flex-1">{band.label}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{range}</span>
                <span className="w-6 text-right font-mono text-[10px]">{counts.byBand.get(band.id) ?? 0}</span>
              </li>
            )
          })}
          <li className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: UNSTUDIED_COLOR }} aria-hidden />
            <span className="flex-1">Not studied</span>
            <span className="w-6 text-right font-mono text-[10px]">{counts.unstudied}</span>
          </li>
        </ul>
        {mastery.size > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3 w-full"
            onClick={() => startWeakestWalk(mastery)}
          >
            <Route />
            Walk my weakest bones
          </Button>
        ) : (
          <p className="mt-3 text-muted-foreground">Answer study questions to fill in the map.</p>
        )}
      </div>
    </section>
  )
}
