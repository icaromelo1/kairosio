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
          style="flex:1;box-sizing:border-box;background:var(--bg-1);border:1px solid var(--border-strong);color:var(--text);padding:8px 10px;font-size:13px;font-family:inherit"
        />
        <button class="k-btn k-btn-primary" style="padding:8px 14px;font-size:11px" :disabled="adding" @click="add">{{ adding ? '...' : 'add' }}</button>
      </div>
      <p v-if="jukeboxError" style="color:var(--err);font-size:12px;margin:0">{{ jukeboxError }}</p>

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
import { ref } from 'vue'
import { jukeboxState, jukeboxError, emitJukeboxAdd, emitJukeboxSkip, emitJukeboxSetMode } from '@/services/presence'

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
</script>
