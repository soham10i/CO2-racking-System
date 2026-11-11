import { expect, test } from '@playwright/test'
import { signUp } from './helpers'

test('sign up, log a car trip and see it in the log', async ({ page }) => {
  await signUp(page)

  await page.goto('/log/new')
  await page.getByRole('button', { name: 'Transport' }).click()
  await page.getByLabel(/^Amount/).fill('12')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page).toHaveURL(/\/log$/)
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await expect(page.getByText(/kg/).first()).toBeVisible()
})

test('switching to German translates the navigation and keeps the choice', async ({ page }) => {
  await signUp(page)

  await page.goto('/settings')
  await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'Deutsch' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await page.getByRole('group', { name: 'Sprache' }).getByRole('button', { name: 'English' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})
