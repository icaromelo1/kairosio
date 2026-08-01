export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 20
export const USERNAME_CHANGE_COOLDOWN_DAYS = 30

export const RESERVED_USERNAMES = ['admin', 'kairos', 'suporte', 'sistema', 'moderador', 'eu']

const ALLOWED_CHARS = /^[A-Za-z0-9._]+$/

export type UsernameProblem = 'formato' | 'reservado'

export function normalizeUsername(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase()
}

export function displayUsername(raw: unknown): string {
  return String(raw ?? '').trim()
}

export function checkUsername(raw: unknown): UsernameProblem | null {
  const value = displayUsername(raw)
  if (value.length < USERNAME_MIN_LENGTH || value.length > USERNAME_MAX_LENGTH) return 'formato'
  if (!ALLOWED_CHARS.test(value)) return 'formato'
  if (value.startsWith('.') || value.endsWith('.')) return 'formato'
  if (value.includes('..')) return 'formato'
  if (RESERVED_USERNAMES.includes(value.toLowerCase())) return 'reservado'
  return null
}

export function nextUsernameChangeAt(changedAt: Date | null | undefined): Date | null {
  if (!changedAt) return null
  const next = new Date(changedAt)
  next.setDate(next.getDate() + USERNAME_CHANGE_COOLDOWN_DAYS)
  return next
}
