import { Button } from '@/components/ui/button'
import { getBone } from '@/data/bones'
import { navRegions } from '@/data/regions'
import { useAnatomyStore } from '@/store/anatomyStore'
import type { NavEntry } from '@/types/anatomy'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'

function entryActive(entry: NavEntry, selectedId: string | null, landmarkId: string | null): boolean {
  if (!selectedId) return false
  if (entry.landmarkSuffix) {
    return entry.bones.includes(selectedId) && landmarkId === `${selectedId}_${entry.landmarkSuffix}`
  }
  if (entry.bones.includes(selectedId)) return true
  return entry.children?.some((child) => entryActive(child, selectedId, landmarkId)) ?? false
}

function BoneRow({ entry, depth }: { entry: NavEntry; depth: number }) {
  const selectedBoneId = useAnatomyStore((state) => state.selectedBoneId)
  const selectedLandmarkId = useAnatomyStore((state) => state.selectedLandmarkId)
  const selectedJointId = useAnatomyStore((state) => state.selectedJointId)
  const studyMode = useAnatomyStore((state) => state.studyMode)
  const studyRevealed = useAnatomyStore((state) => state.studyRevealed)
  const classification = useAnatomyStore((state) => state.classification)
  const selectBone = useAnatomyStore((state) => state.selectBone)
  const [open, setOpen] = useState(depth < 1)
  const hideAnswer = studyMode && !studyRevealed
  const active = !hideAnswer && !selectedJointId && entryActive(entry, selectedBoneId, selectedLandmarkId)
  const paired = entry.bones.length === 2
  const folderOnly = entry.bones.length === 0
  const bone = getBone(entry.bones[0] ?? '')
  const dimmed =
    classification !== 'all' && bone !== undefined && bone.classification !== classification && !entry.landmarkSuffix

  const choose = (id: string | undefined) => {
    if (!id) return
    selectBone(id, { landmarkId: entry.landmarkSuffix ? `${id}_${entry.landmarkSuffix}` : null })
  }

  return (
    <div className={cn(dimmed && 'opacity-40')}>
      <div className="flex items-center gap-0.5 pr-1" style={{ paddingLeft: `${4 + depth * 12}px` }}>
        {entry.children ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-expanded={open}
            aria-label={`${open ? 'Collapse' : 'Expand'} ${entry.label}`}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <ChevronDown /> : <ChevronRight />}
          </Button>
        ) : (
          <span className="w-6 shrink-0" />
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 min-w-0 flex-1 justify-start px-2 font-normal',
            active && 'bg-primary/15 font-medium text-foreground hover:bg-primary/20',
          )}
          aria-current={active && !paired ? 'true' : undefined}
          onClick={() => {
            if (folderOnly) {
              setOpen((value) => !value)
              return
            }
            choose(entry.bones[0])
            if (entry.children) setOpen(true)
          }}
        >
          <span className="truncate">{entry.label}</span>
          {active && !paired ? <span className="sr-only"> selected</span> : null}
        </Button>
        {paired ? (
          <span className="flex shrink-0">
            {(['L', 'R'] as const).map((label, index) => {
              const id = entry.bones[index]
              const pressed =
                !hideAnswer &&
                !selectedJointId &&
                selectedBoneId === id &&
                (!entry.landmarkSuffix || selectedLandmarkId === `${id}_${entry.landmarkSuffix}`)
              return (
                <Button
                  key={label}
                  type="button"
                  size="icon-xs"
                  variant={pressed ? 'default' : 'ghost'}
                  aria-label={`${label === 'L' ? 'Left' : 'Right'} ${entry.label}`}
                  aria-pressed={pressed}
                  className="font-mono text-[10px]"
                  onClick={() => choose(id)}
                >
                  {label}
                </Button>
              )
            })}
          </span>
        ) : null}
      </div>
      {open && entry.children ? (
        <div className="pb-1">
          {entry.children.map((child) => (
            <BoneRow key={`${child.label}:${child.landmarkSuffix ?? ''}:${child.bones.join()}`} entry={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function BoneList() {
  const activeRegion = useAnatomyStore((state) => state.activeRegion)
  const frameRegion = useAnatomyStore((state) => state.frameRegion)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  return (
    <div className="py-2 pr-1 pb-4">
      {navRegions.map((region) => {
        const closed = collapsed[region.id] === true
        return (
          <section key={region.id} className="mt-2" aria-labelledby={`region-${region.id}`}>
            <div className="flex items-center px-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-expanded={!closed}
                aria-label={`${closed ? 'Expand' : 'Collapse'} ${region.label}`}
                onClick={() => setCollapsed((state) => ({ ...state, [region.id]: !closed }))}
              >
                {closed ? <ChevronRight /> : <ChevronDown />}
              </Button>
              <Button
                id={`region-${region.id}`}
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  'kicker h-7 flex-1 justify-start px-1 hover:bg-transparent',
                  activeRegion === region.id ? 'text-primary!' : 'text-muted-foreground',
                )}
                onClick={() => {
                  setCollapsed((state) => ({ ...state, [region.id]: false }))
                  frameRegion(region.id)
                }}
              >
                {region.label}
              </Button>
            </div>
            {closed ? null : (
              <div className="mt-0.5">
                {region.entries.map((entry) => (
                  <BoneRow key={entry.label} entry={entry} depth={0} />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
