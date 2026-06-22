<template>
  <div class="ob-root">
    <div class="ob-head">
      <Logo id="monogram" size="lg" primary="var(--primary-hi)" accent="var(--accent)" />
      <h1>Sua organização</h1>
      <p>Crie uma organização (vira sua equipe) ou entre numa existente com um convite.</p>
    </div>

    <div class="ob-grid">
      <section class="ob-card">
        <h2>Criar organização</h2>
        <p class="ob-sub">Você vira o admin. Depois pode convidar a galera.</p>
        <input v-model.trim="orgName" maxlength="40" class="ob-input" placeholder="Nome da org / equipe" @keyup.enter="create" />
        <button class="ob-btn" :disabled="busy" @click="create">{{ busy ? '…' : 'Criar →' }}</button>
      </section>

      <section class="ob-card">
        <h2>Entrar com convite</h2>
        <p class="ob-sub">Cole o código que um admin te passou.</p>
        <input v-model.trim="code" maxlength="16" class="ob-input" placeholder="Código do convite" @keyup.enter="join" />
        <button class="ob-btn ob-btn-ghost" :disabled="busy" @click="join">{{ busy ? '…' : 'Entrar' }}</button>
      </section>
    </div>

    <p v-if="error" class="ob-error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { createOrg, joinOrg } from '@/services/org.api'
import Logo from '@/components/logos/Logo.vue'

const router = useRouter()
const route = useRoute()
const orgName = ref('')
const code = ref('')
const error = ref('')
const busy = ref(false)

onMounted(() => {
  const inv = route.query.invite
  if (typeof inv === 'string') code.value = inv
})

async function create() {
  if (!orgName.value) { error.value = 'Dê um nome à organização.'; return }
  error.value = ''
  busy.value = true
  try {
    await createOrg(orgName.value)
    router.push('/character')
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

async function join() {
  if (!code.value) { error.value = 'Informe o código do convite.'; return }
  error.value = ''
  busy.value = true
  try {
    await joinOrg(code.value)
    router.push('/character')
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.ob-root { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 28px; padding: 24px; background: radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.18), transparent 50%), var(--bg-1); color: var(--text); font-family: system-ui; }
.ob-head { text-align: center; max-width: 520px; }
.ob-head h1 { font-size: 26px; margin: 14px 0 6px; }
.ob-head p { color: var(--text-3); font-size: 14px; margin: 0; }
.ob-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; width: min(720px, 100%); }
@media (max-width: 640px) { .ob-grid { grid-template-columns: 1fr; } }
.ob-card { background: var(--bg-2); border: 1px solid var(--border-strong); padding: 22px; display: flex; flex-direction: column; gap: 10px; }
.ob-card h2 { font-size: 16px; margin: 0; }
.ob-sub { font-size: 13px; color: var(--text-3); margin: 0 0 6px; }
.ob-input { background: var(--bg-1); border: 1px solid var(--border); color: var(--text); padding: 9px 11px; border-radius: 4px; font-size: 14px; }
.ob-btn { background: var(--primary); border: none; color: #fff; padding: 10px; cursor: pointer; border-radius: 4px; font-weight: 600; }
.ob-btn-ghost { background: transparent; border: 1px solid var(--border-strong); color: var(--text); }
.ob-btn:disabled { opacity: 0.6; }
.ob-error { color: #f87171; font-size: 13px; }
</style>
