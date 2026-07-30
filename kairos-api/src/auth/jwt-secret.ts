// Fonte única do segredo JWT (assinatura no auth.module, verificação no
// jwt.strategy e no handshake do presence.gateway). Em produção a env é
// obrigatória — sem fallback silencioso assinável por qualquer um.
export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET não definido em produção')
  }
  return 'kairos-dev-secret'
}
