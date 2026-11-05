// @vitest-environment jsdom
import { createVitalsReporter, type VitalsPayload } from '@/features/vitals/reportVitals'
import type { Metric } from 'web-vitals'
import { describe, expect, it } from 'vitest'

function metric(name: Metric['name'], value: number): Metric {
  return {
    name,
    value,
    rating: 'good',
    delta: value,
    id: `${name}-1`,
    entries: [],
    navigationType: 'navigate',
    navigationId: 1,
  } as Metric
}

describe('vitals reporter', () => {
  it('sends the latest sample of each metric in one payload, then nothing until new data arrives', () => {
    const sent: VitalsPayload[] = []
    const reporter = createVitalsReporter((payload) => sent.push(payload))
    reporter.record(metric('CLS', 0.01234))
    reporter.record(metric('LCP', 1234.56))
    reporter.record(metric('CLS', 0.05))
    reporter.flush()
    reporter.flush()
    expect(sent).toHaveLength(1)
    expect(sent[0]!.metrics.map((sample) => [sample.name, sample.value])).toEqual([
      ['CLS', 0.05],
      ['LCP', 1235],
    ])
    expect(sent[0]!.path).toBe('/')
  })
})
