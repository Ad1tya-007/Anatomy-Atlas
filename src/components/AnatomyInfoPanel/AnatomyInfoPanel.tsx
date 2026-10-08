import { LandmarkList } from '@/components/LandmarkList/LandmarkList'
import { StudyPanelPrompt } from '@/components/StudyMode/StudyMode'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Card, CardContent } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { contralateralId, getBone } from '@/data/bones'
import { getJoint, isPairedJoint, jointLandmarkIds, jointsForBone, resolveJointBones } from '@/data/joints'
import { getLandmark } from '@/data/landmarks'
import { CLASS_LABEL, REGION_LABEL } from '@/data/labels'
import { useAnatomyStore } from '@/store/anatomyStore'
import type { Bone, Joint } from '@/types/anatomy'
import { cn } from '@/lib/utils'
import { Bone as BoneIcon } from 'lucide-react'

function memberLabel(bone: Bone, members: Bone[]): string {
  const shared = members.filter((item) => item.name === bone.name).length > 1
  return shared ? bone.displayName : bone.name
}

function RecordButton({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="h-auto w-full justify-start gap-2 px-2 py-2 text-left text-sm font-normal whitespace-normal"
      onClick={onClick}
    >
      <span className="size-1.5 shrink-0 bg-muted-foreground" aria-hidden />
      {children}
    </Button>
  )
}

function IsolateAction() {
  const isolated = useAnatomyStore((state) => state.isolated)
  const toggleIsolate = useAnatomyStore((state) => state.toggleIsolate)
  const clearIsolation = useAnatomyStore((state) => state.clearIsolation)
  return isolated ? (
    <Button type="button" onClick={clearIsolation}>
      Show full skeleton
    </Button>
  ) : (
    <Button type="button" variant="outline" onClick={toggleIsolate}>
      Isolate
    </Button>
  )
}

