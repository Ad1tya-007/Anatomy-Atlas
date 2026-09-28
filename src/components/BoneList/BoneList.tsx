import { getBone } from '@/data/bones'
import { navRegions } from '@/data/regions'
import { useAnatomyStore } from '@/store/anatomyStore'
import type { NavEntry } from '@/types/anatomy'
import { cn } from '@/utils/cn'
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
  const studyMode = useAnatomyStore((state) => state.studyMode)
  const studyRevealed = useAnatomyStore((state) => state.studyRevealed)
  const classification = useAnatomyStore((state) => state.classification)
  const selectBone = useAnatomyStore((state) => state.selectBone)
  const [open, setOpen] = useState(depth < 1)
  const hideAnswer = studyMode && !studyRevealed
  const active = !hideAnswer && entryActive(entry, selectedBoneId, selectedLandmarkId)
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
    <div className={cn(dimmed && 'opacity-45')}>
      <div className="flex items-center gap-1 pr-1" style={{ paddingLeft: `${8 + depth * 12}px` }}>
        {entry.children ? (
          <button
            type="button"
            className="grid h-7 w-6 shrink-0 place-items-center rounded text-muted hover:text-text"
            aria-expanded={open}
            aria-label={`${open ? 'Collapse' : 'Expand'} ${entry.label}`}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="w-6 shrink-0" />
        )}
        <button
          type="button"
          className={cn(
            'flex h-8 min-w-0 flex-1 items-center rounded-md px-2 text-left text-[13.5px] transition-colors',
            active ? 'bg-accent/12 text-text' : 'text-text/90 hover:bg-white/[0.04]',
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
          <span className={cn('truncate', active && 'font-medium')}>{entry.label}</span>
          {active && !paired ? <span className="sr-only"> selected</span> : null}
        </button>
        {paired ? (
          <span className="flex shrink-0 gap-0.5">
            {(['L', 'R'] as const).map((label, index) => {
              const id = entry.bones[index]
              const pressed = !hideAnswer && selectedBoneId === id && (!entry.landmarkSuffix || selectedLandmarkId === `${id}_${entry.landmarkSuffix}`)
              return (
                <button
                  key={label}
                  type="button"
                  aria-label={`${label === 'L' ? 'Left' : 'Right'} ${entry.label}`}
                  aria-pressed={pressed}
                  className={cn(
                    'grid h-7 w-7 place-items-center rounded text-[11px] font-medium',
                    pressed ? 'bg-accent text-accent-ink' : 'text-muted hover:bg-white/[0.06] hover:text-text',
                  )}
                  onClick={() => choose(id)}
                >
                  {label}
                </button>
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
    <div className="pb-4">
      {navRegions.map((region) => {
        const closed = collapsed[region.id] === true
        return (
          <section key={region.id} className="mt-3" aria-labelledby={`region-${region.id}`}>
            <div className="flex items-center px-2">
              <button
                type="button"
                className="grid h-7 w-6 place-items-center text-muted hover:text-text"
                aria-expanded={!closed}
                aria-label={`${closed ? 'Expand' : 'Collapse'} ${region.label}`}
                onClick={() => setCollapsed((state) => ({ ...state, [region.id]: !closed }))}
              >
                {closed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              <button
                id={`region-${region.id}`}
                type="button"
                className={cn(
                  'h-7 flex-1 rounded px-1 text-left text-[11px] font-medium tracking-[0.14em] uppercase',
                  activeRegion === region.id ? 'text-accent' : 'text-faint hover:text-muted',
                )}
                onClick={() => {
                  setCollapsed((state) => ({ ...state, [region.id]: false }))
                  frameRegion(region.id)
                }}
              >
                {region.label}
              </button>
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
