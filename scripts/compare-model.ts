/**
 * Compares the shipped Draco GLB against a meshopt re-encode: transfer size (with decoder), triangles, and parse time
 * with three.js loaders in Chromium, including the longest main-thread task during the parse.
 *
 * Usage: npx tsx scripts/compare-model.ts
 * Writes perf/model/compare.json. The shipped asset is not modified.
 */
import { Logger, NodeIO, type Document } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { meshopt } from '@gltf-transform/functions'
import { chromium } from '@playwright/test'
import draco3d from 'draco3dgltf'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { brotliCompressSync, gzipSync } from 'node:zlib'
import { createServer } from 'vite'

const SOURCE = 'public/models/overview-skeleton.glb'
const OUT = 'perf/model'
const PORT = 4180
const RUNS = 9

function sizes(bytes: Uint8Array) {
  return { raw: bytes.length, gzip: gzipSync(bytes).length, brotli: brotliCompressSync(bytes).length }
}

function triangles(document: Document): number {
  let total = 0
  for (const mesh of document.getRoot().listMeshes())
    for (const primitive of mesh.listPrimitives()) total += (primitive.getIndices()?.getCount() ?? 0) / 3
  return total
}

const HARNESS = `<!doctype html><script type="module">
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
let longest = 0
new PerformanceObserver((list) => { for (const entry of list.getEntries()) longest = Math.max(longest, entry.duration) })
  .observe({ type: 'longtask' })
const draco = new DRACOLoader().setDecoderPath('/draco/')
async function time(file, setup) {
  const buffer = await (await fetch('/${OUT}/' + file)).arrayBuffer()
  const runs = []
  for (let i = 0; i < ${RUNS}; i++) {
    const loader = new GLTFLoader()
    setup(loader)
    longest = 0
    const start = performance.now()
    await loader.parseAsync(buffer.slice(0), '')
    await new Promise((resolve) => setTimeout(resolve, 150))
    runs.push({ ms: performance.now() - start - 150, longestTaskMs: longest })
  }
  return runs
}
window.result = {
  draco: await time('draco.glb', (loader) => loader.setDRACOLoader(draco)),
  meshopt: await time('meshopt.glb', (loader) => loader.setMeshoptDecoder(MeshoptDecoder)),
}
</script>`

function median(values: number[]): number {
  const sorted = values.toSorted((left, right) => left - right)
  return Math.round(sorted[Math.floor(sorted.length / 2)]!)
}

async function main() {
  await MeshoptEncoder.ready
  await MeshoptDecoder.ready
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'meshopt.encoder': MeshoptEncoder,
    'meshopt.decoder': MeshoptDecoder,
  })
  mkdirSync(OUT, { recursive: true })

  const dracoBytes = readFileSync(SOURCE)
  const document = await io.read(SOURCE)
  document.setLogger(new Logger(Logger.Verbosity.ERROR))
  const sourceTriangles = triangles(document)
  for (const extension of document.getRoot().listExtensionsUsed())
    if (extension.extensionName === 'KHR_draco_mesh_compression') extension.dispose()
  await document.transform(meshopt({ encoder: MeshoptEncoder, level: 'high' }))
  const meshoptBytes = await io.writeBinary(document)
  writeFileSync(join(OUT, 'draco.glb'), dracoBytes)
  writeFileSync(join(OUT, 'meshopt.glb'), meshoptBytes)
  writeFileSync(join(OUT, 'index.html'), HARNESS)

  const decoderBytes = readdirSync('public/draco')
    .filter((file) => file !== 'draco_decoder.js')
    .map((file) => sizes(readFileSync(join('public/draco', file))))
    .reduce((sum, size) => ({
      raw: sum.raw + size.raw,
      gzip: sum.gzip + size.gzip,
      brotli: sum.brotli + size.brotli,
    }))

  const server = await createServer({
    configFile: false,
    logLevel: 'error',
    optimizeDeps: { entries: [join(OUT, 'index.html')] },
    server: { port: PORT, strictPort: true },
  })
  await server.listen()
  const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
  try {
    const page = await browser.newPage()
    await page.goto(`http://localhost:${PORT}/${OUT}/index.html`)
    await page.waitForFunction(() => 'result' in window, null, { timeout: 120_000 })
    const timing = (await page.evaluate(() => (window as unknown as { result: unknown }).result)) as Record<
      'draco' | 'meshopt',
      Array<{ ms: number; longestTaskMs: number }>
    >
    const summary = (runs: Array<{ ms: number; longestTaskMs: number }>) => ({
      firstParseMs: Math.round(runs[0]!.ms),
      medianParseMs: median(runs.slice(1).map((run) => run.ms)),
      maxMainThreadTaskMs: Math.round(Math.max(...runs.slice(1).map((run) => run.longestTaskMs))),
    })
    const result = {
      measuredAt: new Date().toISOString(),
      triangles: sourceTriangles,
      draco: { glb: sizes(dracoBytes), decoder: decoderBytes, ...summary(timing.draco) },
      meshopt: {
        glb: sizes(meshoptBytes),
        decoder: 'bundled with three (no extra request)',
        ...summary(timing.meshopt),
      },
    }
    writeFileSync(join(OUT, 'compare.json'), `${JSON.stringify(result, null, 2)}\n`)
    console.log(JSON.stringify(result, null, 2))
  } finally {
    await browser.close()
    await server.close()
  }
}

await main()
