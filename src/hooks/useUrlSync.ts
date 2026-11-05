import { useAnatomyStore } from '@/store/anatomyStore'
import { decodeView, encodeView, hasView, viewFromState } from '@/utils/urlState'
import { useEffect } from 'react'

const WRITE_DELAY_MS = 300

let restored = false

export function currentViewUrl(): string {
  const url = new URL(window.location.href)
  url.search = encodeView(viewFromState(useAnatomyStore.getState()))
  return url.toString()
}

/** Restores the view from the query string once the model is ready, then mirrors the view back into it. */
export function useUrlSync(): void {
  const modelState = useAnatomyStore((state) => state.modelState)

  useEffect(() => {
    if (modelState !== 'ready') return
    if (!restored) {
      restored = true
      const view = decodeView(window.location.search)
      if (hasView(view)) useAnatomyStore.getState().restoreView(view)
    }

    let timer: ReturnType<typeof setTimeout> | null = null
    let written = window.location.search.replace(/^\?/, '')
    const write = () => {
      timer = null
      const next = encodeView(viewFromState(useAnatomyStore.getState()))
      if (next === written) return
      written = next
      const url = new URL(window.location.href)
      url.search = next
      window.history.replaceState(window.history.state, '', url)
    }
    const unsubscribe = useAnatomyStore.subscribe(() => {
      if (timer === null) timer = setTimeout(write, WRITE_DELAY_MS)
    })
    return () => {
      unsubscribe()
      if (timer !== null) clearTimeout(timer)
    }
  }, [modelState])
}
