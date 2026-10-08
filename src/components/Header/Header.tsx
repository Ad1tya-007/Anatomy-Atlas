import { SearchField } from '@/components/Search/SearchField'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAnatomyStore } from '@/store/anatomyStore'
import { BookOpen, CircleHelp } from 'lucide-react'

export function Header() {
  const studyMode = useAnatomyStore((state) => state.studyMode)
  const enterStudy = useAnatomyStore((state) => state.enterStudy)
  const exitStudy = useAnatomyStore((state) => state.exitStudy)
  const setHelpOpen = useAnatomyStore((state) => state.setHelpOpen)

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-3 sm:px-4">
      <div className="flex min-w-0 shrink-0 items-center gap-2.5">
        <div className="grid size-8 shrink-0 place-items-center border border-primary/50 bg-primary/10 font-mono text-[10px] font-medium text-primary">
          AA
        </div>
        <div className="min-w-0">
          <div className="text-[15px] leading-none font-medium tracking-tight sm:text-base">Anatomy Atlas</div>
          <p className="kicker mt-1 hidden sm:block">Skeletal system</p>
        </div>
      </div>
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
              onClick={() => (studyMode ? exitStudy() : enterStudy('bone'))}
            >
              <BookOpen />
              <span className="hidden sm:inline">{studyMode ? 'Exit study' : 'Study'}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{studyMode ? 'Leave the current sitting' : 'Practice naming bones and landmarks'}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="outline" size="icon" aria-label="Open controls guide" onClick={() => setHelpOpen(true)}>
              <CircleHelp />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Controls</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}
