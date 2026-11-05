/**
 * Fails when the production build grows past its size budgets. Sizes are gzip, as served.
 *
 * Usage: npx vite build && npx tsx scripts/check-budgets.ts [--dist dist]
 * Prints a table, appends it to the GitHub step summary when there is one, and exits 1 on any breach.
 */
import { appendFileSync } from 'node:fs'
import { bundleSizes, modelSizes } from './bundleSizes'

const KB = 1024

const BUDGETS = [
  { name: 'Render-blocking JS (gzip)', limit: 240 * KB, measure: (b: Bundle) => b.renderBlockingJs.gzip },
  { name: 'First-load JS incl. 3D scene (gzip)', limit: 560 * KB, measure: (b: Bundle) => b.firstLoadJs.gzip },
  { name: 'Largest lazy chunk (gzip)', limit: 130 * KB, measure: (b: Bundle) => b.largestLazy?.gzip ?? 0 },
  { name: 'CSS (gzip)', limit: 20 * KB, measure: (b: Bundle) => b.css.gzip },
  { name: 'Skeleton GLB', limit: 3.2 * KB * KB, measure: (_: Bundle, m: Model) => m.glb[0]?.raw ?? 0 },
]

type Bundle = ReturnType<typeof bundleSizes>
type Model = ReturnType<typeof modelSizes>

function flag(name: string, fallback: string): string {
  const index = process.argv.indexOf(name)
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback
}

function kb(bytes: number): string {
  return `${(bytes / KB).toFixed(1)} kB`
}

const dist = flag('--dist', 'dist')
const bundle = bundleSizes(dist)
const model = modelSizes(dist)
const rows = BUDGETS.map((budget) => {
  const value = budget.measure(bundle, model)
  return { name: budget.name, value, limit: budget.limit, ok: value <= budget.limit }
})

const table = [
  '### Size budgets',
  '| Budget | Size | Limit | |',
  '| --- | --- | --- | --- |',
  ...rows.map((row) => `| ${row.name} | ${kb(row.value)} | ${kb(row.limit)} | ${row.ok ? 'pass' : '**over**'} |`),
].join('\n')

console.log(table)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${table}\n`)
if (rows.some((row) => !row.ok)) {
  console.error('A size budget is exceeded.')
  process.exit(1)
}