function JointPanel({ joint }: { joint: Joint }) {
  const jointSide = useAnatomyStore((state) => state.jointSide)
  const selectBone = useAnatomyStore((state) => state.selectBone)
  const selectLandmark = useAnatomyStore((state) => state.selectLandmark)
  const selectJoint = useAnatomyStore((state) => state.selectJoint)
  const paired = isPairedJoint(joint)
  const side = jointSide ?? 'left'
  const memberIds = resolveJointBones(joint, paired ? side : 'left')
  const members = memberIds.map((id) => getBone(id)).filter((bone): bone is Bone => Boolean(bone))
  const landmarks = jointLandmarkIds(joint, paired ? side : 'left')
    .map((id) => getLandmark(id))
    .filter((record) => record !== undefined)

  return (
    <article key={`${joint.id}:${side}`} className="atlas-in">
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline">{REGION_LABEL[joint.region]}</Badge>
        {paired ? <Badge variant="secondary">{side === 'left' ? 'Left' : 'Right'}</Badge> : null}
        <Badge variant="secondary">Joint</Badge>
      </div>
      <h2 className="mt-3 text-[1.75rem] leading-none font-medium tracking-tight">{joint.name}</h2>
      {paired ? (
        <ButtonGroup className="mt-3" aria-label="Side">
          {(['left', 'right'] as const).map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={side === option ? 'default' : 'outline'}
              aria-pressed={side === option}
              onClick={() => selectJoint(joint.id, option)}
            >
              {option === 'left' ? 'Left' : 'Right'}
            </Button>
          ))}
        </ButtonGroup>
      ) : null}
      <p className="mt-4 text-sm leading-6 text-foreground/90">{joint.description}</p>
      <Separator className="my-5" />
      <section>
        <h3 className="kicker">Bones</h3>
        <ul className="mt-2">
          {members.map((bone) => (
            <li key={bone.id}>
              <RecordButton onClick={() => selectBone(bone.id)}>{memberLabel(bone, members)}</RecordButton>
            </li>
          ))}
        </ul>
      </section>
      {joint.movements.length > 0 ? (
        <section className="mt-4">
          <h3 className="kicker">Movements</h3>
          <p className="mt-2 text-sm leading-6 text-foreground/90">{joint.movements.join(', ')}</p>
        </section>
      ) : null}
      {landmarks.length > 0 ? (
        <section className="mt-4">
          <h3 className="kicker">Landmarks</h3>
          <ul className="mt-2">
            {landmarks.map((record) => (
              <li key={record.landmark.id}>
                <RecordButton onClick={() => selectLandmark(record.landmark.id)}>{record.landmark.name}</RecordButton>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="mt-6">
        <IsolateAction />
      </div>
    </article>
  )
}

export function AnatomyInfoPanel({ className, id }: { className?: string; id?: string }) {
  const selectedBoneId = useAnatomyStore((state) => state.selectedBoneId)
  const selectedLandmarkId = useAnatomyStore((state) => state.selectedLandmarkId)
  const selectedJointId = useAnatomyStore((state) => state.selectedJointId)
  const compareSides = useAnatomyStore((state) => state.compareSides)
  const studyMode = useAnatomyStore((state) => state.studyMode)
  const studyRevealed = useAnatomyStore((state) => state.studyRevealed)
  const selectBone = useAnatomyStore((state) => state.selectBone)
  const selectJoint = useAnatomyStore((state) => state.selectJoint)
  const toggleCompare = useAnatomyStore((state) => state.toggleCompare)
  const bone = getBone(selectedBoneId)
  const landmark = getLandmark(selectedLandmarkId)
  const joint = getJoint(selectedJointId)
  const otherSide = selectedBoneId ? contralateralId(selectedBoneId) : null
  const partner = otherSide ? getBone(otherSide) : null
  const canCompare = Boolean(bone && partner && bone.side !== 'midline' && !bone.compositeOf?.length && !joint)
  const relatedJoints = bone && !joint ? jointsForBone(bone.id) : []

  return (
    <aside id={id} tabIndex={-1} className={cn('h-full min-h-0 flex-col bg-card focus:outline-none', className)}>
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-5 py-5">
          {studyMode && !studyRevealed ? (
            <StudyPanelPrompt />
          ) : joint ? (
            <JointPanel joint={joint} />
          ) : !bone ? (
            <Empty className="border-0 px-0 pt-10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BoneIcon />
                </EmptyMedia>
                <EmptyTitle className="text-lg">Explore the skeleton</EmptyTitle>
                <EmptyDescription className="text-sm leading-6">
                  Select a bone in the 3D model, or choose a structure from the navigator.
                </EmptyDescription>
              </EmptyHeader>
              <p className="kicker">J search · click a bone · study</p>
            </Empty>
          ) : (
            <article key={bone.id} className="atlas-in">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">{REGION_LABEL[bone.region]}</Badge>
                {bone.side !== 'midline' ? (
                  <Badge variant="secondary">{bone.side === 'left' ? 'Left' : 'Right'}</Badge>
                ) : (
                  <Badge variant="secondary">Midline</Badge>
                )}
                <Badge variant="secondary">{CLASS_LABEL[bone.classification]}</Badge>
              </div>
              <h2 className="mt-3 text-[1.75rem] leading-none font-medium tracking-tight">{bone.name}</h2>
              {bone.side !== 'midline' ? <p className="mt-2 text-sm text-muted-foreground">{bone.displayName}</p> : null}
              {canCompare ? (
                <ButtonGroup className="mt-3" aria-label="Side">
                  {(['left', 'right'] as const).map((side) => {
                    const sideId = side === bone.side ? bone.id : otherSide
                    const pressed = bone.side === side
                    if (!sideId) return null
                    return (
                      <Button
                        key={side}
                        type="button"
                        size="sm"
                        variant={pressed ? 'default' : 'outline'}
                        aria-pressed={pressed}
                        onClick={() => selectBone(sideId)}
                      >
                        {side === 'left' ? 'Left' : 'Right'}
                      </Button>
                    )
                  })}
                  <Button
                    type="button"
                    size="sm"
                    variant={compareSides ? 'default' : 'outline'}
                    aria-pressed={compareSides}
                    onClick={toggleCompare}
                  >
                    Compare
                  </Button>
                </ButtonGroup>
              ) : null}
              {compareSides ? (
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  The left and right bones are paired. Landmarks on this side match the opposite side.
                </p>
              ) : null}
              <p className="mt-4 text-sm leading-6 text-foreground/90">{bone.description}</p>
              <Separator className="my-5" />
              <dl className="grid gap-4">
                <div>
                  <dt className="kicker">Articulations</dt>
                  <dd className="mt-2">
                    <ul className="space-y-1">
                      {bone.articulations.map((item) => (
                        <li key={item} className="text-sm leading-5 text-foreground/90">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              </dl>
              {relatedJoints.length > 0 ? (
                <section className="mt-4">
                  <h3 className="kicker">Joints</h3>
                  <ul className="mt-2">
                    {relatedJoints.map((item) => (
                      <li key={item.id}>
                        <RecordButton onClick={() => selectJoint(item.id, bone.side === 'right' ? 'right' : 'left')}>
                          {item.name}
                        </RecordButton>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {bone.partOf ? (
                <Button type="button" variant="link" className="mt-4 h-auto px-0" onClick={() => selectBone(bone.partOf!)}>
                  Part of {getBone(bone.partOf)?.name}
                </Button>
              ) : null}
              {bone.compositeOf?.length ? (
                <div className="mt-4">
                  <p className="kicker">Included bones</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {bone.compositeOf.map((partId) => (
                      <Button key={partId} type="button" variant="outline" size="sm" onClick={() => selectBone(partId)}>
                        {getBone(partId)?.displayName ?? partId}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
              {landmark && landmark.boneId === bone.id ? (
                <Card size="sm" className="mt-5 bg-primary/8 ring-primary/40">
                  <CardContent className="grid gap-2">
                    <h3 className="kicker text-primary!">{landmark.landmark.name}</h3>
                    <p className="text-sm leading-6 text-foreground/90">{landmark.landmark.description}</p>
                    {landmark.landmark.significance ? (
                      <p className="text-sm leading-5 text-muted-foreground">{landmark.landmark.significance}</p>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}
              <LandmarkList landmarks={bone.landmarks} boneId={bone.id} />
              <div className="mt-6">
                <IsolateAction />
              </div>
            </article>
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
