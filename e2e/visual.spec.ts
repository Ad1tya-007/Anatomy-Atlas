import { expect, test, type Page } from '@playwright/test'
import { openAtlas } from './fixtures'

/**
 * Pixel baselines are stored per platform in `e2e/__screenshots__`. CI compares against the Linux set.
 * Regenerate them with the "Update visual snapshots" workflow, or locally with `npm run test:e2e:update`.
 */
const VIEWS = [
  { name: 'atlas', path: '/' },
  { name: 'ivory', path: '/?look=ivory' },
  { name: 'radiograph', path: '/?look=radiograph' },
  { name: 'sagittal-section', path: '/?sx=sagittal&sa=0.5' },
  { name: 'femur-selected', path: '/?b=femur_left', movesCamera: true },
]

/**
 * Software WebGL draws the full skeleton at a few frames per second, which is too slow for Playwright's
 * "two identical frames" check. Once the scene has settled, stop the page's render loop so the capture
 * is instant and deterministic. Playwright's own scripts run in an isolated world and are unaffected.
 */
async function freezeRendering(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let frames = 0
        const tick = () => {
          frames += 1
          if (frames < 4) {
            requestAnimationFrame(tick)
            return
          }
          window.requestAnimationFrame = () => 0
          setTimeout(resolve, 500)
        }
        requestAnimationFrame(tick)
      }),
  )
}

test.describe('visual regression', () => {
  for (const view of VIEWS) {
    test(view.name, async ({ page }) => {
      await openAtlas(page, view.path)
      // A moved camera is written to the URL only once it has come to rest.
      if (view.movesCamera) await expect.poll(() => new URL(page.url()).searchParams.has('cam')).toBe(true)
      await freezeRendering(page)
      await expect(page.locator('[data-model-state]')).toHaveScreenshot(`${view.name}.png`)
    })
  }
})
