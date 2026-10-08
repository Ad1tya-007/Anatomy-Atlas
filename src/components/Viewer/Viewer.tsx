import { AnatomyScene } from '@/components/three/AnatomyScene/AnatomyScene'
import { ModelErrorBoundary } from '@/components/ModelErrorBoundary'
import { StudyCard } from '@/components/StudyMode/StudyMode'
import { WalkCard } from '@/components/WalkCard/WalkCard'
import { ViewerControls } from '@/components/ViewerControls/ViewerControls'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
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
      className={`relative min-h-0 min-w-0 flex-1 bg-background [&:fullscreen]:h-screen [&:fullscreen]:w-screen ${
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
          <div className="flex items-center gap-2 border bg-card/90 px-3 py-2 text-sm text-muted-foreground">
            <Spinner />
            Preparing the skeleton…
          </div>
        </div>
      ) : null}
      {modelState === 'error' ? (
        <div className="absolute inset-0 grid place-items-center px-6">
          <Empty className="max-w-sm border bg-card">
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
        <Badge variant="outline" className="pointer-events-none absolute top-4 left-4 h-7 bg-card/90 px-3 text-sm">
          {hoverName}
        </Badge>
      ) : null}
      {modelState !== 'error' ? <ViewerControls container={container} /> : null}
      <StudyCard />
      <WalkCard />
    </div>
  )
}
