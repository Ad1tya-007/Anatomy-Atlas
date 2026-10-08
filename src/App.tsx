import { AnatomyInfoPanel } from '@/components/AnatomyInfoPanel/AnatomyInfoPanel'
import { AnatomySidebar } from '@/components/AnatomySidebar/AnatomySidebar'
import { Header } from '@/components/Header/Header'
import { HelpDialog } from '@/components/HelpDialog/HelpDialog'
import { Viewer } from '@/components/Viewer/Viewer'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useAnatomyStore } from '@/store/anatomyStore'
import { Info, ListTree } from 'lucide-react'

function MobileBar() {
  const panel = useAnatomyStore((state) => state.mobilePanel)
  const setMobilePanel = useAnatomyStore((state) => state.setMobilePanel)
  return (
    <div className="relative z-[60] grid shrink-0 grid-cols-2 border-t bg-card lg:hidden">
      <Button
        type="button"
        variant={panel === 'nav' ? 'secondary' : 'ghost'}
        className="h-12 rounded-none"
        aria-pressed={panel === 'nav'}
        onClick={() => setMobilePanel(panel === 'nav' ? 'none' : 'nav')}
      >
        <ListTree />
        Navigator
      </Button>
      <Button
        type="button"
        variant={panel === 'info' ? 'secondary' : 'ghost'}
        className="h-12 rounded-none border-l"
        aria-pressed={panel === 'info'}
        onClick={() => setMobilePanel(panel === 'info' ? 'none' : 'info')}
      >
        <Info />
        Details
      </Button>
    </div>
  )
}

function MobileDrawers() {
  const panel = useAnatomyStore((state) => state.mobilePanel)
  const setMobilePanel = useAnatomyStore((state) => state.setMobilePanel)
  return (
    <>
      <Sheet open={panel === 'nav'} onOpenChange={(open) => setMobilePanel(open ? 'nav' : 'none')}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="top-14 bottom-12 h-auto max-h-none gap-0 p-0"
        >
          <AnatomySidebar className="flex h-full" />
        </SheetContent>
      </Sheet>
      <Sheet open={panel === 'info'} onOpenChange={(open) => setMobilePanel(open ? 'info' : 'none')}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="top-14 bottom-12 h-auto max-h-none gap-0 p-0"
        >
          <AnatomyInfoPanel className="flex h-full" />
        </SheetContent>
      </Sheet>
    </>
  )
}

export default function App() {
  useKeyboardShortcuts()
  return (
    <TooltipProvider>
      <div className="flex h-dvh flex-col overflow-hidden bg-background font-sans text-foreground">
        <a
          href="#bone-info"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:bg-card focus:px-3 focus:py-2"
        >
          Skip to bone details
        </a>
        <Header />
        <div className="flex min-h-0 flex-1">
          <AnatomySidebar className="hidden w-[19.5rem] shrink-0 lg:flex" />
          <Viewer />
          <AnatomyInfoPanel id="bone-info" className="hidden w-[23rem] shrink-0 border-l lg:flex" />
        </div>
        <MobileBar />
        <MobileDrawers />
        <HelpDialog />
      </div>
    </TooltipProvider>
  )
}
