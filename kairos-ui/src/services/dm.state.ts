import { computed, nextTick, ref } from 'vue'
import {
  DM_INTERVALO_MIN_MS, DM_TEXTO_MAX, DmError,
  dmHistory, listConversas, markDmRead, sendDm,
  type DmConversa, type DmMensagem,
} from './dm.api'
import { listFriends, type FriendUser, type FriendView } from './friend.api'
import {
  dmUnread, onDmLido, onDmMessage, setDmUnread, syncDmUnread,
  type DmEntrega, type DmLeituraAviso,
} from './presence'

// Estado das conversas num singleton de módulo (mesmo padrão de presence.ts e
// media.ts). Não pode morar no componente: a barra lateral desmonta o conteúdo
// ao recolher, e recolher a barra pra olhar o mapa é justamente o que se faz no
// meio de uma conversa — o rascunho, o histórico e o cursor morreriam junto.

export interface LinhaConversa {
  conversaId: string
  userId: string
  nome: string
  handle: string
  previa: string
  quando: number
  naoLidas: number
}

export type ItemLog =
  | { tipo: 'dia'; chave: string; texto: string }
  | { tipo: 'marcador'; chave: string; texto: string }
  | { tipo: 'msg'; chave: string; id: string; texto: string; minha: boolean; hora: string; colado: boolean }
  | { tipo: 'vista'; chave: string; texto: string }

// A conta de scroll lê o DOM, então não entra aqui: a view registra este
// adaptador ao montar e limpa ao desmontar. Sem view, tudo vira no-op — que é o
// comportamento certo com a barra recolhida.
export interface VistaLog {
  noFim(): boolean
  irParaOFim(): void
  irParaMarcador(): void
  medir(): { altura: number; topo: number }
  restaurar(medida: { altura: number; topo: number }): void
  marcarNaoVista(): void
  // a página coube inteira na viewport: sem isto a conversa curta nunca puxaria
  // a página seguinte, porque a rolagem que dispara carregarMais nunca acontece
  cabeInteira(): boolean
}

const GRUPO_JANELA_MS = 5 * 60 * 1000
const LEITURA_ESPERA_MS = 400

export const conversas = ref<DmConversa[]>([])
export const amigos = ref<FriendView[]>([])
export const carregando = ref(false)
export const erro = ref('')

export const vista = ref<'lista' | 'conversa'>('lista')
export const alvoUserId = ref('')
export const abertaId = ref('')
export const mensagens = ref<DmMensagem[]>([])
export const cursor = ref<string | null>(null)
export const carregandoHistorico = ref(false)
export const carregandoMais = ref(false)
export const semConversaAberta = ref(false)

export const rascunho = ref('')
export const enviando = ref(false)
export const travado = ref(false)
export const erroEnvio = ref('')

// id da primeira mensagem não lida, congelado na abertura — o contador zera
// assim que a conversa abre, então guardar depois não adianta
const marcadorEm = ref('')
const marcadorQuantas = ref(0)
// quando o outro leu, por conversa; alimentado pela lista e pelo evento dmLido
const lidoPeloOutro = ref(new Map<string, number>())

let vistaLog: VistaLog | null = null
let pedido = 0
let leituraTimer = 0
let travaTimer = 0
let desassinarMensagem: (() => void) | null = null
let desassinarLeitura: (() => void) | null = null
let assinantes = 0

export const MENSAGENS: Record<string, string> = {
  'dm-sem-amizade': 'Vocês não são mais amigos — a conversa foi fechada.',
  'dm-rapido-demais': 'Calma: espere um instante antes de mandar outra mensagem.',
  'dm-texto-longo': `Mensagem longa demais — o máximo é ${DM_TEXTO_MAX} caracteres.`,
  'dm-vazia': 'Escreva alguma coisa antes de enviar.',
  'dm-consigo': 'Essa conversa seria com você mesmo.',
  'dm-not-found': 'Essa conversa não existe mais.',
  'dm-cursor-invalido': 'Não deu pra seguir o histórico daqui. Reabra a conversa.',
  'guest-no-friends': 'Convidado não tem conversas. Crie uma conta pra conversar.',
}

