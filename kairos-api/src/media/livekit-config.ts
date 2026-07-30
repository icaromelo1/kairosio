// Fonte única da config do LiveKit. A chave e o segredo só assinam o token aqui
// no servidor — nunca saem na resposta; pro cliente vai só o JWT e a URL pública.
export interface LivekitConfig {
  apiKey: string
  apiSecret: string
  url: string
}

export function livekitConfig(): LivekitConfig {
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const url = process.env.LIVEKIT_URL
  if (apiKey && apiSecret && url) return { apiKey, apiSecret, url }

  const missing: string[] = []
  if (!apiKey) missing.push('LIVEKIT_API_KEY')
  if (!apiSecret) missing.push('LIVEKIT_API_SECRET')
  if (!url) missing.push('LIVEKIT_URL')

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`LiveKit não configurado em produção — faltando: ${missing.join(', ')}`)
  }
  throw new Error(
    `LiveKit não configurado — defina ${missing.join(', ')} no .env da kairos-api ` +
      '(ex: LIVEKIT_URL=wss://livekit.icaromelodev.com.br)',
  )
}
