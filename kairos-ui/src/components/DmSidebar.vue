<template>
  <div class="dms" data-captura-teclado>
    <section v-if="auth.isGuest" class="dms-guest">
      <h3 class="dms-guest-title"><PixelIcon name="lock" size="0.9375rem" />Conversar precisa de conta</h3>
      <p class="k-hint-text">
        Convidado não tem amigos nem conversa: a conta é apagada quando você sai, e a mensagem
        ficaria guardada apontando pra alguém que deixou de existir. Com uma conta você ganha um
        <b>@nome</b> fixo, e a conversa fica salva.
      </p>
      <button class="k-btn k-btn-ghost k-btn-sm" @click="router.push('/register')">Criar conta →</button>
    </section>

    <template v-else-if="vista === 'lista'">
      <header class="dms-head">
        <button class="k-btn k-btn-ghost k-btn-xs dms-back" @click="emit('sair')">
          <PixelIcon name="corner-up-left" size="0.6875rem" />mundos
        </button>
        <span class="k-label dms-head-titulo">conversas</span>
        <span v-if="linhas.length" class="dms-head-conta">{{ linhas.length }}</span>
      </header>

      <div class="dms-rolo">
        <p v-if="erro" class="dms-erro">{{ erro }}</p>

        <ul class="dms-convs">
          <li v-for="linha in linhas" :key="linha.userId">
            <button
              class="dms-conv"
              :class="{ 'dms-conv-unread': linha.naoLidas > 0 }"
              @click="abrir(linha)"
            >
              <span class="dms-conv-top">
                <span class="dms-conv-name ellipsis">{{ linha.nome }}</span>
                <span class="dms-conv-hora">{{ quando(linha.quando) }}</span>
              </span>
              <span class="dms-conv-fim">
                <span class="dms-conv-previa ellipsis">{{ linha.previa || 'nunca conversaram' }}</span>
                <span v-if="linha.naoLidas" class="dms-conv-badge">{{ linha.naoLidas }}</span>
              </span>
            </button>
          </li>

          <li v-if="carregando" class="dms-vazio">carregando…</li>
          <li v-else-if="!linhas.length" class="dms-vazio">
            Nenhuma conversa ainda. Abra “sem conversa” abaixo pra começar uma.
          </li>
        </ul>

        <div v-if="semConversa.length" class="dms-soltos">
          <button class="dms-soltos-cab" @click="soltosAbertos = !soltosAbertos">
            <PixelIcon :name="soltosAbertos ? 'chevron-down' : 'chevron-right'" size="0.625rem" />
            <span class="k-label">sem conversa</span>
            <span class="dms-soltos-conta">{{ semConversa.length }}</span>
          </button>
          <ul v-if="soltosAbertos" class="dms-convs">
            <li v-for="linha in semConversa" :key="linha.userId">
              <button class="dms-conv dms-conv-solto" @click="abrir(linha)">
                <span class="dms-conv-name ellipsis">{{ linha.nome }}</span>
                <span class="dms-conv-handle ellipsis">{{ linha.handle }}</span>
              </button>
            </li>
          </ul>
        </div>
      </div>

      <p class="k-hint-text dms-dica">Esc volta aos mundos. Nenhuma conversa abre sozinha.</p>
    </template>

    <template v-else>
      <header class="dms-head">
        <button class="k-btn k-btn-ghost k-btn-xs dms-back" title="voltar às conversas" @click="voltarParaLista">
          <PixelIcon name="corner-up-left" size="0.6875rem" />{{ outrasEsperando || '' }}
        </button>
        <span class="dms-alvo">
          <span class="dms-alvo-nome ellipsis">{{ alvo?.nome || '…' }}</span>
          <span class="dms-alvo-onde ellipsis">{{ ondeEsta }}</span>
        </span>
        <button
          v-if="posicaoDoAlvo"
          class="k-btn k-btn-ghost k-btn-xs dms-andar"
          title="andar até essa pessoa"
          @click="andarAte"
        >andar até</button>
      </header>

      <p v-if="erro" class="dms-erro">{{ erro }}</p>

      <div ref="log" class="dms-log" @scroll="aoRolar">
        <button
          v-if="cursor"
          class="k-btn k-btn-ghost k-btn-xs dms-mais"
          :disabled="carregandoMais"
          @click="carregarMais"
        >{{ carregandoMais ? 'carregando…' : 'mensagens antigas' }}</button>
        <p v-else-if="mensagens.length" class="dms-nota">começo da conversa</p>
        <p v-else-if="carregandoHistorico" class="dms-nota">carregando…</p>
        <p v-else-if="semConversaAberta" class="dms-nota">nunca conversaram — mande a primeira</p>

        <template v-for="item in itens" :key="item.chave">
          <p v-if="item.tipo === 'dia'" class="dms-dia">{{ item.texto }}</p>

          <p v-else-if="item.tipo === 'marcador'" :ref="prenderMarcador" class="dms-marcador">
            <span class="dms-marcador-chip">{{ item.texto }}</span>
          </p>

          <p v-else-if="item.tipo === 'vista'" class="dms-visto">{{ item.texto }}</p>

          <div
            v-else
            class="dms-msg"
            :class="{ 'dms-msg-minha': item.minha, 'dms-msg-colada': item.colado }"
          >
            <span class="dms-msg-texto">{{ item.texto }}</span>
            <span v-if="item.hora" class="dms-msg-hora">{{ item.hora }}</span>
          </div>
        </template>
      </div>

      <div class="dms-pe">
        <button v-if="naoVista" class="dms-pular" @click="irParaOFim">
          novas mensagens<PixelIcon name="arrow-down" size="0.6875rem" />
        </button>
        <span
          v-if="rascunho.length > DM_CONTADOR_A_PARTIR"
          class="dms-conta"
          :class="{ 'dms-conta-max': rascunho.length >= DM_TEXTO_MAX }"
        >{{ rascunho.length }}/{{ DM_TEXTO_MAX }}</span>
      </div>

      <p v-if="erroEnvio" class="dms-erro">{{ erroEnvio }}</p>

      <form class="dms-envio" @submit.prevent="enviar">
        <textarea
          ref="campo"
          v-model="rascunho"
          class="k-input dms-input"
          rows="2"
          :maxlength="DM_TEXTO_MAX"
          placeholder="Escreva… (Enter envia)"
          @keydown.enter.exact.prevent="enviar"
        />
        <button class="k-btn k-btn-sm dms-enviar" type="submit" :disabled="!podeEnviar">
          {{ enviando ? 'enviando…' : 'enviar' }}
        </button>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { DM_CONTADOR_A_PARTIR, DM_TEXTO_MAX } from '@/services/dm.api'
