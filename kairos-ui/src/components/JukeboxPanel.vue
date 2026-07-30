<template>
  <div class="jb-overlay" @click="$emit('close')">
    <div class="k-card jb-card q-pa-lg column q-gutter-md" @click.stop>
      <div class="row items-center justify-between">
        <span class="k-chip">🎵 jukebox</span>
        <button class="k-btn k-btn-ghost k-btn-sm" @click="$emit('close')">esc ✕</button>
      </div>

      <!-- tocando agora -->
      <div class="jb-now-playing">
        <template v-if="jukeboxState.current">
          <div class="jb-label">tocando agora</div>
          <div class="jb-title ellipsis">{{ jukeboxState.current.title }}</div>
          <div class="jb-subtext">adicionado por {{ jukeboxState.current.addedByName }}</div>
        </template>
        <template v-else>
          <div class="jb-muted">nada tocando — cole um link do YouTube abaixo</div>
        </template>
      </div>

      <!-- modo sala/proximidade -->
      <div class="row items-center q-gutter-xs jb-text-sm">
        <span class="jb-muted">alcance:</span>
        <button
          class="k-btn k-btn-ghost k-btn-xs"
          :class="{ 'k-active': jukeboxState.mode === 'proximity' }"
          @click="emitJukeboxSetMode('proximity')"
        >proximidade</button>
        <button
          class="k-btn k-btn-ghost k-btn-xs"
          :class="{ 'k-active': jukeboxState.mode === 'room' }"
          @click="emitJukeboxSetMode('room')"
        >sala inteira</button>
      </div>

      <!-- adicionar -->
      <div class="column q-gutter-xs">
        <div class="row no-wrap q-gutter-xs">
          <div class="col">
            <input
              v-model="linkInput" placeholder="Cole o link do YouTube…" @keydown.enter="add"
              :disabled="!!jukeboxState.status"
              class="k-input full-width k-input-xs"
            />
          </div>
          <div class="col-auto">
            <button class="k-btn k-btn-primary k-btn-sm" :disabled="adding || !!jukeboxState.status" @click="add">{{ adding || jukeboxState.status ? '...' : 'add' }}</button>
          </div>
        </div>
        <p v-if="jukeboxState.status" class="k-hint-text">🔄 {{ jukeboxState.status }}</p>
        <p v-if="jukeboxError" class="jb-error">{{ jukeboxError }}</p>
      </div>

      <!-- biblioteca: músicas já baixadas antes, adiciona sem esperar download -->
      <div class="column q-gutter-xs">
        <div class="row no-wrap q-gutter-xs">
          <div class="col">
            <button class="k-btn k-btn-ghost full-width ellipsis k-btn-sm" @click="toggleLibrary">
              {{ libraryOpen ? '▲ esconder biblioteca' : '▼ ver músicas já baixadas' }}
            </button>
          </div>
          <div class="col-auto">
            <button class="k-btn k-btn-ghost k-btn-sm" :disabled="syncing" @click="syncFromDrive" title="rebaixar do Drive tudo que estiver faltando no cache local">
              {{ syncing ? 'sincronizando...' : '⟲ sync' }}
            </button>
          </div>
        </div>
        <p v-if="syncMessage" class="k-hint-text">{{ syncMessage }}</p>

        <div v-if="libraryOpen" class="column q-gutter-xs">
          <input
            v-model="librarySearch" placeholder="buscar por título…"
            class="k-input full-width k-input-xs"
          />
          <div class="row no-wrap q-gutter-xs">
            <div class="col">
              <button class="k-btn k-btn-ghost full-width k-btn-sm" :disabled="!library.length || !!jukeboxState.status" @click="addRandom">🔀 aleatória</button>
            </div>
            <div class="col">
              <button class="k-btn k-btn-ghost full-width k-btn-sm" :disabled="!library.length || !!jukeboxState.status" @click="addAll">▶ tocar todas</button>
            </div>
          </div>
          <div class="jb-list">
            <div v-if="libraryLoading" class="jb-muted-4 jb-text-sm">carregando...</div>
            <div v-else-if="!library.length" class="jb-muted-4 jb-text-sm">nenhuma música encontrada</div>
            <button
              v-for="t in library" :key="t.id" class="k-btn k-btn-ghost ellipsis q-py-md"
              :disabled="!!jukeboxState.status"
              @click="addFromLibrary(t.youtubeId)"
            >{{ t.title }}</button>
          </div>
        </div>
      </div>

      <!-- volume pessoal -->
      <div class="row items-center q-gutter-xs jb-text-sm">
        <span class="jb-muted">seu volume:</span>
        <input type="range" min="0" max="1" step="0.05" v-model.number="personalVolume" class="k-range col" />
        <span class="jb-muted jb-volume-value">{{ Math.round(personalVolume * 100) }}%</span>
      </div>

      <!-- fila -->
      <div class="column q-gutter-xs jb-queue">
        <div class="jb-label">fila ({{ jukeboxState.queue.length }})</div>
        <div v-if="!jukeboxState.queue.length" class="jb-muted-4 jb-text-sm">vazia</div>
        <div v-for="(t, i) in jukeboxState.queue" :key="t.trackId + i" class="row items-center justify-between q-gutter-xs jb-queue-item">
          <span class="ellipsis">{{ i + 1 }}. {{ t.title }}</span>
          <span class="jb-muted-4 jb-queue-added">{{ t.addedByName }}</span>
        </div>
      </div>

      <button class="k-btn k-btn-ghost full-width k-btn-sm" :disabled="!jukeboxState.current" @click="emitJukeboxSkip()">⏭ pular</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { jukeboxState, jukeboxError, emitJukeboxAdd, emitJukeboxSkip, emitJukeboxSetMode } from '@/services/presence'
