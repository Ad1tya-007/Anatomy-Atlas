/**
 * Lighthouse CI budgets for the production build. CI renders WebGL with SwiftShader, so main-thread metrics include
 * software rasterization; the hard budgets are on paint timing, layout shift, and bytes, and blocking time warns.
 *
 *   npx vite build && npx lhci autorun
 *   ATLAS_LH_PRESET=mobile npx lhci autorun
 */
const mobile = process.env.ATLAS_LH_PRESET === 'mobile'

module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      isSinglePageApplication: true,
      numberOfRuns: 3,
      settings: {
        ...(mobile ? {} : { preset: 'desktop' }),
        chromeFlags: '--headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist',
      },
    },
    assert: {
      assertions: {
        'categories:accessibility': ['error', { minScore: 0.85 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'first-contentful-paint': ['error', { maxNumericValue: mobile ? 2000 : 1000, aggregationMethod: 'median' }],
        'largest-contentful-paint': ['error', { maxNumericValue: mobile ? 2500 : 1200, aggregationMethod: 'median' }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.05, aggregationMethod: 'median' }],
        'total-blocking-time': ['warn', { maxNumericValue: mobile ? 3000 : 800, aggregationMethod: 'median' }],
        'resource-summary:script:size': ['error', { maxNumericValue: 600 * 1024 }],
        'resource-summary:total:size': ['error', { maxNumericValue: 4600 * 1024 }],
      },
    },
    upload: { target: 'filesystem', outputDir: `./.lighthouseci/${mobile ? 'mobile' : 'desktop'}` },
  },
}
