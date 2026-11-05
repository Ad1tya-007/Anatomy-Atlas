import { MasteryLegend } from '@/components/MasteryLegend/MasteryLegend'
import { ModelErrorBoundary } from '@/components/ModelErrorBoundary'
import { StudyCard } from '@/components/StudyMode/StudyMode'
import { WalkCard } from '@/components/WalkCard/WalkCard'
import { ViewerControls } from '@/components/ViewerControls/ViewerControls'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { getBone } from '@/data/bones'
import { useMasteryByBone } from '@/features/srs/useMastery'
import { useAnatomyStore } from '@/store/anatomyStore'
import { lazy, Suspense, useRef } from 'react'

// three.js, R3F, and drei are most of the JavaScript; the request starts with the app bundle instead of at first render.
const sceneModule = import('@/components/three/AnatomyScene/AnatomyScene')
const AnatomyScene = lazy(() => sceneModule.then((module) => ({ default: module.AnatomyScene })))

export function Viewer() {
  const container = useRef<HTMLDivElement>(null)
  const modelState = useAnatomyStore((state) => state.modelState)
  const retryKey = useAnatomyStore((state) => state.retryKey)
  const retryModel = useAnatomyStore((state) => state.retryModel)
  const hoveredBoneId = useAnatomyStore((state) => state.hoveredBoneId)
  const selectedBoneId = useAnatomyStore((state) => state.selectedBoneId)
  const studyMode = useAnatomyStore((state) => state.studyMode)
  const studyRevealed = useAnatomyStore((state) => state.studyRevealed)
  const studyAnswerMode = useAnatomyStore((state) => state.studyAnswerMode)
  const hasSelected = useAnatomyStore((state) => state.hasSelected)
  const look = useAnatomyStore((state) => state.look)
  const mastery = useMasteryByBone()
  const hoverName = getBone(hoveredBoneId)?.displayName
  const hoverRecall = look === 'mastery' && hoveredBoneId ? mastery.get(hoveredBoneId) : undefined
  const hideHover = studyMode && !studyRevealed && studyAnswerMode !== 'locate'
  const showHover = Boolean(hoverName && hoveredBoneId !== selectedBoneId && !hideHover)

  return (
    <div
      ref={container}
      data-model-state={modelState}
      className={`relative min-h-0 min-w-0 flex-1 bg-background [&:fullscreen]:h-screen [&:fullscreen]:w-screen ${
        hoveredBoneId ? '[&_canvas]:cursor-pointer' : ''
      }`}
    >
      <p id="viewer-desc" className="sr-only">
        Interactive 3D skeleton. Drag to rotate, scroll to zoom, and click a bone. The same structures are listed in the
        anatomy navigator.
      </p>
      <ModelErrorBoundary resetKey={retryKey}>
        <Suspense fallback={null}>
          <AnatomyScene />
        </Suspense>
      </ModelErrorBoundary>
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_center,transparent_42%,rgb(0_0_0/0.42)_100%)]" />
      {modelState === 'loading' ? (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <div className="w-56 rounded-lg border bg-card/80 px-3 py-2 text-sm text-muted-foreground backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <Spinner />
              Preparing the skeleton…
            </div>
            <div className="mt-2 h-px overflow-hidden bg-border">
              <div className="atlas-load h-px w-1/3 bg-primary" />
            </div>
          </div>
        </div>
      ) : null}
      {modelState === 'error' ? (
        <div className="absolute inset-0 z-10 grid place-items-center px-6">
          <Empty className="max-w-sm rounded-lg border border-solid bg-card">
            <EmptyHeader>
              <EmptyTitle className="text-lg">Unable to load the 3D skeleton.</EmptyTitle>
              <EmptyDescription className="text-sm leading-6">
                You can still explore the anatomy database using the navigator.
              </EmptyDescription>
            </EmptyHeader>
            <Button type="button" onClick={retryModel}>
              Retry
            </Button>
          </Empty>
        </div>
      ) : null}
      {showHover ? (
        <div className="pointer-events-none absolute top-4 left-4 z-10 rounded-lg border bg-card/92 px-2.5 py-1 text-[13px]">
          {hoverName}
          {look === 'mastery' ? (
            <span className="ml-2 font-mono text-[11px] text-muted-foreground">
              {hoverRecall === undefined ? 'not studied' : `${Math.round(hoverRecall * 100)}% recall`}
            </span>
          ) : null}
        </div>
      ) : null}
      {modelState === 'ready' && !hasSelected ? (
        <p className="pointer-events-none absolute bottom-28 left-4 z-10 font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
          Select a bone
        </p>
      ) : null}
      {modelState === 'ready' ? <MasteryLegend /> : null}
      {modelState !== 'error' ? <ViewerControls container={container} /> : null}
      <StudyCard />
      <WalkCard />
    </div>
  )
}
