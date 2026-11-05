import { expect, test } from '@playwright/test'
import { openAtlas } from './fixtures'

test('navigates and reads details on a phone', async ({ page }) => {
  await openAtlas(page)
  await expect(page.locator('#bone-info')).toBeHidden()

  await page.getByRole('button', { name: 'Navigator' }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByRole('heading', { name: 'Navigator' })).toBeVisible()
  await sheet.getByRole('button', { name: 'Left Femur', exact: true }).click()

  const details = page.getByRole('dialog')
  await expect(details.getByRole('heading', { level: 2, name: 'Femur' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Details' })).toHaveAttribute('aria-pressed', 'false')
})

test('opens the tutor on a phone', async ({ page }) => {
  await openAtlas(page)
  await page.getByRole('button', { name: 'Tutor' }).click()
  const tutor = page.getByRole('region', { name: 'Tutor' })
  await expect(tutor.getByText(/Educational use only, not medical advice/)).toBeVisible()
})
