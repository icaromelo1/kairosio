<template>
  <div class="jb-overlay" @click="$emit('close')">
    <div class="k-card jb-card q-pa-lg column q-gutter-md" @click.stop>
      <div class="row items-center justify-between">
        <span class="k-chip">📖 notas</span>
        <button class="k-btn k-btn-ghost k-btn-sm" @click="$emit('close')">esc ✕</button>
      </div>

      <p v-if="error" class="jb-error">{{ error }}</p>

      <div class="column q-gutter-xs">
        <textarea
          v-model="bodyInput" placeholder="Nova nota…"
          :disabled="adding"
          class="k-input full-width jb-textarea"
          rows="3"
        ></textarea>
        <button class="k-btn k-btn-primary full-width k-btn-sm" :disabled="adding || !bodyInput.trim()" @click="add">{{ adding ? '...' : 'add' }}</button>
      </div>

      <div class="column q-gutter-xs jb-queue">
        <div class="jb-label">notas ({{ notes.length }})</div>
        <div v-if="loading" class="jb-muted-4 jb-text-sm">carregando...</div>
        <div v-else-if="!notes.length" class="jb-muted-4 jb-text-sm">nenhuma nota</div>
        <div v-for="n in notes" :key="n.id" class="row items-start justify-between q-gutter-xs jb-queue-item jb-note-item">
          <span class="jb-note-body">{{ n.body }}</span>
          <button class="k-btn k-btn-ghost k-btn-xs" @click="remove(n)" title="apagar">✕</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { listNotes, createNote, deleteNote, type NoteItem } from '@/services/note.api'

const props = defineProps<{ mapId: string; objectId: string }>()
defineEmits(['close'])

const notes = ref<NoteItem[]>([])
const loading = ref(false)
const adding = ref(false)
const error = ref('')
const bodyInput = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    notes.value = await listNotes(props.mapId, props.objectId)
  } catch {
    error.value = 'falha ao carregar notas'
  } finally {
    loading.value = false
  }
}

async function add() {
  const body = bodyInput.value.trim()
  if (!body) return
  adding.value = true
  error.value = ''
  try {
    const created = await createNote(props.mapId, props.objectId, body)
    notes.value.push(created)
    bodyInput.value = ''
  } catch {
    error.value = 'falha ao criar nota'
  } finally {
    adding.value = false
  }
}

async function remove(n: NoteItem) {
  try {
    await deleteNote(n.id)
    notes.value = notes.value.filter(x => x.id !== n.id)
  } catch {
    error.value = 'falha ao apagar nota'
  }
}

onMounted(load)
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
  flex-wrap: nowrap;
}

.jb-card .row,
.jb-card .column,
.jb-card .col,
.jb-card .col-auto {
  min-width: 0;
}

.jb-label {
  color: var(--text-3);
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 0.25rem;
}

.jb-muted-4 { color: var(--text-4); }
.jb-text-sm { font-size: 0.75rem; }

.jb-error {
  color: var(--err);
  font-size: 0.75rem;
  margin: 0;
}

.jb-textarea {
  resize: vertical;
  font-family: inherit;
  padding: 0.5rem;
}

.jb-queue {
  overflow-y: auto;
  max-height: 20rem;
}

.jb-queue-item {
  font-size: 0.75rem;
  color: var(--text-2);
}

.jb-note-item {
  background: var(--bg-1);
  border: 0.0625rem solid var(--border);
  padding: 0.5rem;
}

.jb-note-body {
  white-space: pre-wrap;
  word-break: break-word;
  flex: 1;
}

@media (max-width: 26.25rem) {
  .jb-overlay {
    padding: 0.625rem;
  }
  .jb-card.q-pa-lg {
    padding: 1rem;
  }
}
</style>
