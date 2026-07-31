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
  // quem deve receber; o gateway é que sabe traduzir isso em socket (userSocket)
  paraUserId: string
  conversaId: string
  de: Perfil | null
  naoLidas: number
  mensagem: DmMensagemView
}

type Ouvinte = (entrega: DmEntrega) => void

// costura com o socket sem o módulo de mensagens conhecer o gateway: o DmService grava e
// anuncia aqui, e quem entrega de fato (PresenceGateway, que tem a conexão de todo mundo)
// se registra. Sem ouvinte registrado, a mensagem continua gravada e chega pelo histórico.
@Injectable()
export class DmDelivery {
  private ouvinte: Ouvinte | null = null

  register(ouvinte: Ouvinte) {
    this.ouvinte = ouvinte
  }

  entregar(entrega: DmEntrega) {
    // entrega em tempo real é acessório: falhar aqui não pode desfazer o que já foi gravado
    try {
      this.ouvinte?.(entrega)
    } catch {
      /* ignora */
    }
  }
}
