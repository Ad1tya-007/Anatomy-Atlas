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
import { Slider } from '@/components/ui/slider'
import { useAnatomyStore } from '@/store/anatomyStore'
import type { CameraPresetName, LookName, SectionAxis } from '@/types/anatomy'
import { Maximize2, Minimize2 } from 'lucide-react'
import { useEffect, useState, type ReactNode, type RefObject } from 'react'

const LOOKS: Array<{ id: LookName; label: string }> = [
  { id: 'atlas', label: 'Atlas' },
  { id: 'ivory', label: 'Ivory' },
  { id: 'radiograph', label: 'Radiograph' },
]

const SECTIONS: Array<{ id: SectionAxis; label: string }> = [
  { id: 'off', label: 'Off' },
  { id: 'sagittal', label: 'Sagittal' },
  { id: 'coronal', label: 'Coronal' },
  { id: 'transverse', label: 'Transverse' },
]

const SECTION_ENDS: Record<Exclude<SectionAxis, 'off'>, [string, string]> = {
  sagittal: ['Right', 'Left'],
  coronal: ['Posterior', 'Anterior'],
  transverse: ['Inferior', 'Superior'],
}

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
  const look = useAnatomyStore((state) => state.look)
  const sectionAxis = useAnatomyStore((state) => state.sectionAxis)
  const sectionAmount = useAnatomyStore((state) => state.sectionAmount)
  const spread = useAnatomyStore((state) => state.spread)
  const setLook = useAnatomyStore((state) => state.setLook)
  const setSectionAxis = useAnatomyStore((state) => state.setSectionAxis)
  const setSectionAmount = useAnatomyStore((state) => state.setSectionAmount)
  const setSpread = useAnatomyStore((state) => state.setSpread)
  const [fullscreen, setFullscreen] = useState(false)
  const sectionEnds = sectionAxis === 'off' ? null : SECTION_ENDS[sectionAxis]

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
      <div className="pointer-events-auto flex max-w-full flex-col gap-1 overflow-x-auto rounded-lg border bg-card/80 p-1 backdrop-blur-sm">
        <div className="flex items-center gap-1">
          <ButtonGroup>
            {VIEWS.map((view) => (
              <Hint
                key={view.id}
                label={view.id === 'default' ? 'Reset camera' : `${view.label} view`}
                shortcut={view.shortcut}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => requestPreset(view.id)}
                >
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
              <DropdownMenuCheckboxItem
                checked={showLandmarks}
                onCheckedChange={(value) => setShowLandmarks(value === true)}
              >
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
        <div className="flex items-center gap-1">
          <ButtonGroup aria-label="Look">
            {LOOKS.map((item) => (
              <Hint
                key={item.id}
                label={`${item.label} look`}
                shortcut={item.id === 'atlas' ? '1' : item.id === 'ivory' ? '2' : '3'}
              >
                <Button
                  type="button"
                  variant={look === item.id ? 'default' : 'ghost'}
                  size="sm"
                  className="shrink-0"
                  aria-pressed={look === item.id}
                  onClick={() => setLook(item.id)}
                >
                  {item.label}
                </Button>
              </Hint>
            ))}
          </ButtonGroup>
          <Separator orientation="vertical" className="mx-1 h-4" />
          <ButtonGroup aria-label="Section">
            {SECTIONS.map((item) => (
              <Button
                key={item.id}
                type="button"
                variant={sectionAxis === item.id ? 'default' : 'ghost'}
                size="sm"
                className="shrink-0"
                aria-pressed={sectionAxis === item.id}
                onClick={() => setSectionAxis(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </ButtonGroup>
          {sectionEnds ? (
            <div className="flex shrink-0 items-center gap-2 px-1">
              <span className="kicker">{sectionEnds[0]}</span>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={[sectionAmount]}
                aria-label="Section amount"
                className="w-24"
                onValueChange={(value) => {
                  const next = Array.isArray(value) ? value[0] : value
                  if (typeof next === 'number') setSectionAmount(next)
                }}
              />
              <span className="kicker">{sectionEnds[1]}</span>
            </div>
          ) : null}
          <Separator orientation="vertical" className="mx-1 h-4" />
          <span className="kicker w-16 shrink-0 text-center">{spread === 0 ? 'Anatomical' : 'Spread'}</span>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={[spread]}
            aria-label="Spread"
            className="w-24 shrink-0"
            onValueChange={(value) => {
              const next = Array.isArray(value) ? value[0] : value
              if (typeof next === 'number') setSpread(next)
            }}
          />
        </div>
      </div>
    </div>
  )
}
