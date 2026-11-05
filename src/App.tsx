import { AnatomyInfoPanel } from '@/components/AnatomyInfoPanel/AnatomyInfoPanel'
import { AnatomySidebar } from '@/components/AnatomySidebar/AnatomySidebar'
import { Header } from '@/components/Header/Header'
import { HelpDialog } from '@/components/HelpDialog/HelpDialog'
import { Viewer } from '@/components/Viewer/Viewer'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Toaster } from '@/components/ui/sonner'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useSpacedRepetition } from '@/features/srs/useSpacedRepetition'
import { useSync } from '@/features/sync/useSync'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useUrlSync } from '@/hooks/useUrlSync'
import { useAnatomyStore } from '@/store/anatomyStore'
import type { SidePanel } from '@/types/anatomy'
import { Info, ListTree, MessagesSquare } from 'lucide-react'
import { lazy, Suspense } from 'react'

const TutorPanel = lazy(() => import('@/components/TutorPanel/TutorPanel'))

function TutorFallback() {
  return (
    <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
      <Spinner /> Loading the tutor…
    </div>
  )
}

function DesktopSidePanel() {
  const sidePanel = useAnatomyStore((state) => state.sidePanel)
  const setSidePanel = useAnatomyStore((state) => state.setSidePanel)
  return (
    <Tabs
      value={sidePanel}
      onValueChange={(value) => setSidePanel(value as SidePanel)}
      className="atlas-panel hidden w-[23.5rem] shrink-0 gap-0 overflow-hidden lg:flex"
    >
      <div className="flex items-end justify-between gap-3 border-b border-white/6 px-4">
        <p className="kicker pb-2.5">Reference</p>
        <TabsList variant="line" className="h-10 bg-transparent">
          <TabsTrigger value="details">
            <Info /> Details
          </TabsTrigger>
          <TabsTrigger value="tutor">
            <MessagesSquare /> Tutor
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="details" className="min-h-0">
        <AnatomyInfoPanel id="bone-info" className="flex" />
      </TabsContent>
      <TabsContent value="tutor" className="min-h-0">
        <Suspense fallback={<TutorFallback />}>
          <TutorPanel className="flex" />
        </Suspense>
      </TabsContent>
    </Tabs>
  )
}

function MobileBar() {
  const panel = useAnatomyStore((state) => state.mobilePanel)
  const setMobilePanel = useAnatomyStore((state) => state.setMobilePanel)
  return (
    <div className="relative z-[60] grid shrink-0 grid-cols-3 divide-x divide-white/8 border-t border-white/10 bg-card/92 backdrop-blur-xl lg:hidden">
      <Button
        type="button"
        variant="ghost"
        className={`h-12 rounded-none ${panel === 'nav' ? 'text-primary shadow-[inset_0_2px_0_0_var(--primary)]' : 'text-muted-foreground'}`}
        aria-pressed={panel === 'nav'}
        onClick={() => setMobilePanel(panel === 'nav' ? 'none' : 'nav')}
      >
        <ListTree />
        Navigator
      </Button>
      <Button
        type="button"
        variant="ghost"
        className={`h-12 rounded-none ${panel === 'info' ? 'text-primary shadow-[inset_0_2px_0_0_var(--primary)]' : 'text-muted-foreground'}`}
        aria-pressed={panel === 'info'}
        onClick={() => setMobilePanel(panel === 'info' ? 'none' : 'info')}
      >
        <Info />
        Details
      </Button>
      <Button
        type="button"
        variant="ghost"
        className={`h-12 rounded-none ${panel === 'tutor' ? 'text-primary shadow-[inset_0_2px_0_0_var(--primary)]' : 'text-muted-foreground'}`}
        aria-pressed={panel === 'tutor'}
        onClick={() => setMobilePanel(panel === 'tutor' ? 'none' : 'tutor')}
      >
        <MessagesSquare />
        Tutor
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
          className="top-14 bottom-12 h-auto max-h-none gap-0 p-0 lg:hidden"
        >
          <AnatomySidebar className="flex h-full" />
        </SheetContent>
      </Sheet>
      <Sheet open={panel === 'info'} onOpenChange={(open) => setMobilePanel(open ? 'info' : 'none')}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="top-14 bottom-12 h-auto max-h-none gap-0 p-0 lg:hidden"
        >
          <AnatomyInfoPanel className="flex h-full" />
        </SheetContent>
      </Sheet>
      {/* Half height and non-modal, so the viewer stays visible while the tutor moves the camera. */}
      <Sheet open={panel === 'tutor'} modal={false} onOpenChange={(open) => setMobilePanel(open ? 'tutor' : 'none')}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="top-[42%] bottom-12 h-auto max-h-none gap-0 p-0 lg:hidden"
          onInteractOutside={(event) => event.preventDefault()}
        >
          <SheetTitle className="sr-only">Tutor</SheetTitle>
          <Suspense fallback={<TutorFallback />}>
            <TutorPanel className="flex h-full" />
          </Suspense>
        </SheetContent>
      </Sheet>
    </>
  )
}

export default function App() {
  useKeyboardShortcuts()
  useUrlSync()
  useSpacedRepetition()
  useSync()
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
        <div className="flex min-h-0 flex-1 gap-2 px-2 pt-2 pb-2">
          <AnatomySidebar className="atlas-panel hidden w-80 shrink-0 overflow-hidden lg:flex" />
          <Viewer />
          <DesktopSidePanel />
        </div>
        <MobileBar />
        <MobileDrawers />
        <HelpDialog />
        <Toaster position="bottom-center" />
      </div>
    </TooltipProvider>
  )
}
