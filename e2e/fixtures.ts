import { expect, type Page } from '@playwright/test'

/** Opens a page and waits until the 3D skeleton has loaded. */
export async function openAtlas(page: Page, path = '/'): Promise<void> {
  await page.goto(path)
  await expect(page.locator('[data-model-state]')).toHaveAttribute('data-model-state', 'ready', { timeout: 45_000 })
}

export function infoPanel(page: Page) {
  return page.locator('#bone-info')
}

/** The URL is written shortly after the view changes, so poll for it. */
export async function expectUrlParam(page: Page, key: string, value: string): Promise<void> {
  await expect.poll(() => new URL(page.url()).searchParams.get(key)).toBe(value)
}
