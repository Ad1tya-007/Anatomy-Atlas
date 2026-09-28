import { buttonClass } from '@/components/buttonStyles'
import { SearchField } from '@/components/Search/SearchField'
import { useAnatomyStore } from '@/store/anatomyStore'
import { BookOpen, CircleHelp } from 'lucide-react'

export function Header() {
  const studyMode = useAnatomyStore((state) => state.studyMode)
  const enterStudy = useAnatomyStore((state) => state.enterStudy)
  const exitStudy = useAnatomyStore((state) => state.exitStudy)
  const setHelpOpen = useAnatomyStore((state) => state.setHelpOpen)

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-panel px-3 sm:px-4">
      <div className="min-w-[8.5rem] shrink-0">
        <div className="text-[20px] leading-none font-medium tracking-tight sm:text-[22px]">Anatomy Atlas</div>
        <p className="mt-1 hidden text-[12px] text-muted sm:block">Interactive Skeletal System</p>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-xl">
          <SearchField />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          className={buttonClass(studyMode ? 'solid' : 'ghost')}
          aria-pressed={studyMode}
          onClick={() => (studyMode ? exitStudy() : enterStudy('bone'))}
        >
          <BookOpen className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">{studyMode ? 'Exit study' : 'Study Mode'}</span>
        </button>
        <button
          type="button"
          className={buttonClass('ghost', 'w-8 px-0')}
          aria-label="Open controls guide"
          onClick={() => setHelpOpen(true)}
        >
          <CircleHelp className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
