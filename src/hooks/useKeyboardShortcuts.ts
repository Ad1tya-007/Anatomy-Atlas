import { useAnatomyStore } from '@/store/anatomyStore'
import { useEffect } from 'react'

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLElement) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      }
      const store = useAnatomyStore.getState()
      if (event.key === 'Escape') {
        if (store.helpOpen) {
          store.setHelpOpen(false)
          return
        }
        const drawerOpen =
          store.mobilePanel !== 'none' && window.matchMedia('(max-width: 1023px)').matches
        if (drawerOpen) {
          store.setMobilePanel('none')
          return
        }
        if (store.studyMode) {
          store.exitStudy()
          return
        }
        store.clearSelection()
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const key = event.key.toLowerCase()
      if (key === 'r') store.requestPreset('default')
      else if (key === 'f') store.requestPreset('front')
      else if (key === 'b') store.requestPreset('back')
      else if (key === 'l') store.toggleLandmarks()
      else if (key === 'i') store.toggleIsolate()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
