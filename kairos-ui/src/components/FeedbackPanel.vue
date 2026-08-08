<template>
  <PanelShell title="feedback" icon="bug" size="lg" dock @close="emit('close')">
    <div class="fp-grid">
      <section class="fp-card">
        <h3 class="fp-title">Relatar bug ou pedir melhoria</h3>
        <p class="k-hint-text fp-intro">
          Encontrou um problema ou tem uma ideia? Conte pra gente. Seja específico:
          o que aconteceu, o que você esperava, e como reproduzir (no caso de bug).
          <strong>É preciso estar logado com uma conta para enviar.</strong>
        </p>

        <div class="fp-field">
          <label class="k-label" for="fp-author">Enviando como</label>
          <input id="fp-author" :value="auth.email || 'você não está logado'" type="text" class="k-input k-input-sm" disabled />
        </div>

        <div class="fp-field">
          <span class="k-label">Tipo</span>
          <div class="fp-kinds">
            <button class="k-btn k-btn-ghost k-btn-xs" :class="{ 'k-active': form.kind === 'bug' }" @click="form.kind = 'bug'">
              <PixelIcon name="bug" size="0.875rem" />Bug
            </button>
            <button class="k-btn k-btn-ghost k-btn-xs" :class="{ 'k-active': form.kind === 'melhoria' }" @click="form.kind = 'melhoria'">
              <PixelIcon name="sparkles" size="0.875rem" />Melhoria
            </button>
          </div>
        </div>

        <div class="fp-field">
          <label class="k-label" for="fp-title">Título</label>
          <input id="fp-title" v-model="form.title" type="text" maxlength="120" class="k-input k-input-sm" placeholder="Resumo em uma linha" />
        </div>

        <div class="fp-field">
          <label class="k-label" for="fp-message">Descrição</label>
          <textarea
            id="fp-message" v-model="form.message" rows="5" maxlength="2000"
            class="k-input k-input-sm fp-textarea"
            placeholder="Descreva com detalhes. Em bugs, inclua os passos para reproduzir."
          ></textarea>
        </div>

        <button class="k-btn k-btn-primary k-btn-sm" :disabled="sending" @click="submit">
          {{ sending ? 'Enviando…' : 'Enviar' }}
        </button>
        <p v-if="ok" class="fp-ok"><PixelIcon name="check" size="0.875rem" />Obrigado! Seu feedback foi registrado.</p>
        <p v-if="err" class="fp-err">{{ err }}</p>
      </section>

      <section class="fp-card">
        <h3 class="fp-title">Enviados <span class="fp-dim">{{ list.length }}</span></h3>
        <p v-if="!list.length" class="k-hint-text">Nenhum feedback ainda. Seja o primeiro.</p>
        <ul class="fp-list">
          <li v-for="f in list" :key="f.id" class="fp-item">
            <div class="fp-item-top">
              <span class="fp-tag">
                <PixelIcon :name="f.kind === 'bug' ? 'bug' : 'sparkles'" size="0.8125rem" />{{ f.kind === 'bug' ? 'Bug' : 'Melhoria' }}
              </span>
              <span class="k-badge" :class="statusBadgeClass[f.status]">{{ statusLabel[f.status] }}</span>
            </div>
            <div class="fp-item-title">{{ f.title }}</div>
            <div class="fp-item-msg">{{ f.message }}</div>
            <div class="fp-item-meta">
              {{ maskEmail(f.authorEmail) }} · enviado {{ fmtDate(f.createdAt) }} · atualizado {{ relTime(f.resolvedAt || f.updatedAt || f.createdAt) }}
            </div>
            <div v-if="(f.status === 'resolvido' || f.status === 'recusado') && f.resolvedAt" class="fp-item-resolved">
              {{ f.status === 'resolvido' ? 'implementado' : 'recusado' }} em {{ fmtDateTime(f.resolvedAt) }}
            </div>
          </li>
        </ul>
      </section>
    </div>
  </PanelShell>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { createFeedback, fetchFeedback, type Feedback, type FeedbackKind, type FeedbackStatus } from '@/services/feedback.api'
import { useAuthStore } from '@/stores/useAuthStore'
import PanelShell from '@/components/PanelShell.vue'
import PixelIcon from '@/components/PixelIcon.vue'

