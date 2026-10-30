import { z } from 'zod'

export const email = z.string().trim().min(1, 'Enter your email').email('Enter a valid email').max(254)

/** Length-first, matches the server policy (the server stays the authority). */
export const newPassword = z.string().min(12, 'Use at least 12 characters').max(128, 'Use at most 128 characters')
