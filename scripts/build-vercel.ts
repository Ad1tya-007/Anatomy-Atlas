/**
 * Builds the site and the API functions in Vercel's Build Output API layout (.vercel/output), which `vercel build`
 * and `vercel deploy --prebuilt` use as-is.
 *
 *   npm run build:vercel
 */
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const output = `${root}.vercel/output`

const FUNCTIONS = [
  { name: 'tutor', streaming: true, maxDuration: 30 },
  { name: 'vitals', streaming: false, maxDuration: 5 },
]

rmSync(output, { recursive: true, force: true })

await build({ root, logLevel: 'warn' })
cpSync(`${root}dist`, `${output}/static`, { recursive: true })

for (const fn of FUNCTIONS) {
  const functionDir = `${output}/functions/api/${fn.name}.func`
  await build({
    root,
    configFile: false,
    logLevel: 'warn',
    publicDir: false,
    resolve: { alias: { '@': `${root}src` } },
    ssr: { noExternal: true, target: 'node' },
    build: {
      ssr: `${root}src/server/vercel/${fn.name}.ts`,
      outDir: functionDir,
      emptyOutDir: true,
      target: 'node22',
      minify: true,
      rollupOptions: { output: { format: 'es', entryFileNames: 'index.mjs' } },
    },
  })
  writeFileSync(
    `${functionDir}/.vc-config.json`,
    `${JSON.stringify(
      {
        runtime: 'nodejs22.x',
        handler: 'index.mjs',
        launcherType: 'Nodejs',
        shouldAddHelpers: false,
        supportsResponseStreaming: fn.streaming,
        maxDuration: fn.maxDuration,
      },
      null,
      2,
    )}\n`,
  )
  writeFileSync(`${functionDir}/package.json`, '{ "type": "module" }\n')
}

const securityHeaders = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
}

mkdirSync(output, { recursive: true })
writeFileSync(
  `${output}/config.json`,
  `${JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '/assets/(.*)', headers: { 'cache-control': 'public, max-age=31536000, immutable' }, continue: true },
        { src: '/models/(.*)', headers: { 'cache-control': 'public, max-age=86400' }, continue: true },
        { src: '/(.*)', headers: securityHeaders, continue: true },
        { handle: 'filesystem' },
      ],
    },
    null,
    2,
  )}\n`,
)

console.log(`Wrote .vercel/output (static site and ${FUNCTIONS.map((fn) => `api/${fn.name}`).join(', ')}).`)
