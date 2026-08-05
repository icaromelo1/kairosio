// Wrapper de fetch pra API do kairos — prefixa /kairos-api e injeta o JWT do
// authStore no header Authorization quando houver sessão. Base da Etapa 1/2.
import { useAuthStore } from '@/stores/useAuthStore'

const API_URL = import.meta.env.VITE_API_URL || window.location.origin

export async function apiFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const auth = useAuthStore()
  const headers = new Headers(opts.headers)
  if (auth.token) headers.set('Authorization', `Bearer ${auth.token}`)
  // FormData (upload de arquivo) não pode ter Content-Type manual — o browser
  // define o boundary do multipart sozinho; setar "application/json" quebraria o upload.
  if (opts.body && !(opts.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const res = await fetch(`${API_URL}/kairos-api${path}`, { ...opts, headers })
  if (res.status === 401 && auth.token) encerrarSessaoRejeitada()
  return res
}

let encerrando = false

function encerrarSessaoRejeitada() {
  if (encerrando) return
  encerrando = true
  useAuthStore().logout()
  const base = import.meta.env.BASE_URL || '/'
  const destino = `${base.endsWith('/') ? base : base + '/'}login`
  if (window.location.pathname !== destino) window.location.replace(destino)
}
