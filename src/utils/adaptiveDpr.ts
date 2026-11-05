/**
 * Frame-time driven resolution scaling for an on-demand render loop. drei's PerformanceMonitor counts frames per
 * wall-clock window, which reads idle gaps between demand frames as low fps; this only times back-to-back frames.
 */

export const DPR_STEPS = [1, 1.25, 1.5, 1.75] as const

/** Gaps longer than this are idle time between demand frames, not slow frames. */
const CONTINUOUS_MS = 100
const WINDOW = 30
const SLOW_MS = 1000 / 40
const FAST_MS = 1000 / 57
const FAST_WINDOWS_TO_RAISE = 6
const MAX_CHANGES = 4

export interface DprMonitor {
  step: number
  samples: number[]
  fastWindows: number
  changes: number
}

export function maxDprStep(devicePixelRatio: number): number {
  let step = 0
  for (const [index, value] of DPR_STEPS.entries()) if (value <= Math.max(1, devicePixelRatio)) step = index
  return step
}

export function createDprMonitor(devicePixelRatio: number): DprMonitor {
  return { step: maxDprStep(devicePixelRatio), samples: [], fastWindows: 0, changes: 0 }
}

/** Feeds one frame delta in milliseconds; returns the new step when the resolution should change. */
export function sampleFrame(monitor: DprMonitor, deltaMs: number, maxStep: number): number | null {
  if (deltaMs <= 0 || deltaMs > CONTINUOUS_MS || monitor.changes >= MAX_CHANGES) return null
  monitor.samples.push(deltaMs)
  if (monitor.samples.length < WINDOW) return null
  const sorted = monitor.samples.toSorted((left, right) => left - right)
  const median = sorted[Math.floor(sorted.length / 2)]
  monitor.samples = []
  if (median > SLOW_MS && monitor.step > 0) {
    monitor.step -= 1
    monitor.fastWindows = 0
    monitor.changes += 1
    return monitor.step
  }
  if (median < FAST_MS && monitor.step < maxStep) {
    monitor.fastWindows += 1
    if (monitor.fastWindows < FAST_WINDOWS_TO_RAISE) return null
    monitor.step += 1
    monitor.fastWindows = 0
    monitor.changes += 1
    return monitor.step
  }
  monitor.fastWindows = 0
  return null
}
