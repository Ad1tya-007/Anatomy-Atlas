import { AnatomyScene } from '@/components/three/AnatomyScene/AnatomyScene'
import { ModelErrorBoundary } from '@/components/ModelErrorBoundary'
import { StudyCard } from '@/components/StudyMode/StudyMode'
import { ViewerControls } from '@/components/ViewerControls/ViewerControls'
import { buttonClass } from '@/components/buttonStyles'
import { getBone } from '@/data/bones'
import { useAnatomyStore } from '@/store/anatomyStore'
import { useRef } from 'react'

export function Viewer() {
  const container = useRef<HTMLDivElement>(null)
  const modelState = useAnatomyStore((state) => state.modelState)
  const retryKey = useAnatomyStore((state) => state.retryKey)
  const retryModel = useAnatomyStore((state) => state.retryModel)
  const hoveredBoneId = useAnatomyStore((state) => state.hoveredBoneId)
  const selectedBoneId = useAnatomyStore((state) => state.selectedBoneId)
  const studyMode = useAnatomyStore((state) => state.studyMode)
  const studyRevealed = useAnatomyStore((state) => state.studyRevealed)
  const hoverName = getBone(hoveredBoneId)?.displayName
  const showHover = Boolean(hoverName && hoveredBoneId !== selectedBoneId && !(studyMode && !studyRevealed))

  return (
    <div
      ref={container}
      className={`relative min-h-0 min-w-0 flex-1 bg-bg [&:fullscreen]:h-screen [&:fullscreen]:w-screen ${
        hoveredBoneId ? '[&_canvas]:cursor-pointer' : ''
      }`}
    >
      <p id="viewer-desc" className="sr-only">
        Interactive 3D skeleton. Drag to rotate, scroll to zoom, and click a bone. The same structures are listed in the anatomy navigator.
      </p>
      <ModelErrorBoundary resetKey={retryKey}>
        <AnatomyScene />
      </ModelErrorBoundary>
      {modelState === 'loading' ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <p className="text-[15px] text-muted">Preparing the skeleton…</p>
        </div>
      ) : null}
      {modelState === 'error' ? (
        <div className="absolute inset-0 grid place-items-center px-6 text-center">
          <div className="max-w-sm">
            <h2 className="text-[22px] font-medium tracking-tight">Unable to load the 3D skeleton.</h2>
            <p className="mt-3 text-[15px] leading-6 text-muted">
              You can still explore the anatomy database using the navigator.
            </p>
            <button type="button" className={buttonClass('solid', 'mt-4')} onClick={retryModel}>
              Retry
            </button>
          </div>
        </div>
      ) : null}
      {showHover ? (
        <div className="pointer-events-none absolute top-4 left-4 rounded-full border border-line bg-panel/90 px-3 py-1 text-[13px] text-text">
          {hoverName}
        </div>
      ) : null}
      {modelState !== 'error' ? <ViewerControls container={container} /> : null}
      <StudyCard />
    </div>
  )
}