import {
  abrir, alvo, carregando, carregandoHistorico, carregandoMais, carregarMais, carregarTudo,
  cursor, enviando, enviar, erro, erroEnvio, itens, linhas, mensagens, podeEnviar,
  rascunho, registrarVista, semConversa, semConversaAberta, outrasEsperando,
  voltarParaLista, vista, type VistaLog,
} from '@/services/dm.state'
import { remotePlayers } from '@/services/presence'
import { useAuthStore } from '@/stores/useAuthStore'
import { useGameStore } from '@/stores/useGameStore'
import PixelIcon from '@/components/PixelIcon.vue'

const props = defineProps<{ mapaAtual: string }>()
const emit = defineEmits<{ sair: []; andar: [x: number, y: number] }>()

const router = useRouter()
const auth = useAuthStore()
const gameStore = useGameStore()

const log = ref<HTMLElement | null>(null)
const campo = ref<HTMLTextAreaElement | null>(null)
const marcador = ref<HTMLElement | null>(null)
const naoVista = ref(false)
const soltosAbertos = ref(false)

const FIM_FOLGA = 24
const TOPO_FOLGA = 48

function prenderMarcador(el: unknown) {
  marcador.value = el instanceof HTMLElement ? el : null
}

const adaptador: VistaLog = {
  noFim() {
    const el = log.value
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight <= FIM_FOLGA
  },
  irParaOFim() {
    const el = log.value
    if (el) el.scrollTop = el.scrollHeight
    naoVista.value = false
  },
  irParaMarcador() {
    const el = log.value
    const alvoEl = marcador.value
    if (!el || !alvoEl) { adaptador.irParaOFim(); return }
    // duas mensagens lidas acima do marcador dão contexto do que veio antes
    el.scrollTop = Math.max(0, alvoEl.offsetTop - el.offsetTop - 72)
    naoVista.value = false
  },
  medir() {
    const el = log.value
    return { altura: el ? el.scrollHeight : 0, topo: el ? el.scrollTop : 0 }
  },
  restaurar(medida) {
    const el = log.value
    if (el) el.scrollTop = el.scrollHeight - medida.altura + medida.topo
  },
  marcarNaoVista() {
    naoVista.value = true
  },
  cabeInteira() {
    const el = log.value
    return !!el && el.scrollHeight <= el.clientHeight
  },
}

function irParaOFim() {
  adaptador.irParaOFim()
}

