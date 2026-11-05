import {
  beginArrival,
  cancelArrival,
  lookPaint,
  motionActive,
  noteLook,
  spreadNow,
  tickArrival,
  tickLook,
} from '@/utils/specimenMotion'
import { describe, expect, it, vi } from 'vitest'

describe('specimen motion', () => {
  it('keeps the demand loop drawing through the arrival and a look blend, then lets it idle', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000)
    expect(motionActive()).toBe(false)

    beginArrival(false)
    expect(motionActive()).toBe(true)
    expect(spreadNow()).toBeCloseTo(0.35)
    tickArrival(1400, 0)
    expect(motionActive()).toBe(true)
    expect(spreadNow()).toBeGreaterThan(0)
    tickArrival(1800, 0.2)
    expect(motionActive()).toBe(false)
    expect(spreadNow()).toBe(0.2)

    beginArrival(false)
    expect(motionActive()).toBe(false)

    noteLook('radiograph', false)
    expect(motionActive()).toBe(true)
    tickLook(1120, false)
    expect(lookPaint()).toEqual({ look: 'radiograph', from: 'atlas', blend: 0.5 })
    tickLook(1300, false)
    expect(motionActive()).toBe(false)

    noteLook('ivory', true)
    expect(motionActive()).toBe(false)
    cancelArrival(0.4)
    tickArrival(2000, 0.4)
    expect(spreadNow()).toBe(0.4)
    vi.restoreAllMocks()
  })
})
