<template>
  <div class="jb-overlay" @click="$emit('close')">
    <div class="k-card jb-card q-pa-lg column" @click.stop>
      <div class="row items-center justify-between">
        <span class="k-chip"><PixelIcon name="notes" size="0.6875rem" />notas</span>
        <button class="k-btn k-btn-ghost k-btn-sm" @click="$emit('close')">esc<PixelIcon name="close" size="0.75rem" /></button>
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
          <template v-if="editingId === n.id">
            <textarea v-model="editBody" class="jb-note-edit" rows="2" maxlength="4000" @keydown.esc="cancelEdit" @keydown.enter.exact.prevent="saveEdit(n)"></textarea>
            <button class="k-btn k-btn-ghost k-btn-xs" title="salvar" aria-label="salvar nota" @click="saveEdit(n)"><PixelIcon name="check" size="0.6875rem" /></button>
            <button class="k-btn k-btn-ghost k-btn-xs" title="cancelar" aria-label="cancelar edição" @click="cancelEdit"><PixelIcon name="close" size="0.6875rem" /></button>
          </template>
          <template v-else>
            <span class="jb-note-body">{{ n.body }}</span>
            <button class="k-btn k-btn-ghost k-btn-xs" title="editar nota" aria-label="editar nota" @click="startEdit(n)"><PixelIcon name="pencil" size="0.6875rem" /></button>
            <button class="k-btn k-btn-ghost k-btn-xs" title="apagar nota" aria-label="apagar nota" @click="remove(n)"><PixelIcon name="close" size="0.6875rem" /></button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { explicarErro } from '@/services/avisos'
import { listNotes, createNote, updateNote, deleteNote, type NoteItem } from '@/services/note.api'
import PixelIcon from '@/components/PixelIcon.vue'

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
  } catch (e) {
    error.value = explicarErro(e, 'Não deu pra criar a nota.')
  } finally {
    adding.value = false
  }
}

const editingId = ref<string | null>(null)
const editBody = ref('')

function startEdit(n: NoteItem) {
  editingId.value = n.id
  editBody.value = n.body
}

function cancelEdit() {
  editingId.value = null
  editBody.value = ''
}

async function saveEdit(n: NoteItem) {
  const body = editBody.value.trim()
  if (!body || body === n.body) { cancelEdit(); return }
  error.value = ''
  try {
    const salva = await updateNote(n.id, body)
    const i = notes.value.findIndex(x => x.id === n.id)
    if (i >= 0) notes.value[i] = salva
    cancelEdit()
  } catch (e) {
    error.value = explicarErro(e, 'Não deu pra salvar a nota.')
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
  gap: var(--sp-16);
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

.jb-note-edit {
  flex: 1;
  min-width: 0;
  background: var(--bg-1);
  border: 0.0625rem solid var(--border-strong);
  border-radius: var(--r-sm);
  color: var(--text);
  font-family: var(--f-sans);
  font-size: 0.8125rem;
  padding: 0.25rem 0.375rem;
  resize: vertical;
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