function aoRolar() {
  const el = log.value
  if (!el) return
  if (adaptador.noFim()) naoVista.value = false
  if (el.scrollTop <= TOPO_FOLGA) void carregarMais()
}

function devolverTeclado() {
  campo.value?.blur()
}

// escada do Esc: campo focado devolve o teclado ao jogo; campo já sem foco recua
// conversa → lista → mundos. Ao perder o foco o alvo do keydown vira <body>, que
// não tem data-captura-teclado — o onKeyDown global do GamePage deixaria de
// ignorar o Esc e chamaria o closeModal dele. Por isso o listener aqui é em
// capture:true (roda antes de qualquer bubble-phase em window) e chama
// stopPropagation, garantindo que só esta escada trata o Esc enquanto a
// barra de DM está montada.
function aoEscGlobal(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  // com um painel aberto por cima do mapa, o Esc é dele: este listener é global e
  // em fase de captura, então sem esta guarda ele engoliria o fechar do painel
  if (gameStore.isModalOpen) return
  e.preventDefault()
  e.stopPropagation()
  if (document.activeElement === campo.value) devolverTeclado()
  else if (vista.value === 'conversa') voltarParaLista()
  else emit('sair')
}

function quando(ms: number): string {
  if (!ms) return ''
  const data = new Date(ms)
  const agora = new Date()
  const mesmoDia = data.toDateString() === agora.toDateString()
  if (mesmoDia) return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const ontem = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1)
  if (data.toDateString() === ontem.toDateString()) return 'ontem'
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

const posicaoDoAlvo = computed(() => {
  const userId = alvo.value?.userId
  if (!userId) return null
  for (const p of remotePlayers.values()) {
    if (p.userId === userId && p.map === props.mapaAtual) return { x: p.x, y: p.y }
  }
  return null
})

const ondeEsta = computed(() => {
  if (!alvo.value) return ''
  return posicaoDoAlvo.value ? 'neste mundo' : alvo.value.handle
})

function andarAte() {
  const pos = posicaoDoAlvo.value
  if (pos) emit('andar', pos.x, pos.y)
}

// a conversa continua viva com a barra recolhida, mas o scroller é novo a cada
// remontagem — sem isto ela reabre no topo em vez de onde a pessoa parou
watch(vista, async (v) => {
  if (v !== 'conversa') return
  await new Promise(requestAnimationFrame)
  adaptador.irParaOFim()
  campo.value?.focus()
})

onMounted(() => {
  registrarVista(adaptador)
  window.addEventListener('keydown', aoEscGlobal, true)
  if (auth.isGuest) return
  if (!linhas.value.length && !carregando.value) void carregarTudo()
  if (vista.value === 'conversa') requestAnimationFrame(() => adaptador.irParaOFim())
})

onUnmounted(() => {
  registrarVista(null)
  window.removeEventListener('keydown', aoEscGlobal, true)
})
</script>

<style scoped>
.dms {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  gap: 0.375rem;
  padding: 0.5rem 0.5rem 0;
}

.dms-guest {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--bg-1);
  border: var(--ui-border-style);
}

.dms-guest-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 0.875rem;
}

.dms-head {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding-bottom: 0.375rem;
  border-bottom: 0.125rem solid var(--tinta);
  flex: none;
}

.dms-back {
  flex: none;
  gap: 0.25rem;
}

.dms-head-titulo {
  flex: 1;
}

.dms-head-conta,
.dms-soltos-conta {
  font-family: var(--f-num);
  font-size: 0.75rem;
  color: var(--text-3);
}

.dms-alvo {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.dms-alvo-nome {
  font-size: 0.8125rem;
  font-weight: 700;
}

.dms-alvo-onde {
  font-family: var(--f-sans);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-3);
}

.dms-andar {
  flex: none;
}

