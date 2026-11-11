import { expect, type Page } from '@playwright/test'

const mailhog = process.env.E2E_MAILHOG_URL ?? 'http://127.0.0.1:8025'

/** A fresh throwaway account per test, so runs never depend on each other or on seed data. */
export function newAccount() {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return { name: 'E2E Tester', email: `e2e-${id}@example.test`, password: `e2e-${id}-pw-long` }
}

/** Reads the verification link from MailHog; the body is quoted-printable, so soft breaks are undone first. */
async function verificationPath(email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetch(`${mailhog}/api/v2/search?kind=to&query=${encodeURIComponent(email)}`)
    const json = (await res.json()) as { items: { Content: { Body: string } }[] }
    const body = json.items[0]?.Content.Body.replace(/=\r?\n/g, '').replace(/=3D/gi, '=')
    const match = body?.match(/\/verify-email\?token=([\w-]+)/)
    if (match) return `/verify-email?token=${match[1]}`
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`No verification email for ${email}`)
}

/** Registers through the UI, confirms the email, signs in and skips onboarding: ends on the dashboard. */
export async function signUp(page: Page, account = newAccount()) {
  await page.goto('/register')
  await page.getByLabel('Name').fill(account.name)
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('status')).toBeVisible()

  await page.goto(await verificationPath(account.email))
  await expect(page.getByText('Your email is confirmed')).toBeVisible()

  await page.goto('/login')
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  // The profile wizard has a few short pages before the baseline step offers "Skip for now".
  const skip = page.getByRole('button', { name: 'Skip for now' })
  const next = page.getByRole('button', { name: 'Next', exact: true })
  await page.waitForURL('**/onboarding')
  for (let i = 0; i < 6; i++) {
    // Wait out "Saving…" so the check sees either the next page or the baseline step.
    await expect(skip.or(next)).toBeVisible()
    if (await skip.isVisible()) break
    await next.click()
  }
  await skip.click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hello')
  return account
}
