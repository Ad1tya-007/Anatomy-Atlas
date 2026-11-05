import { expect, test } from '@playwright/test'
import { expectUrlParam, infoPanel, openAtlas } from './fixtures'

test.describe('explore', () => {
  test('loads the skeleton with an empty details panel', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await openAtlas(page)
    await expect(page).toHaveTitle('Anatomy Atlas')
    await expect(page.locator('canvas')).toBeVisible()
    await expect(infoPanel(page).getByText('Explore the skeleton')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('finds a bone with search and shows its details', async ({ page }) => {
    await openAtlas(page)
    const search = page.getByRole('combobox', { name: 'Search bones, joints, landmarks, and walks' })
    await search.fill('femur')
    await page.getByRole('option', { name: /^Left Femur/ }).click()

    await expect(infoPanel(page).getByRole('heading', { level: 2, name: 'Femur' })).toBeVisible()
    await expect(infoPanel(page).getByText('Left Femur')).toBeVisible()
    await expectUrlParam(page, 'b', 'femur_left')
  })

  test('focuses search with the J shortcut and selects with the keyboard', async ({ page }) => {
    await openAtlas(page)
    await page.keyboard.press('j')
    await page.keyboard.type('greater trochanter')
    await page.keyboard.press('Enter')
    await expect(infoPanel(page).getByRole('heading', { level: 2, name: 'Greater trochanter' })).toBeVisible()
  })

  test('selects a bone by clicking the model', async ({ page }) => {
    await openAtlas(page, '/?b=sacrum')
    await expect(infoPanel(page).getByRole('heading', { level: 2, name: 'Sacrum' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(infoPanel(page).getByText('Explore the skeleton')).toBeVisible()

    const canvas = page.locator('canvas')
    const box = (await canvas.boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.42)
    await expect(infoPanel(page).getByRole('heading', { level: 2 })).toBeVisible()
    await expect(infoPanel(page).getByText('Explore the skeleton')).toBeHidden()
  })
})

test.describe('study mode', () => {
  test('answers a multiple-choice question', async ({ page }) => {
    await openAtlas(page)
    await page.getByRole('button', { name: 'Study' }).click()
    await page.getByRole('radio', { name: 'Choose' }).click()

    const choices = page.getByRole('group', { name: 'Answer choices' })
    await expect(choices.getByRole('button')).toHaveCount(4)
    await choices.getByRole('button').first().click()

    await expect(page.getByText(/^[01] of 1 correct$/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next bone' })).toBeVisible()
  })

  test('keeps the answer out of the URL until it is revealed', async ({ page }) => {
    await openAtlas(page, '/?b=femur_left')
    await expectUrlParam(page, 'b', 'femur_left')
    await page.getByRole('button', { name: 'Study' }).click()
    await expect.poll(() => new URL(page.url()).search).toBe('')
  })
})

test.describe('shareable links', () => {
  test('restores a landmark and look from the URL', async ({ page }) => {
    await openAtlas(page, '/?l=femur_left_greater_trochanter&look=radiograph')
    await expect(infoPanel(page).getByRole('heading', { level: 2, name: 'Greater trochanter' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Radiograph', exact: true })).toHaveAttribute('aria-pressed', 'true')
  })

  test('restores a guided walk step', async ({ page }) => {
    await openAtlas(page, '/?w=shoulder_to_hand&wi=3')
    await expect(page.getByText('4 of', { exact: false }).first()).toBeVisible()
    await expect(infoPanel(page).getByRole('heading', { level: 2, name: 'Humerus' })).toBeVisible()
  })

  test('ignores a broken link without crashing', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await openAtlas(page, '/?b=not_a_bone&look=sepia&cam=1,2,oops&sp=99')
    await expect(infoPanel(page).getByText('Explore the skeleton')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('copies a link that reopens the same view', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await openAtlas(page, '/?b=humerus_right&look=ivory')
    await expect(infoPanel(page).getByRole('heading', { level: 2, name: 'Humerus' })).toBeVisible()

    await page.getByRole('button', { name: 'Copy link to this view' }).click()
    await expect(page.getByText('Link copied')).toBeVisible()
    const link = await page.evaluate(() => navigator.clipboard.readText())
    expect(new URL(link).searchParams.get('b')).toBe('humerus_right')
    expect(new URL(link).searchParams.get('look')).toBe('ivory')

    await page.goto('about:blank')
    await openAtlas(page, new URL(link).pathname + new URL(link).search)
    await expect(infoPanel(page).getByText('Right Humerus')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ivory', exact: true })).toHaveAttribute('aria-pressed', 'true')
  })
})
