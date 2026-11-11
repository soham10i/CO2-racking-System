import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { signUp } from './helpers'

/** WCAG 2.1 A/AA rules; serious and critical findings fail the run, the rest are printed. */
async function audit(page: Page, name: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  for (const v of violations) console.log(`[${name}] ${v.impact} ${v.id}: ${v.help} ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)
  expect(blocking.map((v) => `${v.id}: ${v.help}`), `${name} has serious accessibility violations`).toEqual([])
}

test('public pages have no serious accessibility violations', async ({ page }) => {
  for (const path of ['/login', '/register', '/forgot-password']) {
    await page.goto(path)
    await page.getByRole('heading', { level: 1 }).waitFor()
    await audit(page, path)
  }
})

test('signed-in pages have no serious accessibility violations, in both themes', async ({ page }) => {
  test.setTimeout(240_000) // 16 audited page loads
  await signUp(page)
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    for (const path of ['/', '/log', '/log/new', '/insights', '/templates', '/household', '/methodology', '/settings']) {
      await page.goto(path)
      await page.getByRole('heading', { level: 1 }).first().waitFor()
      // Charts and skeletons settle after the queries resolve.
      await page.waitForLoadState('networkidle')
      await audit(page, `${path} (${scheme})`)
    }
  }
})