const emit = defineEmits<{ close: [] }>()

const auth = useAuthStore()
const list = ref<Feedback[]>([])
const sending = ref(false)
const ok = ref(false)
const err = ref('')

const form = reactive({ kind: 'bug' as FeedbackKind, title: '', message: '' })

const statusLabel: Record<FeedbackStatus, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  resolvido: 'Resolvido',
  recusado: 'Recusado',
}

const statusBadgeClass: Record<FeedbackStatus, string> = {
  aberto: 'k-badge-dim',
  em_andamento: 'k-badge-warning',
  resolvido: 'k-badge-success',
  recusado: 'k-badge-error',
}

function maskEmail(e: string): string {
  const [u, d] = e.split('@')
  if (!d) return e
  return `${u.slice(0, 2)}***@${d}`
}
function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}
function fmtDateTime(s: string): string {
  return new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}
const now = ref(Date.now())
function relTime(s: string): string {
  void now.value
  const diff = Math.max(0, (Date.now() - new Date(s).getTime()) / 1000)
  const u: [number, string][] = [[31536000, 'ano'], [2592000, 'mês'], [86400, 'dia'], [3600, 'hora'], [60, 'min'], [1, 's']]
  for (const [sec, label] of u) {
    if (diff >= sec) {
      const n = Math.floor(diff / sec)
      const plural = n > 1 && label !== 'min' && label !== 's' ? (label === 'mês' ? 'meses' : label + 's') : label
      return `há ${n} ${plural}`
    }
  }
  return 'agora'
}

async function load() {
  try { list.value = await fetchFeedback() } catch { /* silencioso */ }
}

async function submit() {
  ok.value = false
  err.value = ''
  if (!auth.email) {
    err.value = 'Entre com sua conta para enviar feedback.'
    return
  }
  if (!form.title || !form.message) {
    err.value = 'Preencha título e descrição.'
    return
  }
  sending.value = true
  try {
    await createFeedback({ kind: form.kind, title: form.title, message: form.message })
    ok.value = true
    form.title = ''
    form.message = ''
    await load()
  } catch (e) {
    err.value = (e as Error).message
  } finally {
    sending.value = false
  }
}

let nowTimer = 0
onMounted(() => {
  void load()
  nowTimer = window.setInterval(() => (now.value = Date.now()), 60000)
})
onUnmounted(() => clearInterval(nowTimer))
</script>

<style scoped>
.fp-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  align-items: start;
}

.fp-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  background: var(--bg-1);
  border: 0.0625rem solid var(--border);
  padding: 0.875rem;
  min-width: 0;
}

.fp-title { font-size: 0.9375rem; margin: 0; }
.fp-intro { margin: 0; }
.fp-dim { color: var(--text-3); font-weight: 400; }

.fp-field { width: 100%; }

.k-input.fp-textarea {
  resize: vertical;
  font-family: var(--f-sans);
  font-size: 0.8125rem;
  line-height: 1.5;
}

.fp-kinds { display: flex; gap: 0.5rem; }

.fp-ok { color: var(--ok); font-size: 0.8125rem; margin: 0; display: flex; align-items: center; gap: 0.375rem; }
.fp-err { color: var(--err); font-size: 0.8125rem; margin: 0; }

.fp-list {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.fp-item {
  background: var(--bg-2);
  border: 0.0625rem solid var(--border);
  padding: 0.75rem 0.875rem;
  overflow-wrap: anywhere;
  word-break: break-word;
  min-width: 0;
}

.fp-item-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
}

.fp-tag { font-size: 0.75rem; color: var(--text-2); display: inline-flex; align-items: center; gap: 0.375rem; }
.fp-item-title { font-size: 0.875rem; font-weight: 600; margin-bottom: 0.25rem; }
.fp-item-msg { font-size: 0.8125rem; color: var(--text-2); line-height: 1.5; white-space: pre-wrap; }
.fp-item-meta { font-size: 0.6875rem; color: var(--text-4); margin-top: 0.5rem; }
.fp-item-resolved { font-size: 0.6875rem; color: var(--ok); margin-top: 0.25rem; }

@media (max-width: 44rem) {
  .fp-grid { grid-template-columns: 1fr; }
}
</style>
