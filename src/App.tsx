import { AnatomyInfoPanel } from '@/components/AnatomyInfoPanel/AnatomyInfoPanel'
import { AnatomySidebar } from '@/components/AnatomySidebar/AnatomySidebar'
import { Header } from '@/components/Header/Header'
import { HelpDialog } from '@/components/HelpDialog/HelpDialog'
import { Viewer } from '@/components/Viewer/Viewer'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useAnatomyStore } from '@/store/anatomyStore'

function MobileBar() {
  const panel = useAnatomyStore((state) => state.mobilePanel)
  const setMobilePanel = useAnatomyStore((state) => state.setMobilePanel)
  return (
    <div className="grid shrink-0 grid-cols-2 border-t border-line bg-panel lg:hidden">
      <button
        type="button"
        className={`h-12 text-[14px] ${panel === 'nav' ? 'text-accent' : 'text-muted'}`}
        aria-pressed={panel === 'nav'}
        onClick={() => setMobilePanel(panel === 'nav' ? 'none' : 'nav')}
      >
        Explore bones
      </button>
      <button
        type="button"
        className={`h-12 border-l border-line text-[14px] ${panel === 'info' ? 'text-accent' : 'text-muted'}`}
        aria-pressed={panel === 'info'}
        onClick={() => setMobilePanel(panel === 'info' ? 'none' : 'info')}
      >
        Bone info
      </button>
    </div>
  )
}

function MobileDrawers() {
  const panel = useAnatomyStore((state) => state.mobilePanel)
  const setMobilePanel = useAnatomyStore((state) => state.setMobilePanel)
  if (panel === 'none') return null
  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close panel" onClick={() => setMobilePanel('none')} />
      <div className="absolute inset-x-0 bottom-12 top-16 overflow-hidden border-t border-line bg-panel">
        {panel === 'nav' ? <AnatomySidebar className="flex h-full" /> : <AnatomyInfoPanel className="flex h-full" />}
      </div>
    </div>
  )
}

export default function App() {
  useKeyboardShortcuts()
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg font-sans text-text">
      <a
        href="#bone-info"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-panel focus:px-3 focus:py-2"
      >
        Skip to bone details
      </a>
      <Header />
      <div className="flex min-h-0 flex-1">
        <AnatomySidebar className="hidden w-[18.75rem] shrink-0 lg:flex" />
        <Viewer />
        <AnatomyInfoPanel id="bone-info" className="hidden w-[22.5rem] shrink-0 border-l lg:flex" />
      </div>
      <MobileBar />
      <MobileDrawers />
      <HelpDialog />
    </div>
  )
}