.dms-rolo {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.dms-convs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.dms-conv {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.4375rem 0.5rem;
  background: none;
  border: 0.125rem solid transparent;
  border-bottom-color: var(--border);
  color: var(--text-2);
  text-align: left;
  cursor: pointer;
}

.dms-conv:hover {
  background: var(--bg-2);
  color: var(--text);
}

.dms-conv-top,
.dms-conv-fim {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.dms-conv-name {
  flex: 1;
  font-size: 0.8125rem;
  font-weight: 600;
}

.dms-conv-unread .dms-conv-name {
  font-weight: 700;
  color: var(--text);
}

.dms-conv-hora {
  flex: none;
  font-family: var(--f-num);
  font-size: 0.6875rem;
  color: var(--text-3);
}

.dms-conv-previa {
  flex: 1;
  font-size: 0.6875rem;
  color: var(--text-3);
}

.dms-conv-unread .dms-conv-previa {
  color: var(--text-2);
  font-weight: 600;
}

.dms-conv-badge {
  flex: none;
  min-width: 1rem;
  padding: 0 0.25rem;
  background: var(--accent);
  border: 0.125rem solid var(--tinta);
  color: var(--tinta);
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  line-height: 0.875rem;
  text-align: center;
}

.dms-conv-handle {
  font-family: var(--f-sans);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-3);
}

.dms-soltos {
  border-top: 0.125rem solid var(--border);
  margin-top: 0.25rem;
}

.dms-soltos-cab {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4375rem 0.5rem;
  background: none;
  border: 0;
  color: var(--text-3);
  cursor: pointer;
}

.dms-soltos-cab:hover {
  color: var(--text);
}

.dms-soltos-cab .k-label {
  flex: 1;
  text-align: left;
}

.dms-log {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 0.25rem;
}

.dms-mais {
  align-self: center;
  margin-bottom: 0.5rem;
}

.dms-nota {
  align-self: center;
  margin: 0 0 0.5rem;
  font-size: 0.6875rem;
  color: var(--text-3);
  text-align: center;
}

.dms-dia {
  align-self: stretch;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.5rem 0;
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-3);
}

/* tracejado: "o tempo passou" — deliberadamente diferente do marcador sólido */
.dms-dia::before,
.dms-dia::after {
  content: '';
  flex: 1;
  height: 0.125rem;
  background-image: repeating-linear-gradient(90deg, var(--border) 0 0.25rem, transparent 0.25rem 0.5rem);
}

.dms-marcador {
  align-self: stretch;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.625rem 0;
}

/* linha sólida + chip âmbar: "você parou aqui" */
.dms-marcador::before,
.dms-marcador::after {
  content: '';
  flex: 1;
  height: 0.125rem;
  background: rgba(36, 28, 21, 0.55);
}

.dms-marcador-chip {
  padding: 0.125rem 0.5rem;
  background: var(--accent);
  border: 0.125rem solid var(--tinta);
  color: var(--tinta);
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.dms-msg {
  max-width: 88%;
  align-self: flex-start;
  display: flex;
  align-items: flex-end;
  gap: 0.375rem;
  margin-top: 0.75rem;
  padding: 0.3125rem 0.5rem;
  background: var(--bg-2);
  border: 0.125rem solid rgba(36, 28, 21, 0.35);
  font-size: 0.8125rem;
  line-height: 1.4;
  color: var(--text);
}

.dms-msg-colada {
  margin-top: 0.125rem;
}

/* a mensagem minha assina com a barra musgo à direita, como o ToggleRow ligado —
   trocar o fundo inteiro brigaria com o balão do outro no mesmo creme */
.dms-msg-minha {
  align-self: flex-end;
  box-shadow: inset -0.25rem 0 0 var(--primary);
}

.dms-msg-texto {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.dms-msg-hora {
  flex: none;
  font-family: var(--f-num);
  font-size: 0.6875rem;
  color: var(--text-3);
}

.dms-visto {
  align-self: flex-end;
  margin: 0.1875rem 0 0;
  font-size: 0.6875rem;
  color: var(--text-3);
}

.dms-pe {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 1rem;
  flex: none;
}

.dms-pular {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.375rem;
  background: none;
  border: 0.125rem solid var(--accent-lo);
  color: var(--accent-texto);
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  text-transform: uppercase;
  cursor: pointer;
}

.dms-pular:hover {
  background: var(--accent-glow);
}

.dms-conta {
  margin-left: auto;
  font-family: var(--f-num);
  font-size: 0.75rem;
  color: var(--text-3);
}

.dms-conta-max {
  color: var(--err);
}

.dms-envio {
  display: flex;
  align-items: flex-end;
  gap: 0.375rem;
  padding-bottom: 0.5rem;
  flex: none;
}

.k-input.dms-input {
  flex: 1;
  min-width: 0;
  font-family: var(--f-sans);
  font-size: 0.8125rem;
  resize: none;
}

.dms-enviar {
  flex: none;
}

.dms-dica {
  flex: none;
  margin: 0;
  padding: 0.375rem 0.5rem 0.5rem;
  text-align: center;
}

.dms-vazio {
  padding: 0.75rem 0.5rem;
  font-size: 0.6875rem;
  color: var(--text-3);
}

.dms-erro {
  margin: 0;
  padding: 0 0.5rem;
  font-size: 0.75rem;
  color: var(--err);
  flex: none;
}
</style>
