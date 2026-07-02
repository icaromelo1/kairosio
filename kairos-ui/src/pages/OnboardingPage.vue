<template>
  <div class="ob-root">
    <div class="ob-head">
      <Logo id="monogram" size="lg" primary="var(--primary-hi)" accent="var(--accent)" />
      <h1>{{ myOrgs.length ? 'Escolha sua organização' : 'Sua organização' }}</h1>
      <p v-if="myOrgs.length">Você faz parte de mais de uma organização — escolha qual usar agora, ou crie/entre em outra abaixo.</p>
      <p v-else>Crie uma organização (vira sua equipe) ou entre numa existente com um convite.</p>
    </div>

    <!-- Organizações de que já sou membro -->
    <section v-if="myOrgs.length" class="ob-card ob-orgs-card">
      <h2>Suas organizações</h2>
      <div class="ob-org-list">
        <button
          v-for="o in myOrgs" :key="o.id" class="ob-org-item"
          :class="{ 'ob-org-item-active': o.active }"
          :disabled="busy"
          @click="pick(o.id)"
        >
          <span class="ob-org-name">{{ o.name }}</span>
          <span class="ob-org-role">{{ o.role === 'admin' ? 'admin' : 'membro' }}{{ o.active ? ' · atual' : '' }}</span>
        </button>
      </div>
    </section>

    <div class="ob-grid">
      <section class="ob-card">
        <h2>Criar organização</h2>
        <p class="ob-sub">Você vira o admin. Depois pode convidar a galera.</p>
        <input v-model.trim="orgName" maxlength="40" class="ob-input" placeholder="Nome da org / equipe" @keyup.enter="create" />
        <button class="ob-btn" :disabled="busy" @click="create">{{ busy ? '…' : 'Criar →' }}</button>
      </section>

      <section class="ob-card">
        <h2>Entrar com convite</h2>
        <p class="ob-sub">Abriu um link de convite? O código já vem preenchido — é só confirmar. Ou cole o código manualmente.</p>
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
import { createOrg, joinOrg, getMyOrgs, switchOrg, type MyOrgSummary } from '@/services/org.api'
import Logo from '@/components/logos/Logo.vue'

const router = useRouter()
const route = useRoute()
const orgName = ref('')
const code = ref('')
const error = ref('')
const busy = ref(false)
const myOrgs = ref<MyOrgSummary[]>([])

onMounted(async () => {
  const inv = route.query.invite
  if (typeof inv === 'string') code.value = inv
  myOrgs.value = await getMyOrgs()
})

async function pick(orgId: string) {
  error.value = ''
  busy.value = true
  try {
    await switchOrg(orgId)
    router.push('/character')
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

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
.ob-root { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.75rem; padding: 1.5rem; background: radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.18), transparent 50%), var(--bg-1); color: var(--text); font-family: system-ui; }
.ob-head { text-align: center; max-width: 32.5rem; }
.ob-head h1 { font-size: 1.625rem; margin: 0.875rem 0 0.375rem; }
.ob-head p { color: var(--text-3); font-size: 0.875rem; margin: 0; }
.ob-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; width: min(45rem, 100%); }
@media (max-width: 40rem) { .ob-grid { grid-template-columns: 1fr; } }
.ob-card { background: var(--bg-2); border: 0.0625rem solid var(--border-strong); padding: 1.375rem; display: flex; flex-direction: column; gap: 0.625rem; }
.ob-card h2 { font-size: 1rem; margin: 0; }
.ob-sub { font-size: 0.8125rem; color: var(--text-3); margin: 0 0 0.375rem; }
.ob-input { background: var(--bg-1); border: 0.0625rem solid var(--border); color: var(--text); padding: 0.5625rem 0.6875rem; border-radius: 0.25rem; font-size: 0.875rem; }
.ob-btn { background: var(--primary); border: none; color: #fff; padding: 0.625rem; cursor: pointer; border-radius: 0.25rem; font-weight: 600; }
.ob-btn-ghost { background: transparent; border: 0.0625rem solid var(--border-strong); color: var(--text); }
.ob-btn:disabled { opacity: 0.6; }
.ob-error { color: #f87171; font-size: 0.8125rem; }

.ob-orgs-card { width: min(45rem, 100%); }
.ob-org-list { display: flex; flex-direction: column; gap: 0.5rem; }
.ob-org-item {
  appearance: none;
  background: var(--bg-1);
  border: 0.0625rem solid var(--border);
  color: var(--text);
  padding: 0.75rem 0.875rem;
  border-radius: 0.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.875rem;
  text-align: left;
}
.ob-org-item:disabled { opacity: 0.6; cursor: default; }
.ob-org-item-active { border-color: var(--primary-hi); background: rgba(124, 58, 237, 0.1); }
.ob-org-name { font-weight: 600; }
.ob-org-role { font-size: 0.6875rem; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.08em; }
</style>
