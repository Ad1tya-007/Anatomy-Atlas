import { masteryByBone } from '@/features/srs/mastery'
import { useSrsStore } from '@/features/srs/srsStore'
import { useEffect, useMemo, useState } from 'react'

/** The current time, refreshed every `intervalMs` so recall estimates decay on screen. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

const EMPTY = new Map<string, number>()

export function useMasteryByBone(): ReadonlyMap<string, number> {
  const cards = useSrsStore((state) => state.cards)
  const scheduler = useSrsStore((state) => state.scheduler)
  const now = useNow()
  return useMemo(() => (scheduler ? masteryByBone(scheduler, cards, now) : EMPTY), [cards, now, scheduler])
}