export function explicar(e: unknown): string {
  const code = e instanceof DmError ? e.code : ''
  return MENSAGENS[code] || (e as Error).message || 'Algo deu errado.'
}

function handleOf(user: FriendUser | null | undefined): string {
  return user?.username ? `@${user.username}` : '—'
}

function ms(iso: string | null | undefined): number {
  if (!iso) return 0
  const n = new Date(iso).getTime()
  return Number.isNaN(n) ? 0 : n
}

function quandoDe(conversa: DmConversa): number {
  return ms(conversa.ultimaMensagem?.enviadaEm ?? conversa.criadoEm)
}

function mesmoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function hora(iso: string): string {
  const data = new Date(iso)
  return Number.isNaN(data.getTime())
    ? ''
    : data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function rotuloDoDia(data: Date): string {
  const hoje = new Date()
  if (mesmoDia(data, hoje)) return 'hoje'
  const ontem = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1)
  if (mesmoDia(data, ontem)) return 'ontem'
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// só conversas — amigos sem thread ficam na seção recolhida, senão vinte amigos
// empurram as conversas de verdade pra fora da coluna
export const linhas = computed<LinhaConversa[]>(() => {
  const linhasDeConversa: LinhaConversa[] = []
  for (const conversa of conversas.value) {
    const usuario = conversa.usuario
    if (!usuario) continue
    const previa = conversa.ultimaMensagem
      ? `${conversa.ultimaMensagem.minha ? 'você: ' : ''}${conversa.ultimaMensagem.texto}`
      : ''
    linhasDeConversa.push({
      conversaId: conversa.id,
      userId: usuario.id,
      nome: usuario.nome || 'sem nome',
      handle: handleOf(usuario),
      previa,
      quando: quandoDe(conversa),
      naoLidas: dmUnread.get(conversa.id) ?? 0,
    })
  }
  return linhasDeConversa.sort((a, b) => b.quando - a.quando || a.nome.localeCompare(b.nome))
})

export const semConversa = computed<LinhaConversa[]>(() => {
  const comThread = new Set(linhas.value.map((linha) => linha.userId))
  const soltos: LinhaConversa[] = []
  for (const amigo of amigos.value) {
    const usuario = amigo.usuario
    if (!usuario || comThread.has(usuario.id)) continue
    soltos.push({
      conversaId: '',
      userId: usuario.id,
      nome: usuario.nome || 'sem nome',
      handle: handleOf(usuario),
      previa: '',
      quando: 0,
      naoLidas: 0,
    })
  }
  return soltos.sort((a, b) => a.nome.localeCompare(b.nome))
})

export const alvo = computed(
  () => linhas.value.find((linha) => linha.userId === alvoUserId.value)
    ?? semConversa.value.find((linha) => linha.userId === alvoUserId.value)
    ?? null,
)

export const podeEnviar = computed(
  () => !!alvoUserId.value && !!rascunho.value.trim() && !enviando.value && !travado.value,
)

export const outrasEsperando = computed(
  () => linhas.value.filter((linha) => linha.naoLidas > 0 && linha.conversaId !== abertaId.value).length,
)

// separador de dia, marcador de não lido, agrupamento por autor e o "vista às"
// resolvidos de uma vez: a view só percorre a lista pronta
export const itens = computed<ItemLog[]>(() => {
  const saida: ItemLog[] = []
  const lista = mensagens.value
  const visto = lidoPeloOutro.value.get(abertaId.value) ?? 0
  let ultimaMinha = -1
  for (let i = 0; i < lista.length; i++) if (lista[i].minha) ultimaMinha = i

  let anterior: DmMensagem | null = null
  let quebrado = false

  for (let i = 0; i < lista.length; i++) {
    const m = lista[i]
    const data = new Date(m.enviadaEm)
    const valida = !Number.isNaN(data.getTime())

    if (valida && (!anterior || !mesmoDia(new Date(anterior.enviadaEm), data))) {
      saida.push({ tipo: 'dia', chave: `dia-${m.id}`, texto: rotuloDoDia(data) })
      quebrado = true
    }
    if (marcadorQuantas.value > 0 && m.id === marcadorEm.value) {
      saida.push({
        tipo: 'marcador',
        chave: `novo-${m.id}`,
        texto: `novas · ${marcadorQuantas.value}`,
      })
      quebrado = true
    }

    const proxima = lista[i + 1]
    const mesmoGrupoQueAnterior = !quebrado
      && !!anterior
      && anterior.minha === m.minha
      && ms(m.enviadaEm) - ms(anterior.enviadaEm) <= GRUPO_JANELA_MS
    // horário só no último balão do grupo — vinte horários iguais é ruído
    const fechaGrupo = !proxima
      || proxima.minha !== m.minha
      || ms(proxima.enviadaEm) - ms(m.enviadaEm) > GRUPO_JANELA_MS
      || (valida && !mesmoDia(data, new Date(proxima.enviadaEm)))
      || (marcadorQuantas.value > 0 && proxima.id === marcadorEm.value)

    saida.push({
      tipo: 'msg',
      chave: m.id,
      id: m.id,
      texto: m.texto,
      minha: m.minha,
      hora: fechaGrupo ? hora(m.enviadaEm) : '',
      colado: mesmoGrupoQueAnterior,
    })

    // "vista" só sob a ÚLTIMA mensagem minha, nunca uma por balão
    if (i === ultimaMinha && visto > 0 && visto >= ms(m.enviadaEm)) {
      saida.push({
        tipo: 'vista',
        chave: `vista-${m.id}`,
        texto: `vista às ${hora(new Date(visto).toISOString())}`,
      })
    }

    anterior = m
    quebrado = false
  }

  return saida
})

export function registrarVista(adaptador: VistaLog | null) {
  vistaLog = adaptador
}

// marcar como lida exige que a conversa esteja MESMO à vista: sem isto, mensagem
// que chega com a barra recolhida ou em modo mundos seria zerada sem ninguém ver
function estaAVista(): boolean {
  return !!vistaLog && vista.value === 'conversa' && document.visibilityState === 'visible'
}

function adotar(lista: DmConversa[]) {
  conversas.value = lista
  syncDmUnread(lista)
  // o poll de 60s da barra repovoa o mapa inteiro; sem esta linha o badge da
  // conversa aberta ressuscita toda vez que o poll corre junto do markDmRead
  if (abertaId.value && estaAVista()) setDmUnread(abertaId.value, 0)
  for (const conversa of lista) {
    const quando = ms(conversa.lidoPeloOutroEm)
    if (quando) lidoPeloOutro.value.set(conversa.id, quando)
  }
}

export async function carregarTudo() {
  carregando.value = true
  erro.value = ''
  try {
    const [lista, meusAmigos] = await Promise.all([listConversas(), listFriends()])
    adotar(lista)
    amigos.value = meusAmigos
  } catch (e) {
    erro.value = explicar(e)
  } finally {
    carregando.value = false
  }
}

export async function recarregarConversas() {
  try {
    adotar(await listConversas())
  } catch {}
}

export function voltarParaLista() {
  vista.value = 'lista'
  erroEnvio.value = ''
}

export async function abrir(linha: LinhaConversa) {
  const meu = ++pedido
  vista.value = 'conversa'
  // trocar de tela é separado de trocar de conversa: sem isso, voltar pra lista
  // e reabrir a mesma pessoa cairia num early-return e a tela não mudaria
  if (linha.userId === alvoUserId.value && mensagens.value.length) {
    await nextTick()
    vistaLog?.irParaOFim()
    return
  }
  alvoUserId.value = linha.userId
  abertaId.value = linha.conversaId
  mensagens.value = []
  cursor.value = null
  marcadorEm.value = ''
  marcadorQuantas.value = 0
  erroEnvio.value = ''
  rascunho.value = ''
  semConversaAberta.value = !linha.conversaId
  if (!linha.conversaId) return

  const naoLidas = dmUnread.get(linha.conversaId) ?? 0
  const conversa = conversas.value.find((row) => row.id === linha.conversaId)
  const meuUltimoOlhar = ms(conversa?.lidoEm)

  carregandoHistorico.value = true
  try {
    const pagina = await dmHistory(linha.conversaId)
    if (meu !== pedido) return
    mensagens.value = [...pagina.mensagens].reverse()
    cursor.value = pagina.proximoCursor
    posicionarMarcador(naoLidas, meuUltimoOlhar)
    await nextTick()
    if (marcadorQuantas.value > 0) vistaLog?.irParaMarcador()
    else vistaLog?.irParaOFim()
    void marcarLida(linha.conversaId)
    if (cursor.value && vistaLog?.cabeInteira()) void carregarMais()
  } catch (e) {
    if (meu !== pedido) return
    if (!fechouPorAmizade(e)) erro.value = explicar(e)
  } finally {
    if (meu === pedido) carregandoHistorico.value = false
  }
}

// a primeira mensagem do outro lado que chegou depois do meu último olhar — a
// posição vem de lidoEm, exata; a contagem vem do naoLidas que a API já devolve
function posicionarMarcador(naoLidas: number, meuUltimoOlhar: number) {
  marcadorEm.value = ''
  marcadorQuantas.value = 0
  if (naoLidas <= 0) return
  const primeira = mensagens.value.find(
    (m) => !m.minha && (!meuUltimoOlhar || ms(m.enviadaEm) > meuUltimoOlhar),
  )
  // a não lida mais antiga pode estar numa página que ainda não carregou
  if (!primeira) return
  marcadorEm.value = primeira.id
  marcadorQuantas.value = naoLidas
}

export async function carregarMais() {
  const conversaId = abertaId.value
  if (!cursor.value || carregandoMais.value || !conversaId) return
  const meu = pedido
  carregandoMais.value = true
  try {
    const pagina = await dmHistory(conversaId, cursor.value)
    if (meu !== pedido || conversaId !== abertaId.value) return
    const medida = vistaLog?.medir()
    mensagens.value = [...[...pagina.mensagens].reverse(), ...mensagens.value]
    cursor.value = pagina.proximoCursor
    await nextTick()
    if (medida) vistaLog?.restaurar(medida)
  } catch (e) {
    if (meu !== pedido) return
    if (!fechouPorAmizade(e)) erro.value = explicar(e)
  } finally {
    carregandoMais.value = false
  }
}

function agendarLeitura(conversaId: string) {
  window.clearTimeout(leituraTimer)
  leituraTimer = window.setTimeout(() => { void marcarLida(conversaId) }, LEITURA_ESPERA_MS)
}

export async function marcarLida(conversaId: string) {
  setDmUnread(conversaId, 0)
  const conversa = conversas.value.find((row) => row.id === conversaId)
  if (conversa) conversa.naoLidas = 0
  try {
    await markDmRead(conversaId)
  } catch {}
}

function travar() {
  travado.value = true
  window.clearTimeout(travaTimer)
  travaTimer = window.setTimeout(() => { travado.value = false }, DM_INTERVALO_MIN_MS)
}

function fechouPorAmizade(e: unknown): boolean {
  const code = e instanceof DmError ? e.code : ''
  if (code !== 'dm-sem-amizade' && code !== 'dm-not-found') return false
  pedido += 1
  alvoUserId.value = ''
  abertaId.value = ''
  mensagens.value = []
  cursor.value = null
  vista.value = 'lista'
  erro.value = MENSAGENS[code]
  void carregarTudo()
  return true
}

function aplicarPrevia(mensagem: DmMensagem, minha: boolean) {
  const conversa = conversas.value.find((row) => row.id === mensagem.conversaId)
  if (!conversa) {
    void recarregarConversas()
    return
  }
  conversa.ultimaMensagem = {
    texto: mensagem.texto,
    autorId: mensagem.autorId,
    minha,
    enviadaEm: mensagem.enviadaEm,
  }
}

export async function enviar() {
  const texto = rascunho.value.trim()
  const destino = alvoUserId.value
  if (!texto || !destino || enviando.value || travado.value) return
  if (texto.length > DM_TEXTO_MAX) {
    erroEnvio.value = MENSAGENS['dm-texto-longo']
    return
  }
  const meu = pedido
  enviando.value = true
  erroEnvio.value = ''
  try {
    const mensagem = await sendDm(destino, texto)
    travar()
    if (meu !== pedido) return
    rascunho.value = ''
    if (!abertaId.value) {
      abertaId.value = mensagem.conversaId
      semConversaAberta.value = false
      void recarregarConversas()
    }
    if (mensagem.conversaId === abertaId.value && !mensagens.value.some((m) => m.id === mensagem.id)) {
      mensagens.value.push(mensagem)
    }
    aplicarPrevia(mensagem, true)
    // responder encerra o marcador: você já viu o que tinha de novo
    marcadorEm.value = ''
    marcadorQuantas.value = 0
    await nextTick()
    vistaLog?.irParaOFim()
  } catch (e) {
    if (meu !== pedido) return
    if (e instanceof DmError && e.code === 'dm-rapido-demais') travar()
    if (!fechouPorAmizade(e)) erroEnvio.value = explicar(e)
  } finally {
    enviando.value = false
  }
}

async function receber(entrega: DmEntrega) {
  aplicarPrevia(entrega.mensagem, false)
  if (!abertaId.value && entrega.de?.id === alvoUserId.value) abertaId.value = entrega.conversaId
  if (entrega.conversaId !== abertaId.value) return
  if (mensagens.value.some((m) => m.id === entrega.mensagem.id)) return

  const prender = vistaLog ? vistaLog.noFim() : true
  mensagens.value.push(entrega.mensagem)
  if (!estaAVista()) return
  setDmUnread(entrega.conversaId, 0)
  agendarLeitura(entrega.conversaId)
  await nextTick()
  if (prender) vistaLog?.irParaOFim()
  else vistaLog?.marcarNaoVista()
}

function receberLeitura(aviso: DmLeituraAviso) {
  const quando = ms(aviso.lidoEm)
  if (!quando) return
  lidoPeloOutro.value.set(aviso.conversaId, quando)
  const conversa = conversas.value.find((row) => row.id === aviso.conversaId)
  if (conversa) conversa.lidoPeloOutroEm = aviso.lidoEm
}

// contagem de assinantes: a barra e a view podem entrar e sair, mas o socket
// tem um dono só e não pode ser derrubado enquanto alguém ainda escuta
export function assinarDm() {
  assinantes += 1
  if (assinantes > 1) return
  desassinarMensagem = onDmMessage((entrega) => { void receber(entrega) })
  desassinarLeitura = onDmLido(receberLeitura)
}

export function desassinarDm() {
  assinantes = Math.max(0, assinantes - 1)
  if (assinantes > 0) return
  desassinarMensagem?.()
  desassinarLeitura?.()
  desassinarMensagem = null
  desassinarLeitura = null
  window.clearTimeout(leituraTimer)
  window.clearTimeout(travaTimer)
}

export async function abrirConversaDe(userId: string) {
  if (!conversas.value.length && !carregando.value) await carregarTudo()
  const linha = linhas.value.find((l) => l.userId === userId)
    ?? semConversa.value.find((l) => l.userId === userId)
  if (linha) await abrir(linha)
  else vista.value = 'lista'
}

// o atalho do badge: a não lida mais recente. Como o número some quando não há
// nada não lido, o atalho nunca leva a lugar vazio
export async function abrirNaoLidaMaisRecente() {
  if (!conversas.value.length && !carregando.value) await carregarTudo()
  const alvoLinha = linhas.value.find((linha) => linha.naoLidas > 0)
  if (alvoLinha) await abrir(alvoLinha)
  else vista.value = 'lista'
}

