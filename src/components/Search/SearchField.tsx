import { Badge } from '@/components/ui/badge'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Kbd } from '@/components/ui/kbd'
import { useAnatomyStore } from '@/store/anatomyStore'
import { searchAnatomy, type SearchResult } from '@/utils/search'
import { Search, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

const KIND_LABEL: Record<SearchResult['kind'], string> = {
  bone: 'Bone',
  landmark: 'Landmark',
  region: 'Region',
  joint: 'Joint',
  walk: 'Walk',
}

export function SearchField() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputId = useId()
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const selectBone = useAnatomyStore((state) => state.selectBone)
  const selectJoint = useAnatomyStore((state) => state.selectJoint)
  const startWalk = useAnatomyStore((state) => state.startWalk)
  const frameRegion = useAnatomyStore((state) => state.frameRegion)
  const results = useMemo(() => searchAnatomy(query), [query])

  useEffect(() => {
    setActive(0)
  }, [query])

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    return () => window.removeEventListener('pointerdown', onPointer)
  }, [])

  const choose = (result: SearchResult) => {
    if (result.kind === 'region' && result.regionId) frameRegion(result.regionId)
    else if (result.kind === 'joint' && result.jointId) selectJoint(result.jointId)
    else if (result.kind === 'walk' && result.walkId) startWalk(result.walkId)
    else if (result.boneId) selectBone(result.boneId, { landmarkId: result.landmarkId ?? null })
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={rootRef} className="relative w-full">
      <label htmlFor={inputId} className="sr-only">
        Search bones, joints, landmarks, and walks
      </label>
      <InputGroup className="h-9 bg-background">
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          id={inputId}
          role="combobox"
          aria-expanded={open && query.trim().length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          value={query}
          data-anatomy-search=""
          placeholder="Search bones, joints, walks…"
          className="h-9 text-sm"
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setOpen(true)
              setActive((index) => Math.min(index + 1, Math.max(results.length - 1, 0)))
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActive((index) => Math.max(index - 1, 0))
            } else if (event.key === 'Enter' && results[active]) {
              event.preventDefault()
              choose(results[active]!)
            } else if (event.key === 'Escape') {
              setOpen(false)
              event.currentTarget.blur()
            }
          }}
        />
        <InputGroupAddon align="inline-end">
          {query ? (
            <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => { setQuery(''); setOpen(false) }}>
              <X />
            </InputGroupButton>
          ) : (
            <Kbd>J</Kbd>
          )}
        </InputGroupAddon>
      </InputGroup>
      {open && query.trim() ? (
        <div
          id={listId}
          role="listbox"
          className="absolute top-[calc(100%+6px)] z-40 max-h-80 w-full overflow-auto border bg-popover py-1 text-popover-foreground shadow-md"
        >
          {results.length === 0 ? (
            <p className="px-3 py-3 text-sm leading-5 text-muted-foreground">
              No anatomy structures found.
              <span className="mt-1 block text-xs">Try a bone, region, joint, landmark, or walk.</span>
            </p>
          ) : (
            results.map((result, index) => (
              <button
                key={result.id}
                type="button"
                role="option"
                aria-selected={index === active}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left ${
                  index === active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/70'
                }`}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(result)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">{result.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{result.subtitle}</span>
                </span>
                <Badge variant="outline" className="font-mono tracking-wide">
                  {KIND_LABEL[result.kind]}
                </Badge>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
