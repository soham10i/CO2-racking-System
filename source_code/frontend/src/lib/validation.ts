import { z } from 'zod'

// Messages are i18n keys (lib/locales); forms translate them when they render the error.
export const email = z.string().trim().min(1, 'v.emailRequired').email('v.emailInvalid').max(254)

/** Length-first, matches the server policy (the server stays the authority). */
export const newPassword = z.string().min(12, 'v.passwordShort').max(128, 'v.passwordLong')
