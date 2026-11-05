import { createDprMonitor, DPR_STEPS, maxDprStep, sampleFrame } from '@/utils/adaptiveDpr'
import { describe, expect, it } from 'vitest'

function feed(monitor: ReturnType<typeof createDprMonitor>, deltaMs: number, frames: number, maxStep = 3) {
  const changes: number[] = []
  for (let index = 0; index < frames; index++) {
    const next = sampleFrame(monitor, deltaMs, maxStep)
    if (next !== null) changes.push(next)
  }
  return changes
}

describe('adaptive dpr', () => {
  it('caps the starting step at the device pixel ratio', () => {
    expect(DPR_STEPS[maxDprStep(1)]).toBe(1)
    expect(DPR_STEPS[maxDprStep(1.5)]).toBe(1.5)
    expect(DPR_STEPS[maxDprStep(3)]).toBe(1.75)
    expect(maxDprStep(0.5)).toBe(0)
  })

  it('steps down one level per slow window', () => {
    const monitor = createDprMonitor(2)
    expect(feed(monitor, 40, 60)).toEqual([2, 1])
  })

  it('ignores idle gaps between demand frames', () => {
    const monitor = createDprMonitor(2)
    expect(feed(monitor, 800, 200)).toEqual([])
    expect(monitor.samples).toHaveLength(0)
  })

  it('needs several fast windows before stepping back up, and never past the device cap', () => {
    const monitor = createDprMonitor(2)
    feed(monitor, 40, 30)
    expect(monitor.step).toBe(2)
    expect(feed(monitor, 8, 30 * 5)).toEqual([])
    expect(feed(monitor, 8, 30)).toEqual([3])
    expect(feed(monitor, 8, 30 * 12)).toEqual([])
  })

  it('stops adjusting after a few changes so it cannot oscillate forever', () => {
    const monitor = createDprMonitor(2)
    const changes = [
      ...feed(monitor, 40, 30),
      ...feed(monitor, 8, 180),
      ...feed(monitor, 40, 30),
      ...feed(monitor, 8, 180),
    ]
    expect(changes).toEqual([2, 3, 2, 3])
    expect(feed(monitor, 40, 300)).toEqual([])
  })
})
