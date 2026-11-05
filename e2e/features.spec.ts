import { expect, test, type Route } from '@playwright/test'
import { expectUrlParam, infoPanel, openAtlas } from './fixtures'

type Chunk = Record<string, unknown>

/** An AI SDK UI message stream, as /api/tutor sends it. */
function uiStream(...chunks: Chunk[]): string {
  const events = [{ type: 'start' }, { type: 'start-step' }, ...chunks, { type: 'finish-step' }, { type: 'finish' }]
  return `${events.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('')}data: [DONE]\n\n`
}

function fulfillStream(route: Route, body: string) {
  return route.fulfill({
    status: 200,
    headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
    body,
  })
}

test.describe('tutor', () => {
  test('moves the viewer with a tool call, then answers with a citation', async ({ page }) => {
    const requests: Array<{ messages: unknown[]; context: unknown }> = []
    await page.route('**/api/tutor', async (route) => {
      requests.push(route.request().postDataJSON())
      if (requests.length === 1) {
        await fulfillStream(
          route,
          uiStream({
            type: 'tool-input-available',
            toolCallId: 'call-1',
            toolName: 'select_bone',
            input: { boneId: 'femur_left' },
          }),
        )
        return
      }
      await fulfillStream(
        route,
        uiStream(
          { type: 'text-start', id: 't' },
          { type: 'text-delta', id: 't', delta: 'The femur is the longest bone in the body [[bone:femur_left]].' },
          { type: 'text-end', id: 't' },
        ),
      )
    })

    await openAtlas(page)
    await page.getByRole('tab', { name: 'Tutor' }).click()
    const tutor = page.getByRole('region', { name: 'Tutor' })
    await expect(tutor.getByText(/Educational use only, not medical advice/)).toBeVisible()
    await tutor.getByRole('textbox', { name: 'Ask the tutor' }).fill('Show me the femur')
    await tutor.getByRole('button', { name: 'Send' }).click()

    await expect(tutor.getByText('Selected the left femur')).toBeVisible()
    await expectUrlParam(page, 'b', 'femur_left')
    await expect(tutor.getByText('The femur is the longest bone in the body')).toBeVisible()
    expect(requests).toHaveLength(2)
    expect(JSON.stringify(requests[1]!.messages)).toContain('"output":{"ok":true')

    await tutor.getByRole('button', { name: 'Femur', exact: true }).click()
    await page.getByRole('tab', { name: 'Details' }).click()
    await expect(infoPanel(page).getByRole('heading', { level: 2, name: 'Femur' })).toBeVisible()

    await page.getByRole('tab', { name: 'Tutor' }).click()
    await tutor.getByRole('button', { name: /Undo/ }).click()
    await expect.poll(() => new URL(page.url()).searchParams.get('b')).toBeNull()
  })

  test('shows a readable error when the tutor is unavailable', async ({ page }) => {
    await page.route('**/api/tutor', (route) =>
      route.fulfill({
        status: 429,
        headers: { 'content-type': 'application/json', 'retry-after': '30' },
        body: JSON.stringify({ error: 'The tutor is busy. Try again in a few minutes.' }),
      }),
    )
    await openAtlas(page)
    await page.getByRole('tab', { name: 'Tutor' }).click()
    const tutor = page.getByRole('region', { name: 'Tutor' })
    await tutor.getByRole('textbox', { name: 'Ask the tutor' }).fill('What is the patella?')
    await tutor.getByRole('button', { name: 'Send' }).click()
    await expect(tutor.getByRole('button', { name: /Retry/ })).toBeVisible()
  })
})

test.describe('spaced repetition', () => {
  test('keeps review history across a reload', async ({ page }) => {
    await openAtlas(page)
    await page.getByRole('button', { name: 'Study' }).click()
    await page.getByRole('radio', { name: 'Choose' }).click()
    await page.getByRole('group', { name: 'Answer choices' }).getByRole('button').first().click()
    await expect(page.getByText(/^[01] of 1 correct$/)).toBeVisible()
    await page.getByRole('button', { name: 'Open your progress' }).click()
    await expect(
      page.getByRole('dialog', { name: 'Your progress' }).getByText('Reviews', { exact: true }).locator('..'),
    ).toContainText('1')
    await page.keyboard.press('Escape')

    await page.reload()
    await expect(page.locator('[data-model-state]')).toHaveAttribute('data-model-state', 'ready', { timeout: 45_000 })
    await page.getByRole('button', { name: 'Open your progress' }).click()
    const dialog = page.getByRole('dialog', { name: 'Your progress' })
    await expect(dialog.getByText('Reviews', { exact: true }).locator('..')).toContainText('1')
    await expect(dialog.getByText('Studied', { exact: true }).locator('..')).toContainText(/1 \/ \d+/)
  })
})
