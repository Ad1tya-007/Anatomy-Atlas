import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Kbd } from '@/components/ui/kbd'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAnatomyStore } from '@/store/anatomyStore'
import type { CameraPresetName } from '@/types/anatomy'
import { Maximize2, Minimize2 } from 'lucide-react'
import { useEffect, useState, type ReactNode, type RefObject } from 'react'

const VIEWS: Array<{ id: CameraPresetName; label: string; shortcut?: string }> = [
  { id: 'default', label: 'Reset', shortcut: 'R' },
  { id: 'front', label: 'Front', shortcut: 'F' },
  { id: 'back', label: 'Back', shortcut: 'B' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'top', label: 'Top' },
]

function Hint({ label, shortcut, children }: { label: string; shortcut?: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut ? <Kbd>{shortcut}</Kbd> : null}
      </TooltipContent>
    </Tooltip>
  )
}

export function ViewerControls({ container }: { container: RefObject<HTMLDivElement | null> }) {
  const requestPreset = useAnatomyStore((state) => state.requestPreset)
  const showBones = useAnatomyStore((state) => state.showBones)
  const showLabels = useAnatomyStore((state) => state.showLabels)
  const showLandmarks = useAnatomyStore((state) => state.showLandmarks)
  const setShowBones = useAnatomyStore((state) => state.setShowBones)
  const setShowLabels = useAnatomyStore((state) => state.setShowLabels)
  const setShowLandmarks = useAnatomyStore((state) => state.setShowLandmarks)
  const isolated = useAnatomyStore((state) => state.isolated)
  const selectedBoneId = useAnatomyStore((state) => state.selectedBoneId)
  const toggleIsolate = useAnatomyStore((state) => state.toggleIsolate)
  const clearIsolation = useAnatomyStore((state) => state.clearIsolation)
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === container.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [container])

  const toggleFullscreen = () => {
    const node = container.current
    if (!node) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void node.requestFullscreen()
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex flex-col items-center gap-2 px-3">
      <p className="kicker pointer-events-none hidden sm:block">Drag rotate · scroll zoom · right-drag pan</p>
      <div className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto border bg-card/95 p-1 backdrop-blur-sm">
        <ButtonGroup>
          {VIEWS.map((view) => (
            <Hint key={view.id} label={view.id === 'default' ? 'Reset camera' : `${view.label} view`} shortcut={view.shortcut}>
              <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => requestPreset(view.id)}>
                {view.label}
              </Button>
            </Hint>
          ))}
        </ButtonGroup>
        <Separator orientation="vertical" className="mx-1 h-4" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="shrink-0">
              Visibility
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuLabel>Skeleton layers</DropdownMenuLabel>
            <DropdownMenuCheckboxItem checked={showBones} onCheckedChange={(value) => setShowBones(value === true)}>
              Bones
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={showLabels} onCheckedChange={(value) => setShowLabels(value === true)}>
              Labels
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={showLandmarks} onCheckedChange={(value) => setShowLandmarks(value === true)}>
              Landmarks
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Hint label={isolated ? 'Show the full skeleton' : 'Isolate the selection'} shortcut="I">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            disabled={!selectedBoneId}
            onClick={() => (isolated ? clearIsolation() : toggleIsolate())}
          >
            {isolated ? 'Full skeleton' : 'Isolate'}
          </Button>
        </Hint>
        <Hint label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="shrink-0"
            aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            onClick={toggleFullscreen}
          >
            {fullscreen ? <Minimize2 /> : <Maximize2 />}
          </Button>
        </Hint>
      </div>
    </div>
  )
}
