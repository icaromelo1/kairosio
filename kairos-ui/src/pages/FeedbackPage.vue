<template>
  <div class="fb-root">
    <header class="fb-head">
      <button class="fb-back" @click="router.back()">‹ Voltar</button>
      <h1>Feedback</h1>
      <span class="fb-sub">Ajude a melhorar o Kairos</span>
    </header>

    <div class="fb-grid">
      <!-- Formulário -->
      <section class="fb-card">
        <h2>Relatar bug ou pedir melhoria</h2>
        <p class="fb-intro">
          Encontrou um problema ou tem uma ideia? Conte pra gente. Seja específico:
          o que aconteceu, o que você esperava, e como reproduzir (no caso de bug).
          <strong>É preciso ter um email cadastrado para enviar.</strong>
        </p>

        <div class="fb-field">
          <label>Seu email (cadastrado)</label>
          <input v-model="form.email" type="email" placeholder="voce@email.com" />
        </div>

        <div class="fb-field">
          <label>Tipo</label>
          <div class="fb-kinds">
            <button :class="['fb-kind', form.kind === 'bug' && 'k-active']" @click="form.kind = 'bug'">🐞 Bug</button>
            <button :class="['fb-kind', form.kind === 'melhoria' && 'k-active']" @click="form.kind = 'melhoria'">✨ Melhoria</button>
          </div>
        </div>

        <div class="fb-field">
          <label>Título</label>
          <input v-model="form.title" type="text" maxlength="120" placeholder="Resumo em uma linha" />
        </div>

        <div class="fb-field">
          <label>Descrição</label>
          <textarea v-model="form.message" rows="5" maxlength="2000" placeholder="Descreva com detalhes. Em bugs, inclua os passos para reproduzir."></textarea>
        </div>

        <button class="fb-submit" :disabled="sending" @click="submit">
          {{ sending ? 'Enviando…' : 'Enviar' }}
        </button>
        <p v-if="ok" class="fb-ok">✓ Obrigado! Seu feedback foi registrado.</p>
        <p v-if="err" class="fb-err">{{ err }}</p>
      </section>

      <!-- Lista -->
      <section class="fb-card">
        <h2>Enviados <span class="fb-count">{{ list.length }}</span></h2>
        <p v-if="!list.length" class="fb-empty">Nenhum feedback ainda. Seja o primeiro.</p>
        <ul class="fb-list">
          <li v-for="f in list" :key="f.id" class="fb-item">
            <div class="fb-item-top">
              <span class="fb-tag">{{ f.kind === 'bug' ? '🐞 Bug' : '✨ Melhoria' }}</span>
              <span :class="['k-badge', statusBadgeClass[f.status]]">{{ statusLabel[f.status] }}</span>
            </div>
            <div class="fb-item-title">{{ f.title }}</div>
            <div class="fb-item-msg">{{ f.message }}</div>
            <div class="fb-item-meta">
              {{ maskEmail(f.authorEmail) }} · enviado {{ fmtDate(f.createdAt) }} · atualizado {{ relTime(f.resolvedAt || f.updatedAt || f.createdAt) }}
            </div>
            <div v-if="(f.status === 'resolvido' || f.status === 'recusado') && f.resolvedAt" class="fb-item-resolved">
              {{ f.status === 'resolvido' ? 'implementado' : 'recusado' }} em {{ fmtDateTime(f.resolvedAt) }}
            </div>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { createFeedback, fetchFeedback, type Feedback, type FeedbackKind, type FeedbackStatus } from '@/services/feedback.api'
import { useAuthStore } from '@/stores/useAuthStore'

const router = useRouter()
const auth = useAuthStore()
const list = ref<Feedback[]>([])
const sending = ref(false)
const ok = ref(false)
const err = ref('')

