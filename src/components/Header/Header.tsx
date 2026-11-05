import { AccountButton } from '@/components/AccountButton/AccountButton'
import { SearchField } from '@/components/Search/SearchField'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getBone } from '@/data/bones'
import { getJoint } from '@/data/joints'
import { getLandmark } from '@/data/landmarks'
import { currentViewUrl } from '@/hooks/useUrlSync'
import { useAnatomyStore } from '@/store/anatomyStore'
import { cn } from '@/lib/utils'
import { BarChart3, BookOpen, CircleHelp, Link2 } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { toast } from 'sonner'

const ProgressDialog = lazy(() => import('@/components/ProgressDialog/ProgressDialog'))

async function copyViewLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(currentViewUrl())
    toast.success('Link copied', { description: 'Anyone with the link opens this exact view.' })
  } catch {
    toast.error('Could not copy the link', { description: 'Copy it from the address bar instead.' })
  }
}

export function Header() {
  const studyMode = useAnatomyStore((state) => state.studyMode)
  const studyRevealed = useAnatomyStore((state) => state.studyRevealed)
  const selectedBoneId = useAnatomyStore((state) => state.selectedBoneId)
  const selectedLandmarkId = useAnatomyStore((state) => state.selectedLandmarkId)
  const selectedJointId = useAnatomyStore((state) => state.selectedJointId)
  const enterStudy = useAnatomyStore((state) => state.enterStudy)
  const exitStudy = useAnatomyStore((state) => state.exitStudy)
  const setHelpOpen = useAnatomyStore((state) => state.setHelpOpen)
  const [progressOpen, setProgressOpen] = useState(false)
  const [progressLoaded, setProgressLoaded] = useState(false)
  const hideName = studyMode && !studyRevealed
  const readout = hideName
    ? null
    : (getLandmark(selectedLandmarkId)?.landmark.name ??
      getJoint(selectedJointId)?.name ??
      getBone(selectedBoneId)?.name ??
      null)

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/8 bg-background/80 px-3 backdrop-blur-xl sm:px-4">
      <div className="flex min-w-0 shrink-0 items-center gap-2.5">
        <svg viewBox="0 0 32 32" aria-hidden className="size-8 shrink-0 text-primary">
          <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
          <path d="M16 8v16M8 16h16" stroke="currentColor" strokeWidth="1" />
          <circle cx="16" cy="16" r="1.7" fill="currentColor" />
          <path d="M16 4.5v2.4M16 25.1v2.4M4.5 16h2.4M25.1 16h2.4" stroke="var(--specimen)" strokeWidth="1.4" />
        </svg>
        <div className="min-w-0">
          <div className="font-specimen text-[17px] leading-none tracking-tight">Anatomy Atlas</div>
          <p className="kicker mt-1 hidden sm:block">Skeletal system</p>
        </div>
      </div>
      {readout ? (
        <p className="hidden min-w-0 max-w-[16rem] items-center gap-2 font-specimen text-[15px] leading-none text-specimen lg:flex">
          <span className="size-1 shrink-0 rounded-full bg-specimen" aria-hidden />
          <span className="truncate">{readout}</span>
        </p>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-xl">
          <SearchField />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={studyMode ? 'default' : 'outline'}
              aria-pressed={studyMode}
              className={cn(!studyMode && 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/18')}
              onClick={() => (studyMode ? exitStudy() : enterStudy('bone'))}
            >
              <BookOpen />
              <span className="hidden sm:inline">{studyMode ? 'Exit study' : 'Study'}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {studyMode ? 'Leave the current sitting' : 'Practice naming bones and landmarks'}
          </TooltipContent>
        </Tooltip>
        <div className="flex items-center rounded-lg border border-white/10 bg-white/3 p-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Open your progress"
                onClick={() => {
                  setProgressLoaded(true)
                  setProgressOpen(true)
                }}
              >
                <BarChart3 />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Progress and mastery</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Copy link to this view"
                onClick={copyViewLink}
              >
                <Link2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy link to this view</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Open controls guide"
                onClick={() => setHelpOpen(true)}
              >
                <CircleHelp />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Controls</TooltipContent>
          </Tooltip>
          <AccountButton />
        </div>
      </div>
      {progressLoaded ? (
        <Suspense fallback={null}>
          <ProgressDialog open={progressOpen} onOpenChange={setProgressOpen} />
        </Suspense>
      ) : null}
    </header>
  )
}
