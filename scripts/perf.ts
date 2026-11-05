/**
 * Measures the production build: bundle and asset sizes, load timing, draw calls, idle rendering, and Lighthouse.
 *
 * Usage: npm run build && npm run perf -- --label after
 * Writes perf/<label>.json. WebGL runs on SwiftShader, so absolute frame times are not GPU numbers; compare runs
 * against each other, not against real devices.
 */
import { chromium, type Page } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { bundleSizes, modelSizes } from './bundleSizes'

const PORT = 4179
const URL_BASE = `http://localhost:${PORT}/`
const IDLE_MS = 5000

function flag(name: string, fallback: string): string {
  const index = process.argv.indexOf(name)
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback
}

const label = flag('--label', 'latest')
const DIST = flag('--dist', 'dist')
const skipLighthouse = process.argv.includes('--no-lighthouse')
/** `--gpu` uses this machine's GPU (Metal on macOS) instead of SwiftShader, for frame-rate numbers. */
const GPU = process.argv.includes('--gpu')
const GL_ARGS = GPU
  ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
const presets = flag('--lighthouse', 'desktop,mobile').split(',') as Array<'desktop' | 'mobile'>

/**
 * Counts draw calls and triangles per animation frame by wrapping the WebGL draw functions. It is a string because
 * tsx adds helpers to compiled functions that do not exist inside the page.
 */
