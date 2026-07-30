<template>
  <div class="ad-root">
    <header class="ad-head">
      <button class="ad-back" @click="router.push('/map-select')">‹ Voltar</button>
      <h1>Administração{{ org ? ' · ' + org.name : '' }}</h1>
      <nav class="ad-tabs">
        <button v-for="t in tabs" :key="t" :class="['ad-tab', tab === t && 'k-active']" @click="tab = t">{{ t }}</button>
      </nav>
    </header>

    <p v-if="error" class="ad-error">{{ error }}</p>

    <!-- Membros -->
    <section v-if="tab === 'Membros'" class="ad-card">
      <div class="ad-row-between">
        <h2>Membros ({{ members.length }})</h2>
        <button class="ad-btn" @click="invite">+ Gerar convite</button>
      </div>
      <div v-if="inviteCode" class="ad-invite">
        <span class="ad-invite-label">Link de convite (válido 7 dias):</span>
        <div class="ad-invite-row">
          <input class="ad-invite-input" :value="inviteUrl" readonly @focus="($event.target as HTMLInputElement).select()" />
          <button class="ad-btn" @click="copyInvite">{{ copied ? '✓ Copiado' : 'Copiar' }}</button>
        </div>
        <span class="ad-invite-hint">Quem abrir o link entra direto na sua organização (cria conta ou faz login e já cai no convite).</span>
      </div>
      <ul class="ad-list">
        <li v-for="m in members" :key="m.id" class="ad-item">
          <span class="ad-email">{{ m.email }} <span v-if="m.id === auth.userId" class="ad-you">(você)</span></span>
          <span class="ad-actions">
            <span :class="['k-badge', m.orgRole === 'admin' ? 'k-badge-info' : 'k-badge-dim']">{{ m.orgRole }}</span>
            <button v-if="m.id !== auth.userId" class="ad-mini" @click="toggleRole(m)">{{ m.orgRole === 'admin' ? 'rebaixar' : 'promover' }}</button>
            <button v-if="m.id !== auth.userId" class="ad-mini ad-danger" @click="kick(m)">remover</button>
          </span>
        </li>
      </ul>
    </section>

    <!-- Mundos -->
    <section v-if="tab === 'Mundos'" class="ad-card">
      <h2>Mundos da organização ({{ orgMaps.length }})</h2>
      <ul class="ad-list">
        <li v-for="w in orgMaps" :key="w.id" class="ad-item">
          <span>{{ w.name }} <span class="ad-dim">· {{ w.width }}×{{ w.height }}</span></span>
          <button class="ad-mini ad-danger" @click="del(w)">apagar</button>
        </li>
        <li v-if="!orgMaps.length" class="ad-empty">Nenhum mundo criado ainda.</li>
      </ul>
    </section>

    <!-- Config -->
    <section v-if="tab === 'Config'" class="ad-card">
      <h2>Configurações</h2>
      <label class="ad-label">Nome da organização</label>
      <input v-model.trim="orgNameEdit" maxlength="40" class="ad-input" />
      <button class="ad-btn" @click="saveConfig">Salvar</button>
      <p v-if="saved" class="ad-ok">✓ Salvo</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/useAuthStore'
import { getMyOrg, createInvite, inviteLink, setMemberRole, removeMember, updateOrg, type Org, type OrgMember } from '@/services/org.api'
import { fetchMaps, deleteMap } from '@/services/maps.api'
import type { MapDef } from '@/game/maps'

const router = useRouter()
const auth = useAuthStore()
const tabs = ['Membros', 'Mundos', 'Config'] as const
const tab = ref<(typeof tabs)[number]>('Membros')

const org = ref<Org | null>(null)
const members = ref<OrgMember[]>([])
const orgMaps = ref<MapDef[]>([])
const inviteCode = ref('')
const inviteUrl = computed(() => (inviteCode.value ? inviteLink(inviteCode.value) : ''))
const copied = ref(false)
const orgNameEdit = ref('')
const error = ref('')
const saved = ref(false)

const isAdmin = computed(() => members.value.find((m) => m.id === auth.userId)?.orgRole === 'admin')

async function load() {
  org.value = await getMyOrg()
  if (!org.value) { router.replace('/onboarding'); return }
  members.value = org.value.members || []
  orgNameEdit.value = org.value.name
  if (!isAdmin.value) { router.replace('/map-select'); return }
  orgMaps.value = (await fetchMaps()).filter((m) => !m.isTemplate)
}

