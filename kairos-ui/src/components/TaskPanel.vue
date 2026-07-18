<template>
  <div class="jb-overlay" @click="$emit('close')">
    <div class="k-card jb-card q-pa-lg column q-gutter-md" @click.stop>
      <div class="row items-center justify-between">
        <span class="k-chip">📋 tarefas</span>
        <button class="k-btn k-btn-ghost k-btn-sm" @click="$emit('close')">esc ✕</button>
      </div>

      <p v-if="error" class="jb-error">{{ error }}</p>

      <div class="row no-wrap q-gutter-xs">
        <div class="col">
          <input
            v-model="titleInput" placeholder="Nova tarefa…" @keydown.enter="add"
            :disabled="adding"
            class="k-input full-width k-input-xs"
          />
        </div>
        <div class="col-auto">
          <button class="k-btn k-btn-primary k-btn-sm" :disabled="adding || !titleInput.trim()" @click="add">{{ adding ? '...' : 'add' }}</button>
        </div>
      </div>

      <div class="column q-gutter-xs jb-queue">
        <div class="jb-label">tarefas ({{ tasks.length }})</div>
        <div v-if="loading" class="jb-muted-4 jb-text-sm">carregando...</div>
        <div v-else-if="!tasks.length" class="jb-muted-4 jb-text-sm">nenhuma tarefa</div>
        <div v-for="t in tasks" :key="t.id" class="row items-center justify-between q-gutter-xs jb-queue-item">
          <label class="row items-center q-gutter-xs jb-task-label">
            <input type="checkbox" :checked="t.done" @change="toggleDone(t)" />
            <span :class="{ 'jb-task-done': t.done }" class="ellipsis">{{ t.title }}</span>
          </label>
          <button class="k-btn k-btn-ghost k-btn-xs" @click="remove(t)" title="apagar">✕</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { listTasks, createTask, updateTask, deleteTask, type TaskItem } from '@/services/task.api'

const props = defineProps<{ mapId: string; objectId: string }>()
defineEmits(['close'])

const tasks = ref<TaskItem[]>([])
const loading = ref(false)
const adding = ref(false)
const error = ref('')
const titleInput = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    tasks.value = await listTasks(props.mapId, props.objectId)
  } catch {
    error.value = 'falha ao carregar tarefas'
  } finally {
    loading.value = false
  }
}

async function add() {
  const title = titleInput.value.trim()
  if (!title) return
  adding.value = true
  error.value = ''
  try {
    const created = await createTask(props.mapId, props.objectId, title)
    tasks.value.push(created)
    titleInput.value = ''
  } catch {
    error.value = 'falha ao criar tarefa'
  } finally {
    adding.value = false
  }
}

async function toggleDone(t: TaskItem) {
  const done = !t.done
  t.done = done
  try {
    await updateTask(t.id, { done })
  } catch {
    t.done = !done
    error.value = 'falha ao atualizar tarefa'
  }
}

async function remove(t: TaskItem) {
  try {
    await deleteTask(t.id)
    tasks.value = tasks.value.filter(x => x.id !== t.id)
  } catch {
    error.value = 'falha ao apagar tarefa'
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

.jb-card .ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
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

.jb-queue {
  overflow-y: auto;
  max-height: 20rem;
}

.jb-queue-item {
  font-size: 0.75rem;
  color: var(--text-2);
}

.jb-task-label {
  cursor: pointer;
  min-width: 0;
  flex: 1;
}

.jb-task-done {
  text-decoration: line-through;
  color: var(--text-4);
}

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
