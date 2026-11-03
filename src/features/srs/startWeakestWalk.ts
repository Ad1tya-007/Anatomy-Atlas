import { setGeneratedWalk } from '@/data/walks'
import { buildWeakestWalk } from '@/features/srs/weakestWalk'
import { useAnatomyStore } from '@/store/anatomyStore'

/** Builds the weakest-areas walk from current mastery and starts it. Returns false when nothing has been studied. */
export function startWeakestWalk(mastery: ReadonlyMap<string, number>): boolean {
  const walk = buildWeakestWalk(mastery)
  if (!walk) return false
  setGeneratedWalk(walk)
  useAnatomyStore.getState().startWalk(walk.id)
  return true
}
