import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { brotliCompressSync, gzipSync } from 'node:zlib'

export interface FileSize {
  file: string
  raw: number
  gzip: number
  brotli: number
}

export type Size = Omit<FileSize, 'file'>

export function sizeOf(dist: string, path: string): FileSize {
  const data = readFileSync(path)
  return {
    file: path.slice(dist.length + 1),
    raw: data.length,
    gzip: gzipSync(data, { level: 9 }).length,
    brotli: brotliCompressSync(data).length,
  }
}

export function sum(files: FileSize[]): Size {
  return files.reduce(
    (total, file) => ({
      raw: total.raw + file.raw,
      gzip: total.gzip + file.gzip,
      brotli: total.brotli + file.brotli,
    }),
    { raw: 0, gzip: 0, brotli: 0 },
  )
}

/**
 * First-load JS is the entry script plus everything index.html preloads. Render-blocking JS leaves out the 3D scene
 * chunks (tagged `data-scene`), which download in parallel but do not hold up the first paint. The rest loads on demand.
 */
export function bundleSizes(dist: string) {
  const html = readFileSync(join(dist, 'index.html'), 'utf8')
  const initial = new Set([...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(?:js|css))"/g)].map((match) => match[1]))
  const deferred = new Set(
    [...html.matchAll(/<link[^>]*href="\/(assets\/[^"]+\.js)"[^>]*data-scene/g)].map((match) => match[1]),
  )
  const assets = readdirSync(join(dist, 'assets')).filter((file) => /\.(js|css)$/.test(file))
  const files = assets.map((file) => sizeOf(dist, join(dist, 'assets', file)))
  const js = files.filter((file) => file.file.endsWith('.js'))
  const css = files.filter((file) => file.file.endsWith('.css'))
  const firstLoadJs = js.filter((file) => initial.has(file.file))
  const lazy = js.filter((file) => !initial.has(file.file))
  return {
    firstLoadJs: sum(firstLoadJs),
    renderBlockingJs: sum(firstLoadJs.filter((file) => !deferred.has(file.file))),
    lazyJs: sum(lazy),
    largestLazy: lazy.toSorted((a, b) => b.gzip - a.gzip)[0] ?? null,
    css: sum(css),
    chunks: js.length,
    files: files.toSorted((a, b) => b.raw - a.raw),
  }
}

export function modelSizes(dist: string) {
  const draco = readdirSync(join(dist, 'draco')).map((file) => sizeOf(dist, join(dist, 'draco', file)))
  const models = readdirSync(join(dist, 'models')).filter((file) => file.endsWith('.glb'))
  return {
    glb: models.map((file) => sizeOf(dist, join(dist, 'models', file))),
    decoders: draco,
    decoderTotal: sum(draco),
  }
}
