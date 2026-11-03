import { useSrsStore } from '@/features/srs/srsStore'
import { onStudyAnswer, useAnatomyStore } from '@/store/anatomyStore'
import { useEffect } from 'react'

/** Loads saved progress and records every answered study question as a review. */
export function useSpacedRepetition(): void {
  useEffect(() => {
    void useSrsStore.getState().load()
    const stopAnswers = onStudyAnswer((answer) => {
      void useSrsStore.getState().record(answer)
    })
    // A review session opened before progress finished loading sees an empty queue; ask again once it loads.
    const stopReady = useSrsStore.subscribe((state, previous) => {
      if (state.status !== 'ready' || previous.status === 'ready') return
      const study = useAnatomyStore.getState()
      if (study.studyMode && study.studyQueue === 'review' && study.studyCaughtUp) study.nextStudy()
    })
    return () => {
      stopAnswers()
      stopReady()
    }
  }, [])
}
