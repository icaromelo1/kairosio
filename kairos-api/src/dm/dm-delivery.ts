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

export interface DmLeitura {
  paraUserId: string
  conversaId: string
  lidoEm: Date
}

type Ouvinte = (entrega: DmEntrega) => void
type OuvinteLeitura = (leitura: DmLeitura) => void

@Injectable()
export class DmDelivery {
  private ouvinte: Ouvinte | null = null
  private ouvinteLeitura: OuvinteLeitura | null = null

  register(ouvinte: Ouvinte) {
    this.ouvinte = ouvinte
  }

  registerLeitura(ouvinte: OuvinteLeitura) {
    this.ouvinteLeitura = ouvinte
  }

  entregar(entrega: DmEntrega) {
    try {
      this.ouvinte?.(entrega)
    } catch {}
  }

  // avisa o AUTOR que o outro lado leu — sem isto o "vista às hh:mm" só
  // apareceria no próximo recarregamento da lista, que é pior que não ter
  leu(leitura: DmLeitura) {
    try {
      this.ouvinteLeitura?.(leitura)
    } catch {}
  }
}
