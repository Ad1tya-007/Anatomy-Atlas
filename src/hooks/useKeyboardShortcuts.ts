import { useAnatomyStore } from '@/store/anatomyStore'
import { useEffect } from 'react'

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLElement) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return
      }
      const store = useAnatomyStore.getState()
      if (event.key === 'Escape') {
        if (store.helpOpen) {
          event.preventDefault()
          event.stopPropagation()
          store.setHelpOpen(false)
          return
        }
        const drawerOpen =
          store.mobilePanel !== 'none' && window.matchMedia('(max-width: 1023px)').matches
        if (drawerOpen) {
          event.preventDefault()
          event.stopPropagation()
          store.setMobilePanel('none')
          return
        }
        if (store.walkId) {
          store.exitWalk()
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
      if (event.key === 'j' || event.key === 'J') {
        event.preventDefault()
        document.querySelector<HTMLInputElement>('[data-anatomy-search]')?.focus()
        return
      }
      if ((event.key === '[' || event.key === ']') && store.walkId) {
        event.preventDefault()
        store.stepWalk(event.key === ']' ? 1 : -1)
        return
      }
      if (event.key === '1') {
        store.setLook('atlas')
        return
      }
      if (event.key === '2') {
        store.setLook('ivory')
        return
      }
      if (event.key === '3') {
        store.setLook('radiograph')
        return
      }
      const key = event.key.toLowerCase()
      if (key === 'x') {
        const order = ['off', 'sagittal', 'coronal', 'transverse'] as const
        const index = order.indexOf(store.sectionAxis)
        store.setSectionAxis(order[(index + 1) % order.length] ?? 'off')
        return
      }
      if ((event.key === ',' || event.key === '.') && store.sectionAxis !== 'off') {
        event.preventDefault()
        store.setSectionAmount(store.sectionAmount + (event.key === ',' ? -0.05 : 0.05))
        return
      }
      if (key === 'e') {
        store.setSpread(store.spread < 0.01 ? 0.65 : 0)
        return
      }
      if (key === 'r') store.requestPreset('default')
      else if (key === 'f') store.requestPreset('front')
      else if (key === 'b') store.requestPreset('back')
      else if (key === 'l') store.toggleLandmarks()
      else if (key === 'i') store.toggleIsolate()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])
}
