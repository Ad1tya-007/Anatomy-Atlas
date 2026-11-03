import { pickReview } from '@/features/srs/review'
import { useSrsStore } from '@/features/srs/srsStore'
import { useNow } from '@/features/srs/useMastery'
import { useAnatomyStore } from '@/store/anatomyStore'
import { useMemo } from 'react'

/** Cards due in the current study scope and question type. */
export function useDueCount(): number {
  const cards = useSrsStore((state) => state.cards)
  const events = useSrsStore((state) => state.events)
  const studyKind = useAnatomyStore((state) => state.studyKind)
  const studyScope = useAnatomyStore((state) => state.studyScope)
  const studyRegionId = useAnatomyStore((state) => state.studyRegionId)
  const studyClassification = useAnatomyStore((state) => state.studyClassification)
  const studyAnswerMode = useAnatomyStore((state) => state.studyAnswerMode)
  const activeRegion = useAnatomyStore((state) => state.activeRegion)
  const now = useNow()
  return useMemo(
    () =>
      pickReview(
        { studyScope, studyRegionId, studyClassification, studyAnswerMode, activeRegion },
        studyKind,
        { cards, events },
        null,
        now,
      ).remaining,
    [activeRegion, cards, events, now, studyAnswerMode, studyClassification, studyKind, studyRegionId, studyScope],
  )
}
