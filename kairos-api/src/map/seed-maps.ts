// Mapas oficiais semeados no banco. O boot sobrescreve a partir daqui, entao
// correcao de mundo oficial chega em producao. Mundo oficial nao e editavel no
// jogo, entao nao ha trabalho de usuario para descartar.
import { CIDADE } from './cidade'
import { VILA } from './vila'

export const SEED_MAPS = [CIDADE, VILA]