import { personalVolume } from '@/services/jukeboxAudio'
import { apiFetch } from '@/services/http'

defineEmits(['close'])

const linkInput = ref('')
const adding = ref(false)

function add() {
  const v = linkInput.value.trim()
  if (!v) return
  jukeboxError.value = ''
  adding.value = true
  emitJukeboxAdd(v)
  linkInput.value = ''
  // sem confirmação de servidor por evento dedicado — destrava após um instante,
  // o estado da fila chega via jukeboxState assim que pronto
  setTimeout(() => { adding.value = false }, 800)
}

interface LibraryTrack { id: string; youtubeId: string; title: string; durationSec: number }
const library = ref<LibraryTrack[]>([])
const libraryOpen = ref(false)
const libraryLoading = ref(false)
const librarySearch = ref('')
let searchDebounce: ReturnType<typeof setTimeout> | null = null

async function fetchLibrary() {
  libraryLoading.value = true
  try {
    const qs = librarySearch.value.trim() ? `?q=${encodeURIComponent(librarySearch.value.trim())}` : ''
    const res = await apiFetch(`/jukebox/tracks${qs}`)
    library.value = await res.json()
  } finally {
    libraryLoading.value = false
  }
}

function toggleLibrary() {
  libraryOpen.value = !libraryOpen.value
  if (libraryOpen.value) fetchLibrary()
}

watch(librarySearch, () => {
  if (!libraryOpen.value) return
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(fetchLibrary, 300)
})

function addFromLibrary(youtubeId: string) {
  jukeboxError.value = ''
  emitJukeboxAdd(youtubeId)
}

function addRandom() {
  if (!library.value.length) return
  const t = library.value[Math.floor(Math.random() * library.value.length)]
  addFromLibrary(t.youtubeId)
}

function addAll() {
  // fila de tocar aceita repetição — servidor processa um por vez, sem bloquear
  // duplicatas (o download em si já é dedupado por youtubeId no backend)
  for (const t of library.value) emitJukeboxAdd(t.youtubeId)
}

const syncing = ref(false)
const syncMessage = ref('')

async function syncFromDrive() {
  syncing.value = true
  syncMessage.value = ''
  try {
    const res = await apiFetch('/jukebox/sync', { method: 'POST' })
    if (res.status === 403) {
      syncMessage.value = 'apenas administradores podem sincronizar'
      return
    }
    if (!res.ok) {
      syncMessage.value = 'falha ao sincronizar'
      return
    }
    const r = await res.json()
    syncMessage.value = `${r.downloaded} baixadas, ${r.skipped} já no cache, ${r.recovered} recuperadas no banco (${r.total} no total)`
    if (libraryOpen.value) fetchLibrary()
  } catch {
    syncMessage.value = 'falha ao sincronizar'
  } finally {
    syncing.value = false
  }
}
</script>

<style scoped>
.jb-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.62);
  backdrop-filter: blur(0.375rem);
  display: grid;
  place-items: center;
  z-index: 50;
  padding: 1.5rem;
}

