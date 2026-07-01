<template>
  <div style="position:absolute;inset:0;background:rgba(0,0,0,0.62);backdrop-filter:blur(6px);display:grid;place-items:center;z-index:50;padding:24px" @click="$emit('close')">
    <div class="k-card" style="padding:24px;width:min(440px,100%);display:flex;flex-direction:column;gap:14px;max-height:80vh" @click.stop>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span class="k-chip">🎵 jukebox</span>
        <button class="k-btn k-btn-ghost" style="padding:6px 10px" @click="$emit('close')">esc ✕</button>
      </div>

      <!-- tocando agora -->
      <div style="background:var(--bg-1);border:1px solid var(--border);padding:12px;font-size:13px">
        <template v-if="jukeboxState.current">
          <div style="color:var(--text-3);font-size:10px;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">tocando agora</div>
          <div style="color:var(--text);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ jukeboxState.current.title }}</div>
          <div style="color:var(--text-3);font-size:11px;margin-top:2px">adicionado por {{ jukeboxState.current.addedByName }}</div>
        </template>
        <template v-else>
          <div style="color:var(--text-3)">nada tocando — cole um link do YouTube abaixo</div>
        </template>
      </div>

      <!-- modo sala/proximidade -->
      <div style="display:flex;align-items:center;gap:8px;font-size:12px">
        <span style="color:var(--text-3)">alcance:</span>
        <button
          class="k-btn k-btn-ghost" style="padding:6px 10px;font-size:10px"
          :style="jukeboxState.mode === 'proximity' ? { borderColor: 'var(--primary-hi)', color: 'var(--text)' } : {}"
          @click="emitJukeboxSetMode('proximity')"
        >proximidade</button>
        <button
          class="k-btn k-btn-ghost" style="padding:6px 10px;font-size:10px"
          :style="jukeboxState.mode === 'room' ? { borderColor: 'var(--primary-hi)', color: 'var(--text)' } : {}"
          @click="emitJukeboxSetMode('room')"
        >sala inteira</button>
      </div>

      <!-- adicionar -->
      <div style="display:flex;gap:8px">
        <input
          v-model="linkInput" placeholder="Cole o link do YouTube…" @keydown.enter="add"
          :disabled="!!jukeboxState.status"
          class="k-input" style="flex:1;padding:10px 12px;font-size:10px"
        />
        <button class="k-btn k-btn-primary" style="padding:8px 14px;font-size:11px" :disabled="adding || !!jukeboxState.status" @click="add">{{ adding || jukeboxState.status ? '...' : 'add' }}</button>
      </div>
      <p v-if="jukeboxState.status" style="color:var(--text-3);font-size:12px;margin:0">🔄 {{ jukeboxState.status }}</p>
      <p v-if="jukeboxError" style="color:var(--err);font-size:12px;margin:0">{{ jukeboxError }}</p>

      <!-- biblioteca: músicas já baixadas antes, adiciona sem esperar download -->
      <div style="display:flex;gap:8px">
        <button class="k-btn k-btn-ghost" style="font-size:11px;flex:1" @click="toggleLibrary">
          {{ libraryOpen ? '▲ esconder biblioteca' : '▼ ver músicas já baixadas' }}
        </button>
        <button class="k-btn k-btn-ghost" style="font-size:11px" :disabled="syncing" @click="syncFromDrive" title="rebaixar do Drive tudo que estiver faltando no cache local">
          {{ syncing ? 'sincronizando...' : '⟲ sync' }}
        </button>
      </div>
      <p v-if="syncMessage" style="color:var(--text-3);font-size:12px;margin:0">{{ syncMessage }}</p>
      <div v-if="libraryOpen" style="display:flex;flex-direction:column;gap:6px">
        <input
          v-model="librarySearch" placeholder="buscar por título…"
          class="k-input" style="padding:8px 12px;font-size:10px"
        />
        <div style="display:flex;flex-direction:column;gap:4px;overflow-y:auto;max-height:140px;background:var(--bg-1);border:1px solid var(--border);padding:8px">
          <div v-if="libraryLoading" style="color:var(--text-4);font-size:12px">carregando...</div>
          <div v-else-if="!library.length" style="color:var(--text-4);font-size:12px">nenhuma música encontrada</div>
          <button
            v-for="t in library" :key="t.id" class="k-btn k-btn-ghost"
            style="font-size:12px;text-align:left;justify-content:flex-start;padding:6px 8px"
            :disabled="!!jukeboxState.status"
            @click="addFromLibrary(t.youtubeId)"
          >{{ t.title }}</button>
        </div>
      </div>

      <!-- volume pessoal -->
      <div style="display:flex;align-items:center;gap:8px;font-size:12px">
        <span style="color:var(--text-3)">seu volume:</span>
        <input type="range" min="0" max="1" step="0.05" v-model.number="personalVolume" class="k-range" />
        <span style="color:var(--text-3);width:32px;text-align:right;font-family:var(--f-mono)">{{ Math.round(personalVolume * 100) }}%</span>
      </div>

      <!-- fila -->
      <div style="display:flex;flex-direction:column;gap:6px;overflow-y:auto;max-height:160px">
        <div style="color:var(--text-3);font-size:10px;text-transform:uppercase;letter-spacing:0.08em">fila ({{ jukeboxState.queue.length }})</div>
        <div v-if="!jukeboxState.queue.length" style="color:var(--text-4);font-size:12px">vazia</div>
        <div v-for="(t, i) in jukeboxState.queue" :key="t.trackId + i" style="font-size:12px;color:var(--text-2);display:flex;justify-content:space-between;gap:8px">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ i + 1 }}. {{ t.title }}</span>
          <span style="color:var(--text-4);flex-shrink:0">{{ t.addedByName }}</span>
        </div>
      </div>

      <button class="k-btn k-btn-ghost" style="font-size:11px" :disabled="!jukeboxState.current" @click="emitJukeboxSkip()">⏭ pular</button>
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

const syncing = ref(false)
const syncMessage = ref('')

async function syncFromDrive() {
  syncing.value = true
  syncMessage.value = ''
  try {
    const res = await apiFetch('/jukebox/sync', { method: 'POST' })
    const r = await res.json()
    syncMessage.value = `${r.downloaded} baixadas, ${r.skipped} já no cache (${r.total} no total)`
    if (libraryOpen.value) fetchLibrary()
  } catch {
    syncMessage.value = 'falha ao sincronizar'
  } finally {
    syncing.value = false
  }
}
</script>

<style scoped>
.k-range {
  flex: 1;
  appearance: none;
  -webkit-appearance: none;
  height: 10px;
  background: var(--bg-1);
  border: 2px solid var(--border-strong);
  outline: none;
  cursor: pointer;
}
.k-range::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 14px;
  height: 18px;
  background: var(--primary);
  border: 2px solid var(--primary-hi);
  box-shadow: 2px 2px 0 var(--bg-0);
  cursor: pointer;
}
.k-range::-moz-range-thumb {
  width: 14px;
  height: 18px;
  background: var(--primary);
  border: 2px solid var(--primary-hi);
  box-shadow: 2px 2px 0 var(--bg-0);
  cursor: pointer;
  border-radius: 0;
}
.k-range::-moz-range-track {
  background: transparent;
}
</style>