async function invite() {
  copied.value = false
  try { inviteCode.value = (await createInvite()).code } catch { error.value = 'Falha ao gerar convite.' }
}
async function copyInvite() {
  try {
    await navigator.clipboard.writeText(inviteUrl.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch { /* navegador sem clipboard: o input fica selecionável pra cópia manual */ }
}
async function toggleRole(m: OrgMember) {
  await setMemberRole(m.id, m.orgRole === 'admin' ? 'member' : 'admin')
  await load()
}
async function kick(m: OrgMember) {
  if (!confirm(`Remover ${m.email} da organização?`)) return
  await removeMember(m.id)
  await load()
}
async function del(w: MapDef) {
  if (!confirm(`Apagar o mundo "${w.name}"? Não dá pra desfazer.`)) return
  await deleteMap(w.id)
  orgMaps.value = orgMaps.value.filter((m) => m.id !== w.id)
}
async function saveConfig() {
  await updateOrg(orgNameEdit.value)
  saved.value = true
  setTimeout(() => (saved.value = false), 2000)
}

onMounted(load)
</script>

<style scoped>
.ad-root { min-height: 100vh; background: #0d0d14; color: #e8e8f0; font-family: system-ui; padding: 0 0 2.5rem; }
.ad-head { padding: 1.125rem 1.5rem; border-bottom: 0.0625rem solid #252535; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
.ad-head h1 { font-size: 1.125rem; margin: 0; }
.ad-back { background: transparent; border: 0.0625rem solid #303045; color: #c8c8d8; padding: 0.3125rem 0.75rem; cursor: pointer; border-radius: 0.1875rem; }
.ad-tabs { display: flex; gap: 0.375rem; margin-left: auto; }
.ad-tab { background: #1d1d2a; border: 0.0625rem solid #303045; color: #c8c8d8; padding: 0.375rem 0.875rem; cursor: pointer; border-radius: 0.25rem; }
.ad-tab.k-active { color: #fff; }
.ad-card { max-width: 47.5rem; margin: 1.5rem auto; padding: 1.25rem; background: #14141f; border: 0.0625rem solid #252535; border-radius: 0.5rem; }
.ad-card h2 { font-size: 0.9375rem; margin: 0 0 0.75rem; }
.ad-row-between { display: flex; justify-content: space-between; align-items: center; }
.ad-list { list-style: none; margin: 0.75rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.ad-item { display: flex; justify-content: space-between; align-items: center; background: #1a1a26; border: 0.0625rem solid #262636; padding: 0.5625rem 0.75rem; border-radius: 0.375rem; font-size: 0.875rem; }
.ad-email { color: #e8e8f0; }
.ad-you { color: #6a6a80; font-size: 0.75rem; }
.ad-actions { display: flex; gap: 0.5rem; align-items: center; }
.ad-mini { background: transparent; border: 0.0625rem solid #303045; color: #c8c8d8; padding: 0.1875rem 0.5rem; cursor: pointer; border-radius: 0.25rem; font-size: 0.75rem; }
.ad-danger { color: #f87171; border-color: rgba(248,113,113,0.4); }
.ad-dim { color: #6a6a80; font-size: 0.75rem; }
.ad-empty { color: #8a8aa0; font-size: 0.8125rem; }
.ad-btn { background: #7c3aed; border: none; color: #fff; padding: 0.5rem 0.875rem; cursor: pointer; border-radius: 0.25rem; font-weight: 600; }
.ad-invite { margin: 0.75rem 0 0; display: flex; flex-direction: column; gap: 0.375rem; }
.ad-invite-label { font-size: 0.75rem; color: #34d399; }
.ad-invite-row { display: flex; gap: 0.5rem; }
.ad-invite-input { flex: 1; min-width: 0; background: #1d1d2a; border: 0.0625rem solid #303045; color: #e8e8f0; padding: 0.5rem 0.625rem; border-radius: 0.25rem; font-size: 0.8125rem; font-family: var(--f-mono, monospace); }
.ad-invite-hint { font-size: 0.6875rem; color: #6a6a80; }
.ad-input { width: 100%; box-sizing: border-box; background: #1d1d2a; border: 0.0625rem solid #303045; color: #e8e8f0; padding: 0.5625rem; border-radius: 0.25rem; margin-bottom: 0.75rem; }
.ad-label { font-size: 0.75rem; color: #8a8aa0; display: block; margin-bottom: 0.3125rem; }
.ad-error { color: #f87171; text-align: center; }
.ad-ok { color: #34d399; font-size: 0.8125rem; }
</style>