// já vem com o email do usuário logado (o gate exige email cadastrado)
const form = reactive({ email: auth.email || '', kind: 'bug' as FeedbackKind, title: '', message: '' })

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
// "há X" — timer regressivo (recalcula via `now`, que atualiza a cada 60s)
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
  if (!form.email || !form.title || !form.message) {
    err.value = 'Preencha email, título e descrição.'
    return
  }
  sending.value = true
  try {
    await createFeedback({ ...form })
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
  load()
  nowTimer = window.setInterval(() => (now.value = Date.now()), 60000)
})
onUnmounted(() => clearInterval(nowTimer))
</script>

<style scoped>
.fb-root { min-height: 100vh; background: #0d0d14; color: #e8e8f0; font-family: system-ui; padding: 0 0 3rem; }
.fb-head { display: flex; align-items: baseline; gap: 0.875rem; padding: 1.125rem 1.5rem; border-bottom: 0.0625rem solid #252535; }
.fb-head h1 { font-size: 1.25rem; margin: 0; }
.fb-sub { font-size: 0.8125rem; color: #8a8aa0; }
.fb-back { background: transparent; border: 0.0625rem solid #303045; color: #c8c8d8; padding: 0.3125rem 0.75rem; cursor: pointer; border-radius: 0.1875rem; font-size: 0.8125rem; }
.fb-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; max-width: 67.5rem; margin: 1.5rem auto; padding: 0 1.5rem; }
@media (max-width: 51.25rem) { .fb-grid { grid-template-columns: 1fr; } }
.fb-card { background: #14141f; border: 0.0625rem solid #252535; border-radius: 0.5rem; padding: 1.25rem; min-width: 0; }
.fb-card h2 { font-size: 0.9375rem; margin: 0 0 0.625rem; }
.fb-intro { font-size: 0.8125rem; color: #a0a0b8; line-height: 1.6; margin: 0 0 1.125rem; }
.fb-field { margin-bottom: 0.875rem; }
.fb-field label { display: block; font-size: 0.75rem; color: #8a8aa0; margin-bottom: 0.3125rem; text-transform: uppercase; letter-spacing: 0.06em; }
.fb-field input, .fb-field textarea { width: 100%; box-sizing: border-box; background: #1d1d2a; border: 0.0625rem solid #303045; color: #e8e8f0; padding: 0.5625rem 0.6875rem; border-radius: 0.25rem; font-size: 0.875rem; font-family: inherit; }
.fb-field textarea { resize: vertical; }
.fb-kinds { display: flex; gap: 0.5rem; }
.fb-kind { flex: 1; background: #1d1d2a; border: 0.0625rem solid #303045; color: #c8c8d8; padding: 0.5rem; cursor: pointer; border-radius: 0.25rem; font-size: 0.8125rem; }
.fb-kind.k-active { color: #fff; }
.fb-submit { background: #7c3aed; border: none; color: #fff; padding: 0.625rem 1.25rem; cursor: pointer; border-radius: 0.25rem; font-size: 0.875rem; font-weight: 600; }
.fb-submit:disabled { opacity: 0.6; cursor: default; }
.fb-ok { color: #34d399; font-size: 0.8125rem; margin: 0.75rem 0 0; }
.fb-err { color: #f87171; font-size: 0.8125rem; margin: 0.75rem 0 0; }
.fb-count { color: #8a8aa0; font-weight: 400; }
.fb-empty { font-size: 0.8125rem; color: #8a8aa0; }
.fb-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
.fb-item { background: #1a1a26; border: 0.0625rem solid #262636; border-radius: 0.375rem; padding: 0.75rem 0.875rem; overflow-wrap: anywhere; word-break: break-word; min-width: 0; }
.fb-item-top { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-bottom: 0.375rem; }
.fb-tag { font-size: 0.75rem; color: #c8c8d8; }
.fb-item-resolved { font-size: 0.6875rem; color: #34d399; margin-top: 0.25rem; }
.fb-item-title { font-size: 0.875rem; font-weight: 600; margin-bottom: 0.1875rem; }
.fb-item-msg { font-size: 0.8125rem; color: #a0a0b8; line-height: 1.5; white-space: pre-wrap; }
.fb-item-meta { font-size: 0.6875rem; color: #6a6a80; margin-top: 0.5rem; }
</style>
