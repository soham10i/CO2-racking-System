import { expect, test } from '@playwright/test'
import { signUp } from './helpers'

const isoDaysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)

test('a shared electricity bill is split and read-only for the other member', async ({ browser }) => {
  const owner = await (await browser.newContext()).newPage()
  const partner = await (await browser.newContext()).newPage()
  await signUp(owner)
  await signUp(partner)

  await owner.goto('/household')
  await owner.getByLabel('Household name').fill('Flat 3')
  await owner.getByRole('button', { name: 'Create household' }).click()
  await owner.getByRole('button', { name: 'Create invite code' }).click()
  const code = (await owner.getByLabel('Invite code').innerText()).trim()

  await partner.goto('/household')
  await partner.getByLabel('Invite code').fill(code)
  await partner.getByRole('button', { name: 'Join', exact: true }).click()
  await expect(partner.getByText('Members (2')).toBeVisible()

  await owner.goto('/log/new')
  await owner.getByRole('button', { name: 'Home energy' }).click()
  await owner.getByLabel('Type').selectOption('ELECTRICITY')
  await owner.getByLabel(/^Amount/).fill('100')
  await owner.getByLabel('Share with household (2 people)').check()
  await owner.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(owner).toHaveURL(/\/log$/)

  await partner.goto('/log')
  await expect(partner.getByText('Shared with household (1/2)')).toBeVisible()
  // Only the person who logged it may change it.
  await expect(partner.getByRole('link', { name: /^Edit/ })).toHaveCount(0)
  await expect(owner.getByRole('link', { name: /^Edit/ })).toHaveCount(1)
})

test('a German smart-meter export imports one entry per day, and again only as duplicates', async ({ page }) => {
  await signUp(page)
  const csv = ['Datum;Zählerstand (kWh)', `${isoDaysAgo(3)};1.000,0`, `${isoDaysAgo(2)};1.008,5`, `${isoDaysAgo(1)};1.020,0`].join('\n')
  const file = { name: 'zaehler.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf-8') }

  await page.goto('/settings')
  await page.getByRole('group', { name: 'Kind of file' }).getByRole('button', { name: 'Meter or utility export' }).click()
  await page.getByLabel('CSV file').setInputFiles(file)
  await page.getByRole('button', { name: 'Import 2 entries' }).click()
  await expect(page.getByText('Imported').first()).toBeVisible()

  await page.getByLabel('CSV file').setInputFiles(file)
  await expect(page.getByText('Skipped')).toHaveCount(2)
  await expect(page.getByRole('button', { name: /^Import \d/ })).toHaveCount(0)
})
