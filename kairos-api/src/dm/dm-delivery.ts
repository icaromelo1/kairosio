import { Injectable } from '@nestjs/common'
import { Perfil } from '../friend/friend.service'

export interface DmMensagemView {
  id: string
  conversaId: string
  autorId: string
  minha: boolean
  texto: string
  enviadaEm: Date
}

export interface DmEntrega {
  paraUserId: string
  conversaId: string
  de: Perfil | null
  naoLidas: number
  mensagem: DmMensagemView
}

type Ouvinte = (entrega: DmEntrega) => void

@Injectable()
export class DmDelivery {
  private ouvinte: Ouvinte | null = null

  register(ouvinte: Ouvinte) {
    this.ouvinte = ouvinte
  }

  entregar(entrega: DmEntrega) {
    try {
      this.ouvinte?.(entrega)
    } catch {}
  }
}
