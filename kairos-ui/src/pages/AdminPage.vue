<template>
  <div class="ad-root">
    <header class="ad-head">
      <button class="ad-back" @click="router.push('/map-select')">‹ Voltar</button>
      <h1>Administração{{ org ? ' · ' + org.name : '' }}</h1>
      <nav class="ad-tabs">
        <button v-for="t in tabs" :key="t" :class="['ad-tab', tab === t && 'on']" @click="tab = t">{{ t }}</button>
      </nav>
    </header>

    <p v-if="error" class="ad-error">{{ error }}</p>

    <!-- Membros -->
    <section v-if="tab === 'Membros'" class="ad-card">
      <div class="ad-row-between">
        <h2>Membros ({{ members.length }})</h2>
        <button class="ad-btn" @click="invite">+ Gerar convite</button>
      </div>
      <p v-if="inviteCode" class="ad-invite">Convite: <code>{{ inviteCode }}</code> <span>(válido 7 dias)</span></p>
      <ul class="ad-list">
        <li v-for="m in members" :key="m.id" class="ad-item">
          <span class="ad-email">{{ m.email }} <span v-if="m.id === auth.userId" class="ad-you">(você)</span></span>
          <span class="ad-actions">
            <span :class="['ad-role', m.orgRole]">{{ m.orgRole }}</span>
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
import { getMyOrg, createInvite, setMemberRole, removeMember, updateOrg, type Org, type OrgMember } from '@/services/org.api'
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
  orgMaps.value = (await fetchMaps()).filter((m) => !(m as any).isTemplate)
}

async function invite() {
  try { inviteCode.value = (await createInvite()).code } catch { error.value = 'Falha ao gerar convite.' }
}
async function toggleRole(m: OrgMember) {
  await setMemberRole(m.id, m.orgRole === 'admin' ? 'member' : 'admin')
  await load()
}
async function kick(m: OrgMember) {
  await removeMember(m.id)
  await load()
}
async function del(w: MapDef) {
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
.ad-root { min-height: 100vh; background: #0d0d14; color: #e8e8f0; font-family: system-ui; padding: 0 0 40px; }
.ad-head { padding: 18px 24px; border-bottom: 1px solid #252535; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.ad-head h1 { font-size: 18px; margin: 0; }
.ad-back { background: transparent; border: 1px solid #303045; color: #c8c8d8; padding: 5px 12px; cursor: pointer; border-radius: 3px; }
.ad-tabs { display: flex; gap: 6px; margin-left: auto; }
.ad-tab { background: #1d1d2a; border: 1px solid #303045; color: #c8c8d8; padding: 6px 14px; cursor: pointer; border-radius: 4px; }
.ad-tab.on { border-color: #7c3aed; background: rgba(124,58,237,0.18); color: #fff; }
.ad-card { max-width: 760px; margin: 24px auto; padding: 20px; background: #14141f; border: 1px solid #252535; border-radius: 8px; }
.ad-card h2 { font-size: 15px; margin: 0 0 12px; }
.ad-row-between { display: flex; justify-content: space-between; align-items: center; }
.ad-list { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.ad-item { display: flex; justify-content: space-between; align-items: center; background: #1a1a26; border: 1px solid #262636; padding: 9px 12px; border-radius: 6px; font-size: 14px; }
.ad-email { color: #e8e8f0; }
.ad-you { color: #6a6a80; font-size: 12px; }
.ad-actions { display: flex; gap: 8px; align-items: center; }
.ad-role { font-size: 11px; padding: 2px 8px; border-radius: 10px; text-transform: uppercase; }
.ad-role.admin { background: rgba(124,58,237,0.2); color: #a78bfa; }
.ad-role.member { background: rgba(138,138,160,0.18); color: #b8b8c8; }
.ad-mini { background: transparent; border: 1px solid #303045; color: #c8c8d8; padding: 3px 8px; cursor: pointer; border-radius: 4px; font-size: 12px; }
.ad-danger { color: #f87171; border-color: rgba(248,113,113,0.4); }
.ad-dim { color: #6a6a80; font-size: 12px; }
.ad-empty { color: #8a8aa0; font-size: 13px; }
.ad-btn { background: #7c3aed; border: none; color: #fff; padding: 8px 14px; cursor: pointer; border-radius: 4px; font-weight: 600; }
.ad-invite { font-size: 13px; color: #34d399; margin: 10px 0 0; }
.ad-invite code { background: #1d1d2a; padding: 2px 8px; border-radius: 4px; }
.ad-input { width: 100%; box-sizing: border-box; background: #1d1d2a; border: 1px solid #303045; color: #e8e8f0; padding: 9px; border-radius: 4px; margin-bottom: 12px; }
.ad-label { font-size: 12px; color: #8a8aa0; display: block; margin-bottom: 5px; }
.ad-error { color: #f87171; text-align: center; }
.ad-ok { color: #34d399; font-size: 13px; }
</style>
