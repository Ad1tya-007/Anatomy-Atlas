import type { Metric } from 'web-vitals'

export const VITALS_API = '/api/vitals'

export interface VitalSample {
  name: Metric['name']
  value: number
  rating: Metric['rating']
  id: string
  navigationType: Metric['navigationType']
}

export interface VitalsPayload {
  path: string
  metrics: VitalSample[]
  viewport: [number, number]
  dpr: number
  connection?: string
}

function connectionType(): string | undefined {
  return (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType
}

/**
 * Collects Core Web Vitals and sends them in one beacon when the page is hidden, the last moment a browser reliably
 * delivers a request. Metrics that change later (CLS, INP) overwrite their earlier sample.
 */
export function createVitalsReporter(send: (payload: VitalsPayload) => void) {
  const pending = new Map<string, VitalSample>()
  const record = (metric: Metric) => {
    pending.set(metric.name, {
      name: metric.name,
      value:
        Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value) / (metric.name === 'CLS' ? 1000 : 1),
      rating: metric.rating,
      id: metric.id,
      navigationType: metric.navigationType,
    })
  }
  const flush = () => {
    if (pending.size === 0) return
    send({
      path: location.pathname,
      metrics: [...pending.values()],
      viewport: [innerWidth, innerHeight],
      dpr: Math.round(devicePixelRatio * 100) / 100,
      connection: connectionType(),
    })
    pending.clear()
  }
  return { record, flush }
}

function beacon(payload: VitalsPayload): void {
  const body = JSON.stringify(payload)
  if (navigator.sendBeacon?.(VITALS_API, new Blob([body], { type: 'application/json' }))) return
  void fetch(VITALS_API, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } })
}

/** Production only. The library loads after first paint; its observers are buffered, so nothing earlier is missed. */
export function startVitals(): void {
  if (!import.meta.env.PROD || navigator.webdriver) return
  const reporter = createVitalsReporter(beacon)
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') reporter.flush()
  })
  addEventListener('pagehide', reporter.flush)
  const load = () =>
    void import('web-vitals').then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
      for (const observe of [onCLS, onFCP, onINP, onLCP, onTTFB]) observe(reporter.record)
    })
  if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 4000 })
  else setTimeout(load, 2000)
}
