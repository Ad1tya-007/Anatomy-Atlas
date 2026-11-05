import { setMasteryValues } from '@/components/three/masteryPaint'
import { useMasteryByBone } from '@/features/srs/useMastery'
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'

/** Keeps the mastery look's per-bone colors in step with the learner's progress. */
export function MasteryPaint() {
  const mastery = useMasteryByBone()
  const invalidate = useThree((state) => state.invalidate)
  useEffect(() => {
    setMasteryValues(mastery)
    invalidate()
  }, [invalidate, mastery])
  return null
}
