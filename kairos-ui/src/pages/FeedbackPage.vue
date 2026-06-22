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
            <button :class="['fb-kind', form.kind === 'bug' && 'on']" @click="form.kind = 'bug'">🐞 Bug</button>
            <button :class="['fb-kind', form.kind === 'melhoria' && 'on']" @click="form.kind = 'melhoria'">✨ Melhoria</button>
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
              <span :class="['fb-status', f.status]">{{ statusLabel[f.status] }}</span>
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
import { ref, reactive, onMounted } from 'vue'
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

onMounted(() => {
  load()
  setInterval(() => (now.value = Date.now()), 60000)
})
</script>

<style scoped>
.fb-root { min-height: 100vh; background: #0d0d14; color: #e8e8f0; font-family: system-ui; padding: 0 0 48px; }
.fb-head { display: flex; align-items: baseline; gap: 14px; padding: 18px 24px; border-bottom: 1px solid #252535; }
.fb-head h1 { font-size: 20px; margin: 0; }
.fb-sub { font-size: 13px; color: #8a8aa0; }
.fb-back { background: transparent; border: 1px solid #303045; color: #c8c8d8; padding: 5px 12px; cursor: pointer; border-radius: 3px; font-size: 13px; }
.fb-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; max-width: 1080px; margin: 24px auto; padding: 0 24px; }
@media (max-width: 820px) { .fb-grid { grid-template-columns: 1fr; } }
.fb-card { background: #14141f; border: 1px solid #252535; border-radius: 8px; padding: 20px; }
.fb-card h2 { font-size: 15px; margin: 0 0 10px; }
.fb-intro { font-size: 13px; color: #a0a0b8; line-height: 1.6; margin: 0 0 18px; }
.fb-field { margin-bottom: 14px; }
.fb-field label { display: block; font-size: 12px; color: #8a8aa0; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.06em; }
.fb-field input, .fb-field textarea { width: 100%; box-sizing: border-box; background: #1d1d2a; border: 1px solid #303045; color: #e8e8f0; padding: 9px 11px; border-radius: 4px; font-size: 14px; font-family: inherit; }
.fb-field textarea { resize: vertical; }
.fb-kinds { display: flex; gap: 8px; }
.fb-kind { flex: 1; background: #1d1d2a; border: 1px solid #303045; color: #c8c8d8; padding: 8px; cursor: pointer; border-radius: 4px; font-size: 13px; }
.fb-kind.on { border-color: #7c3aed; background: rgba(124,58,237,0.16); color: #fff; }
.fb-submit { background: #7c3aed; border: none; color: #fff; padding: 10px 20px; cursor: pointer; border-radius: 4px; font-size: 14px; font-weight: 600; }
.fb-submit:disabled { opacity: 0.6; cursor: default; }
.fb-ok { color: #34d399; font-size: 13px; margin: 12px 0 0; }
.fb-err { color: #f87171; font-size: 13px; margin: 12px 0 0; }
.fb-count { color: #8a8aa0; font-weight: 400; }
.fb-empty { font-size: 13px; color: #8a8aa0; }
.fb-list { list-style: none; margin: 0; padding: 0 6px 0 0; display: flex; flex-direction: column; gap: 12px; max-height: 65vh; overflow-y: auto; }
.fb-item { background: #1a1a26; border: 1px solid #262636; border-radius: 6px; padding: 12px 14px; }
.fb-item-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.fb-tag { font-size: 12px; color: #c8c8d8; }
.fb-status { font-size: 11px; padding: 2px 8px; border-radius: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
.fb-status.aberto { background: rgba(138,138,160,0.18); color: #b8b8c8; }
.fb-status.em_andamento { background: rgba(251,191,36,0.18); color: #fbbf24; }
.fb-status.resolvido { background: rgba(52,211,153,0.18); color: #34d399; }
.fb-status.recusado { background: rgba(248,113,113,0.18); color: #f87171; }
.fb-item-resolved { font-size: 11px; color: #34d399; margin-top: 4px; }
.fb-item-title { font-size: 14px; font-weight: 600; margin-bottom: 3px; }
.fb-item-msg { font-size: 13px; color: #a0a0b8; line-height: 1.5; white-space: pre-wrap; }
.fb-item-meta { font-size: 11px; color: #6a6a80; margin-top: 8px; }
</style>
