export type Provedor = 'google' | 'github'

export interface PerfilOAuth {
  provedor: Provedor
  id: string
  email: string | null
}

export function provedoresAtivos(): Record<Provedor, boolean> {
  return {
    google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    github: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
  }
}
