/**
 * Downsizes the skeleton's normal maps to at most 512×512. They are the bulk of GPU memory and of first-render cost
 * (each map is uploaded and mipmapped on the main thread). Only the image buffer views are rewritten; the Draco
 * geometry bytes are copied through untouched, since re-encoding them comes out larger than the original.
 * Idempotent: maps already within the limit are left alone.
 *
 * Usage: npx tsx scripts/resize-normal-maps.ts [--max 512] [--out public/models/overview-skeleton.glb]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const SOURCE = 'public/models/overview-skeleton.glb'
const JSON_CHUNK = 0x4e4f534a
const BIN_CHUNK = 0x004e4942

interface Gltf {
  buffers: Array<{ byteLength: number }>
  bufferViews: Array<{ buffer: number; byteOffset?: number; byteLength: number }>
  images?: Array<{ bufferView?: number; mimeType?: string }>
}

function flag(name: string, fallback: string): string {
  const index = process.argv.indexOf(name)
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback
}

const align4 = (value: number) => Math.ceil(value / 4) * 4

function readGlb(file: Buffer): { json: Gltf; bin: Buffer } {
  if (file.readUInt32LE(0) !== 0x46546c67) throw new Error('Not a binary glTF file')
  const jsonLength = file.readUInt32LE(12)
  if (file.readUInt32LE(16) !== JSON_CHUNK) throw new Error('The first chunk is not JSON')
  const json = JSON.parse(file.toString('utf8', 20, 20 + jsonLength)) as Gltf
  const binStart = 20 + jsonLength
  if (file.readUInt32LE(binStart + 4) !== BIN_CHUNK) throw new Error('The second chunk is not BIN')
  const binLength = file.readUInt32LE(binStart)
  return { json, bin: file.subarray(binStart + 8, binStart + 8 + binLength) }
}

function chunkHeader(length: number, type: number): Buffer {
  const bytes = Buffer.alloc(8)
  bytes.writeUInt32LE(length, 0)
  bytes.writeUInt32LE(type, 4)
  return bytes
}

function writeGlb(json: Gltf, bin: Buffer): Buffer {
  const jsonBytes = Buffer.from(JSON.stringify(json))
  const jsonChunk = Buffer.alloc(align4(jsonBytes.length), 0x20)
  jsonBytes.copy(jsonChunk)
  const binChunk = Buffer.alloc(align4(bin.length))
  bin.copy(binChunk)
  const header = Buffer.alloc(12)
  header.writeUInt32LE(0x46546c67, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8)
  return Buffer.concat([
    header,
    chunkHeader(jsonChunk.length, JSON_CHUNK),
    jsonChunk,
    chunkHeader(binChunk.length, BIN_CHUNK),
    binChunk,
  ])
}

const max = Number(flag('--max', '512'))
const out = flag('--out', SOURCE)
const source = readFileSync(SOURCE)
const { json, bin } = readGlb(source)
if (json.buffers.length !== 1) throw new Error('Expected a single binary buffer')

const replacements = new Map<number, Buffer>()
let resized = 0
let gpuBefore = 0
let gpuAfter = 0
const gpuBytes = (width: number, height: number) => width * height * 4 * (4 / 3)
for (const image of json.images ?? []) {
  if (image.bufferView === undefined) continue
  const view = json.bufferViews[image.bufferView]!
  const bytes = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
  const { width = 0, height = 0 } = await sharp(bytes).metadata()
  gpuBefore += gpuBytes(width, height)
  if (Math.max(width, height) <= max) {
    gpuAfter += gpuBytes(width, height)
    continue
  }
  const scale = max / Math.max(width, height)
  gpuAfter += gpuBytes(Math.round(width * scale), Math.round(height * scale))
  replacements.set(
    image.bufferView,
    await sharp(bytes)
      .resize(max, max, { fit: 'inside', kernel: 'lanczos3' })
      .jpeg({ quality: 85, mozjpeg: true, chromaSubsampling: '4:2:0' })
      .toBuffer(),
  )
  image.mimeType = 'image/jpeg'
  resized += 1
}

const order = json.bufferViews
  .map((_, index) => index)
  .toSorted((left, right) => (json.bufferViews[left]!.byteOffset ?? 0) - (json.bufferViews[right]!.byteOffset ?? 0))
const parts: Buffer[] = []
let cursor = 0
for (const index of order) {
  const view = json.bufferViews[index]!
  const bytes = replacements.get(index) ?? bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
  const offset = align4(cursor)
  if (offset > cursor) parts.push(Buffer.alloc(offset - cursor))
  parts.push(bytes)
  view.byteOffset = offset
  view.byteLength = bytes.length
  cursor = offset + bytes.length
}
const nextBin = Buffer.concat(parts)
json.buffers[0]!.byteLength = nextBin.length
const result = writeGlb(json, nextBin)
writeFileSync(out, result)

const mb = (value: number) => `${(value / 1024 / 1024).toFixed(2)} MB`
console.log(
  `${resized} of ${json.images?.length ?? 0} maps resized to ${max}px. GLB ${mb(source.length)} -> ${mb(result.length)}, ` +
    `estimated texture memory with mipmaps ${mb(gpuBefore)} -> ${mb(gpuAfter)}. Wrote ${out}.`,
)
