import { BoneList } from '@/components/BoneList/BoneList'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toggle } from '@/components/ui/toggle'
import { isPairedJoint, joints } from '@/data/joints'
import { CLASS_LABEL, CLASS_OPTIONS } from '@/data/labels'
import { walks } from '@/data/walks'
import { useAnatomyStore } from '@/store/anatomyStore'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

export function AnatomySidebar({ className }: { className?: string }) {
  const classification = useAnatomyStore((state) => state.classification)
  const setClassification = useAnatomyStore((state) => state.setClassification)
  const selectedJointId = useAnatomyStore((state) => state.selectedJointId)
  const selectedBoneId = useAnatomyStore((state) => state.selectedBoneId)
  const walkId = useAnatomyStore((state) => state.walkId)
  const [tab, setTab] = useState('bones')

  useEffect(() => {
    if (walkId) setTab('walks')
    else if (selectedJointId) setTab('joints')
    else if (selectedBoneId) setTab('bones')
  }, [walkId, selectedJointId, selectedBoneId])

  return (
    <aside className={cn('h-full min-h-0 flex-col border-r bg-sidebar text-sidebar-foreground', className)}>
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="kicker">Navigator</h2>
          <Badge variant="outline" className="font-mono">
            {classification === 'all' ? 'All classes' : CLASS_LABEL[classification]}
          </Badge>
        </div>
        <fieldset className="mt-3">
          <legend className="text-xs text-muted-foreground">Bone classification</legend>
          <div className="mt-2 grid grid-cols-3 gap-1">
            {CLASS_OPTIONS.map((option) => {
              const checked = classification === option.value
              return (
                <Toggle
                  key={option.value}
                  size="sm"
                  variant="outline"
                  pressed={checked}
                  className={cn('h-7 w-full px-1 font-normal', checked && 'border-primary bg-primary/15 text-primary')}
                  onPressedChange={(pressed) => {
                    if (pressed) setClassification(option.value)
                  }}
                >
                  {option.label}
                </Toggle>
              )
            })}
          </div>
        </fieldset>
      </div>
      <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1 gap-0">
        <div className="border-b px-3 py-2">
          <TabsList className="grid h-8 w-full grid-cols-3">
            <TabsTrigger value="bones">Bones</TabsTrigger>
            <TabsTrigger value="joints">
              Joints
              {selectedJointId ? <span className="size-1.5 bg-primary" aria-hidden /> : null}
            </TabsTrigger>
            <TabsTrigger value="walks">
              Walks
              {walkId ? <span className="size-1.5 bg-primary" aria-hidden /> : null}
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="bones" className="min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <nav aria-label="Anatomy navigator">
              <BoneList />
            </nav>
          </ScrollArea>
        </TabsContent>
        <TabsContent value="joints" className="min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <JointNav />
          </ScrollArea>
        </TabsContent>
        <TabsContent value="walks" className="min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <WalkNav />
          </ScrollArea>
        </TabsContent>
      </Tabs>
      <p className="border-t px-4 py-3 text-[11px] leading-4 text-muted-foreground">
        Model: Open3D project, CC BY-SA. Left and right are the skeleton’s own sides.
      </p>
    </aside>
  )
}

function JointNav() {
  const selectedJointId = useAnatomyStore((state) => state.selectedJointId)
  const jointSide = useAnatomyStore((state) => state.jointSide)
  const studyMode = useAnatomyStore((state) => state.studyMode)
  const studyRevealed = useAnatomyStore((state) => state.studyRevealed)
  const selectJoint = useAnatomyStore((state) => state.selectJoint)
  const hideAnswer = studyMode && !studyRevealed

  return (
    <section className="px-2 py-2" aria-labelledby="joints-heading">
      <h3 id="joints-heading" className="kicker px-2 pt-1 pb-2">
        Joints
      </h3>
      {joints.map((joint) => {
        const paired = isPairedJoint(joint)
        const active = !hideAnswer && selectedJointId === joint.id
        return (
          <div key={joint.id} className="flex items-center gap-1 pr-1">
            <button
              type="button"
              className={cn(
                'flex h-8 min-w-0 flex-1 items-center px-2 text-left text-[13px]',
                active ? 'bg-primary/15 font-medium text-foreground' : 'text-foreground/90 hover:bg-muted',
              )}
              aria-current={active && !paired ? 'true' : undefined}
              onClick={() => selectJoint(joint.id, paired ? 'left' : undefined)}
            >
              <span className="truncate">{joint.name}</span>
              {active && !paired ? <span className="sr-only"> selected</span> : null}
            </button>
            {paired ? (
              <span className="flex shrink-0">
                {(['L', 'R'] as const).map((label) => {
                  const side = label === 'L' ? 'left' : 'right'
                  const pressed = active && jointSide === side
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-label={`${label === 'L' ? 'Left' : 'Right'} ${joint.name}`}
                      aria-pressed={pressed}
                      className={cn(
                        'grid size-7 place-items-center font-mono text-[10px] font-medium',
                        pressed ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                      onClick={() => selectJoint(joint.id, side)}
                    >
                      {label}
                    </button>
                  )
                })}
              </span>
            ) : null}
          </div>
        )
      })}
    </section>
  )
}

function WalkNav() {
  const walkId = useAnatomyStore((state) => state.walkId)
  const startWalk = useAnatomyStore((state) => state.startWalk)

  return (
    <section className="px-2 py-2" aria-labelledby="walks-heading">
      <h3 id="walks-heading" className="kicker px-2 pt-1 pb-2">
        Guided walks
      </h3>
      {walks.map((walk) => {
        const active = walkId === walk.id
        return (
          <button
            key={walk.id}
            type="button"
            className={cn(
              'flex h-8 w-full items-center px-2 text-left text-[13px]',
              active ? 'bg-primary/15 font-medium text-foreground' : 'text-foreground/90 hover:bg-muted',
            )}
            aria-current={active ? 'true' : undefined}
            onClick={() => startWalk(walk.id)}
          >
            <span className="truncate">{walk.title}</span>
            {active ? <span className="sr-only"> selected</span> : null}
          </button>
        )
      })}
    </section>
  )
}
