import { requestSync, startAccountIfNeeded } from '@/features/sync/account'
import { useAccountStore } from '@/features/sync/accountStore'
import { onStudyAnswer } from '@/store/anatomyStore'
import { useEffect } from 'react'

/** Answers within this window go up in one request. */
const ANSWER_DEBOUNCE_MS = 2_000
const PERIODIC_SYNC_MS = 5 * 60_000

/** Restores a signed-in session, then syncs after answers, on reconnect, when the tab hides, and every few minutes. */
export function useSync(): void {
  const status = useAccountStore((state) => state.status)

  useEffect(() => {
    startAccountIfNeeded()
  }, [])

  useEffect(() => {
    if (status !== 'signedIn') return
    let timer: ReturnType<typeof setTimeout> | null = null
    const sync = () => void requestSync()
    const stopAnswers = onStudyAnswer(() => {
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        sync()
      }, ANSWER_DEBOUNCE_MS)
    })
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') sync()
    }
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') sync()
    }, PERIODIC_SYNC_MS)
    window.addEventListener('online', sync)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stopAnswers()
      if (timer !== null) clearTimeout(timer)
      clearInterval(interval)
      window.removeEventListener('online', sync)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [status])
}