const INSTRUMENT_WEBGL = `(() => {
  const stats = { frames: 0, drawnFrames: 0, calls: 0, triangles: 0, lastCalls: 0, lastTriangles: 0, drawn: [] }
  window.atlasPerf = stats
  for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const original = proto[name]
      if (!original) continue
      const instanceArg = name === 'drawElementsInstanced' ? 4 : name === 'drawArraysInstanced' ? 3 : -1
      proto[name] = function (...args) {
        stats.calls += 1
        if (args[0] === 4) stats.triangles += (args[1] / 3) * (instanceArg >= 0 ? args[instanceArg] : 1)
        return original.apply(this, args)
      }
    }
  }
  let frameStamp = -1
  const raf = window.requestAnimationFrame.bind(window)
  window.requestAnimationFrame = (callback) =>
    raf((time) => {
      if (time !== frameStamp) {
        if (frameStamp >= 0) {
          stats.frames += 1
          if (stats.calls > 0) {
            stats.drawnFrames += 1
            stats.lastCalls = stats.calls
            stats.lastTriangles = stats.triangles
            stats.drawn.push({ calls: stats.calls, triangles: stats.triangles, time: frameStamp })
            if (stats.drawn.length > 2000) stats.drawn.shift()
          }
          stats.calls = 0
          stats.triangles = 0
        }
        frameStamp = time
      }
      callback(time)
    })
})()`

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} kB`
}

function startPreview(): Promise<ChildProcess> {
  const child = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', 'preview', '--outDir', DIST, '--port', String(PORT), '--strictPort'],
    { stdio: 'pipe' },
  )
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite preview did not start')), 20_000)
    child.stdout?.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes(String(PORT))) {
        clearTimeout(timer)
        resolve(child)
      }
    })
    child.on('exit', (code) => reject(new Error(`vite preview exited with ${code}`)))
  })
}

async function runtimeMetrics() {
  const browser = await chromium.launch({ args: GL_ARGS })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.addInitScript({ content: INSTRUMENT_WEBGL })
  const cdp = await context.newCDPSession(page)
  await cdp.send('Performance.enable')
  await page.goto(URL_BASE)
  const readyMs = await page.waitForFunction(
    () => document.querySelector('[data-model-state="ready"]') && performance.now(),
    undefined,
    { timeout: 120_000, polling: 50 },
  )
  const timeToReady = (await readyMs.jsonValue()) as number
  // Let the arrival animation and the first camera move finish.
  await page.waitForTimeout(3000)
  const scene = await page.evaluate(() => {
    const perf = (window as unknown as { atlasPerf: { lastCalls: number; lastTriangles: number } }).atlasPerf
    return { drawCalls: perf.lastCalls, triangles: Math.round(perf.lastTriangles) }
  })
  const metric = async () => {
    const { metrics } = await cdp.send('Performance.getMetrics')
    return Object.fromEntries(metrics.map((item) => [item.name, item.value]))
  }
  const before = await metric()
  const framesBefore = await page.evaluate(
    () => (window as unknown as { atlasPerf: { drawnFrames: number } }).atlasPerf.drawnFrames,
  )
  await page.waitForTimeout(IDLE_MS)
  const after = await metric()
  const framesAfter = await page.evaluate(
    () => (window as unknown as { atlasPerf: { drawnFrames: number } }).atlasPerf.drawnFrames,
  )
  const orbit = await measureOrbit(page)
  const vitals = await page.evaluate(
    () =>
      new Promise<{ lcp: number | null; cls: number }>((resolve) => {
        let lcp: number | null = null
        let cls = 0
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) lcp = entry.startTime
        }).observe({ type: 'largest-contentful-paint', buffered: true })
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as Array<
            PerformanceEntry & { value: number; hadRecentInput: boolean }
          >) {
            if (!entry.hadRecentInput) cls += entry.value
          }
        }).observe({ type: 'layout-shift', buffered: true })
        setTimeout(() => resolve({ lcp, cls }), 200)
      }),
  )
  await browser.close()
  const seconds = IDLE_MS / 1000
  return {
    timeToModelReadyMs: Math.round(timeToReady),
    lcpMs: vitals.lcp === null ? null : Math.round(vitals.lcp),
    cls: Number(vitals.cls.toFixed(4)),
    drawCallsPerFrame: scene.drawCalls,
    trianglesPerFrame: scene.triangles,
    idle: {
      seconds,
      framesRendered: framesAfter - framesBefore,
      mainThreadBusyMs: Math.round(((after.TaskDuration ?? 0) - (before.TaskDuration ?? 0)) * 1000),
      scriptMs: Math.round(((after.ScriptDuration ?? 0) - (before.ScriptDuration ?? 0)) * 1000),
    },
    orbit,
    jsHeapMb: Number(((after.JSHeapUsedSize ?? 0) / 1024 / 1024).toFixed(1)),
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = values.toSorted((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)]!
}

/** Drags the camera for about a second and reports the cost of each frame drawn while it moves. */
async function measureOrbit(page: Page) {
  const canvas = page.locator('canvas').first()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('No canvas to orbit')
  const drawnCount = () =>
    page.evaluate(() => (window as unknown as { atlasPerf: { drawn: unknown[] } }).atlasPerf.drawn.length)
  const start = await drawnCount()
  const x = box.x + box.width * 0.62
  const y = box.y + box.height * 0.5
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let step = 1; step <= 60; step++) {
    await page.mouse.move(x + step * 5, y + Math.sin(step / 9) * 20)
    await page.waitForTimeout(16)
  }
  await page.mouse.up()
  await page.waitForTimeout(1500)
  const frames = (await page.evaluate(
    (from) =>
      (
        window as unknown as { atlasPerf: { drawn: Array<{ calls: number; triangles: number; time: number }> } }
      ).atlasPerf.drawn.slice(from),
    start,
  )) as Array<{ calls: number; triangles: number; time: number }>
  const intervals = frames.slice(1).map((frame, index) => frame.time - frames[index]!.time)
  return {
    framesDrawn: frames.length,
    medianDrawCalls: median(frames.map((frame) => frame.calls)),
    medianTriangles: Math.round(median(frames.map((frame) => frame.triangles))),
    medianFrameMs: Number(median(intervals.filter((interval) => interval < 100)).toFixed(1)),
    p95FrameMs: Number(
      (
        intervals.filter((interval) => interval < 100).toSorted((left, right) => left - right)[
          Math.floor(intervals.length * 0.95)
        ] ?? 0
      ).toFixed(1),
    ),
  }
}

async function lighthouseScores() {
  const { default: lighthouse } = await import('lighthouse')
  const chromeLauncher = await import('chrome-launcher')
  const results: Record<string, unknown> = {}
  for (const preset of presets) {
    const chrome = await chromeLauncher.launch({
      chromePath: chromium.executablePath(),
      chromeFlags: ['--headless=new', ...GL_ARGS],
    })
    try {
      const config =
        preset === 'desktop' ? (await import('lighthouse/core/config/desktop-config.js')).default : undefined
      const result = await lighthouse(URL_BASE, { port: chrome.port, output: 'json', logLevel: 'error' }, config)
      const lhr = result?.lhr
      if (!lhr) continue
      if (lhr.runtimeError) {
        results[preset] = { error: `${lhr.runtimeError.code}: ${lhr.runtimeError.message}` }
        continue
      }
      const audit = (id: string) => lhr.audits[id]?.numericValue
      results[preset] = {
        performance: Math.round((lhr.categories.performance?.score ?? 0) * 100),
        accessibility: Math.round((lhr.categories.accessibility?.score ?? 0) * 100),
        bestPractices: Math.round((lhr.categories['best-practices']?.score ?? 0) * 100),
        fcpMs: Math.round(audit('first-contentful-paint') ?? 0),
        lcpMs: Math.round(audit('largest-contentful-paint') ?? 0),
        tbtMs: Math.round(audit('total-blocking-time') ?? 0),
        cls: Number((audit('cumulative-layout-shift') ?? 0).toFixed(4)),
        transferKb: Math.round((audit('total-byte-weight') ?? 0) / 1024),
      }
    } catch (error) {
      results[preset] = { error: (error as Error).message }
    } finally {
      chrome.kill()
    }
  }
  return results
}

async function main() {
  statSync(join(DIST, 'index.html'))
  mkdirSync('perf', { recursive: true })
  const out = `perf/${label}.json`
  const report: Record<string, unknown> = {
    label,
    renderer: GPU ? 'gpu' : 'swiftshader',
    measuredAt: new Date().toISOString(),
    bundle: bundleSizes(DIST),
    model: modelSizes(DIST),
  }
  const save = () => writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`)
  save()
  const preview = await startPreview()
  try {
    report.runtime = await runtimeMetrics()
    save()
    console.log(JSON.stringify(report.runtime, null, 2))
    if (!skipLighthouse) {
      report.lighthouse = await lighthouseScores()
      save()
      console.log(JSON.stringify(report.lighthouse, null, 2))
    }
  } finally {
    preview.kill()
  }
  const bundle = report.bundle as ReturnType<typeof bundleSizes>
  console.log(
    `First-load JS: ${kb(bundle.firstLoadJs.raw)} (${kb(bundle.firstLoadJs.gzip)} gzip), render-blocking ` +
      `${kb(bundle.renderBlockingJs.raw)} (${kb(bundle.renderBlockingJs.gzip)} gzip), wrote ${out}`,
  )
}

await main()
