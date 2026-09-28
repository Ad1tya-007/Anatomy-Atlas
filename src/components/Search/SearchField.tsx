import { useAnatomyStore } from '@/store/anatomyStore'
import { searchAnatomy, type SearchResult } from '@/utils/search'
import { Search, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

export function SearchField() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputId = useId()
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const selectBone = useAnatomyStore((state) => state.selectBone)
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
    else if (result.boneId) selectBone(result.boneId, { landmarkId: result.landmarkId ?? null })
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={rootRef} className="relative w-full">
      <label htmlFor={inputId} className="sr-only">
        Search bones
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
      <input
        id={inputId}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        value={query}
        placeholder="Search bones..."
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
        className="h-9 w-full rounded-md border border-line bg-bg/70 pr-8 pl-9 text-[14px] text-text outline-none placeholder:text-faint focus:border-accent/70"
      />
      {query ? (
        <button
          type="button"
          className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-muted hover:text-text"
          aria-label="Clear search"
          onClick={() => {
            setQuery('')
            setOpen(false)
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
      {open && query.trim() ? (
        <div
          id={listId}
          role="listbox"
          className="absolute top-[calc(100%+6px)] z-40 max-h-80 w-full overflow-auto rounded-md border border-line bg-panel py-1 shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
        >
          {results.length === 0 ? (
            <p className="px-3 py-3 text-[13px] leading-5 text-muted">
              No anatomy structures found.
              <span className="mt-1 block text-faint">Try searching for a bone, region, or landmark.</span>
            </p>
          ) : (
            results.map((result, index) => (
              <button
                key={result.id}
                type="button"
                role="option"
                aria-selected={index === active}
                className={`flex w-full flex-col items-start px-3 py-2 text-left ${
                  index === active ? 'bg-white/[0.05]' : 'hover:bg-white/[0.04]'
                }`}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(result)}
              >
                <span className="text-[14px] text-text">{result.title}</span>
                <span className="text-[12px] text-muted">{result.subtitle}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