.jb-card {
  width: min(27.5rem, 100%);
  max-height: 80vh;
  overflow-y: auto;
  overflow-x: hidden;
  /* causa raiz real do overflow: a classe global "column" do Quasar aplica
     flex-wrap:wrap (regra combinada .row,.column,.flex{display:flex;flex-wrap:wrap}).
     Num container column, isso faz o conteúdo que excede max-height "quebrar" pra
     uma SEGUNDA COLUNA ao lado (em vez de simplesmente rolar), empurrando o card
     inteiro pra ficar mais largo por dentro. Sem isso, single-column normal. */
  flex-wrap: nowrap;
}

/* itens flex (row/column/col do Quasar) não encolhem abaixo do próprio conteúdo por
   padrão (min-width:auto implícito) — com botões de white-space:nowrap (.k-btn)
   isso empurrava a linha (e por causa do align-items:stretch da coluna externa,
   TODAS as linhas junto) pra fora do card. Precisa em cada nível aninhado, não só
   no .col mais interno. */
.jb-card .row,
.jb-card .column,
.jb-card .col,
.jb-card .col-auto {
  min-width: 0;
}

/* botão com texto longo ("ver músicas já baixadas"): sem isso o ellipsis não tinha
   nenhum limite de largura pra realmente cortar o texto — button é inline-flex,
   então também precisa virar um flex item que aceita encolher (min-width:0 acima)
   E ter overflow:hidden pra o text-overflow ellipsis funcionar de fato. */
.jb-card .ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.jb-now-playing {
  background: var(--bg-1);
  border: 0.0625rem solid var(--border);
  padding: 0.75rem;
  font-size: 0.8125rem;
}

.jb-label {
  color: var(--text-3);
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 0.25rem;
}

.jb-title {
  color: var(--text);
  font-weight: 600;
}

.jb-subtext {
  color: var(--text-3);
  font-size: 0.6875rem;
  margin-top: 0.125rem;
}

.jb-muted { color: var(--text-3); }
.jb-muted-4 { color: var(--text-4); }
.jb-text-sm { font-size: 0.75rem; }

.jb-error {
  color: var(--err);
  font-size: 0.75rem;
  margin: 0;
}

.jb-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  overflow-y: auto;
  max-height: 50%;
  background: var(--bg-1);
  border: 0.0625rem solid var(--border);
  padding: 0.5rem;
}

.jb-list-item {
  font-size: 0.75rem;
  text-align: left;
  justify-content: flex-start;
  padding: 0.375rem 0.5rem;
}

.jb-volume-value {
  width: 2rem;
  text-align: right;
  font-family: var(--f-mono);
}

.jb-queue {
  overflow-y: auto;
  max-height: 10rem;
}

.jb-queue-item {
  font-size: 0.75rem;
  color: var(--text-2);
}

.jb-queue-added {
  flex-shrink: 0;
}

.k-range {
  appearance: none;
  -webkit-appearance: none;
  height: 0.625rem;
  background: var(--bg-1);
  border: 0.125rem solid var(--border-strong);
  outline: none;
  cursor: pointer;
}
.k-range::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 0.875rem;
  height: 1.125rem;
  background: var(--primary);
  border: 0.125rem solid var(--primary-hi);
  box-shadow: 0.125rem 0.125rem 0 var(--bg-0);
  cursor: pointer;
}
.k-range::-moz-range-thumb {
  width: 0.875rem;
  height: 1.125rem;
  background: var(--primary);
  border: 0.125rem solid var(--primary-hi);
  box-shadow: 0.125rem 0.125rem 0 var(--bg-0);
  cursor: pointer;
  border-radius: 0;
}
.k-range::-moz-range-track {
  background: transparent;
}

/* Telas estreitas (ou zoom alto): as linhas "no-wrap" (input+add, biblioteca+sync,
   aleatória+tocar todas) não cabiam lado a lado e estouravam o modal. Deixa quebrar
   linha normalmente (comportamento padrão do .row do Quasar) abaixo do breakpoint. */
@media (max-width: 26.25rem) {
  .jb-overlay {
    padding: 0.625rem;
  }
  .jb-card.q-pa-lg {
    padding: 1rem;
  }
  .row.no-wrap {
    flex-wrap: wrap;
  }
  .row.no-wrap > .col-auto {
    flex: 1 1 100%;
  }
}
</style>
