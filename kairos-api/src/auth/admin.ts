// Allowlist de admins do produto (status de feedback, sync do jukebox).
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'icarodmelof@gmail.com')
  .split(',')
  .map((e) => e.trim().toLowerCase())

export function isAdminEmail(email: string | null | undefined): boolean {
  return ADMIN_EMAILS.includes((email || '').toLowerCase())
}
