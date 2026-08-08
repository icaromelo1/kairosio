// Fila de avisos toast — canto inferior direito, fora da coluna central do avatar.
// Erro cru (error.message) nunca chega na tela: toda falha de rede/fundo passa
// por aqui e vira aviso em português. Erro é persistente até o usuário fechar;
// aviso/ok somem sozinhos.
import { reactive } from 'vue'

export type TipoAviso = 'erro' | 'aviso' | 'ok'

export interface Aviso {
  id: number
  texto: string
  tipo: TipoAviso
}

const DURACAO_AUTO_MS: Record<Exclude<TipoAviso, 'erro'>, number> = {
  aviso: 5000,
  ok: 3500,
}

export const avisos = reactive<Aviso[]>([])

let proximoId = 1

export function mostrarAviso(texto: string, tipo: TipoAviso = 'erro'): number {
  const id = proximoId++
  avisos.push({ id, texto, tipo })
  if (tipo !== 'erro') {
    setTimeout(() => fecharAviso(id), DURACAO_AUTO_MS[tipo])
  }
  return id
}

export function fecharAviso(id: number): void {
  const idx = avisos.findIndex((a) => a.id === id)
  if (idx !== -1) avisos.splice(idx, 1)
}
