import { buttonClass } from '@/components/buttonStyles'
import { useAnatomyStore } from '@/store/anatomyStore'
import type { CameraPresetName } from '@/types/anatomy'
import { Maximize2, Minimize2 } from 'lucide-react'
import { useEffect, useState, type RefObject } from 'react'

const VIEWS: Array<{ id: CameraPresetName; label: string }> = [
  { id: 'default', label: 'Reset' },
  { id: 'front', label: 'Front' },
  { id: 'back', label: 'Back' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'top', label: 'Top' },
]

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
      <p className="pointer-events-none hidden text-[11px] text-faint sm:block">
        Drag to rotate · Scroll or pinch to zoom · Right-drag to pan
      </p>
      <div className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-line bg-panel/95 p-1">
        {VIEWS.map((view) => (
          <button
            key={view.id}
            type="button"
            className={buttonClass('quiet', 'shrink-0 px-2')}
            onClick={() => requestPreset(view.id)}
          >
            {view.id === 'default' ? 'Reset' : view.label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px shrink-0 bg-line" aria-hidden />
        <details className="relative shrink-0">
          <summary className={buttonClass('quiet', 'cursor-pointer list-none px-2')}>Visibility</summary>
          <fieldset className="absolute bottom-full left-0 z-20 mb-2 w-44 rounded-md border border-line bg-panel p-2">
            <legend className="sr-only">Skeleton visibility</legend>
            <VisibilityOption label="Bones" checked={showBones} onChange={setShowBones} />
            <VisibilityOption label="Labels" checked={showLabels} onChange={setShowLabels} />
            <VisibilityOption label="Landmarks" checked={showLandmarks} onChange={setShowLandmarks} />
          </fieldset>
        </details>
        <button
          type="button"
          className={buttonClass('quiet', 'shrink-0 px-2')}
          disabled={!selectedBoneId}
          onClick={() => (isolated ? clearIsolation() : toggleIsolate())}
        >
          {isolated ? 'Full skeleton' : 'Isolate'}
        </button>
        <button
          type="button"
          className={buttonClass('ghost', 'h-8 w-8 shrink-0 px-0')}
          aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          onClick={toggleFullscreen}
        >
          {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  )
}

function VisibilityOption({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-[13px] hover:bg-white/[0.04]">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  )
}
