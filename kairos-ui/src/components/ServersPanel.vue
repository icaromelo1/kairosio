<template>
  <PanelShell title="servidores" icon="server" @close="emit('close')">
    <div class="sp-body">
      <section v-if="myServers.length" class="sp-block">
        <h3 class="sp-title">Seus servidores</h3>
        <p class="k-hint-text sp-hint">Trocar de servidor troca os mundos e quem está online com você.</p>
        <div class="sp-list">
          <button
            v-for="s in myServers" :key="s.id"
            class="sp-item" :class="{ 'sp-item-active': s.active }"
            :disabled="busy"
            @click="pick(s.id)"
          >
            <span class="sp-item-name ellipsis">{{ s.name }}</span>
            <span class="sp-item-role">{{ s.role === 'admin' ? 'admin' : 'membro' }}{{ s.active ? ' · aqui' : '' }}</span>
          </button>
        </div>
      </section>

      <section class="sp-block">
        <template v-if="auth.isGuest">
          <h3 class="sp-title"><PixelIcon name="lock" size="0.875rem" />Criar servidor</h3>
          <p class="k-hint-text sp-hint">
            Convidado não cria servidor: a conta de convidado é apagada quando você sai, e o servidor
            ficaria sem dono. Com uma conta, o servidor é seu.
          </p>
          <button class="k-btn k-btn-ghost k-btn-sm" @click="goRegister">Criar conta →</button>
        </template>

        <template v-else>
          <h3 class="sp-title">Criar servidor</h3>
          <p class="k-hint-text sp-hint">Você vira o admin. Depois pode convidar a galera.</p>
          <input v-model.trim="serverName" maxlength="40" class="k-input k-input-sm" placeholder="Nome do servidor" @keyup.enter="create" />
          <button class="k-btn k-btn-primary k-btn-sm" :disabled="busy" @click="create">{{ busy ? '…' : 'Criar →' }}</button>
        </template>
      </section>

      <section class="sp-block">
        <h3 class="sp-title">Entrar com convite</h3>
        <p class="k-hint-text sp-hint">
          Abriu um link de convite? O código já vem preenchido — é só confirmar. Ou cole o código manualmente.
        </p>
        <input v-model.trim="code" maxlength="16" class="k-input k-input-sm" placeholder="Código do convite" @keyup.enter="join" />
        <button class="k-btn k-btn-ghost k-btn-sm" :disabled="busy" @click="join">{{ busy ? '…' : 'Entrar' }}</button>
      </section>

      <p v-if="notice" class="sp-ok">{{ notice }}</p>
      <p v-if="error" class="sp-error">{{ error }}</p>
    </div>
  </PanelShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  createServer, joinServer, getMyServers, switchServer, setPendingInvite,
  type MyServerSummary,
} from '@/services/server.api'
import { useAuthStore } from '@/stores/useAuthStore'
import PanelShell from '@/components/PanelShell.vue'
import PixelIcon from '@/components/PixelIcon.vue'

const props = defineProps<{ invite?: string }>()
const emit = defineEmits<{ close: []; 'server-changed': [] }>()

const router = useRouter()
const auth = useAuthStore()

const myServers = ref<MyServerSummary[]>([])
const serverName = ref('')
const code = ref(props.invite || '')
const error = ref('')
const notice = ref('')
const busy = ref(false)

const activeId = computed(() => myServers.value.find((s) => s.active)?.id ?? null)

async function load() {
  myServers.value = await getMyServers()
}

onMounted(load)

async function run(action: () => Promise<void>) {
  error.value = ''
  notice.value = ''
  busy.value = true
  try {
    await action()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

function pick(serverId: string) {
  if (serverId === activeId.value) { emit('close'); return }
  void run(async () => {
    await switchServer(serverId)
    emit('server-changed')
    emit('close')
  })
}

function create() {
  if (!serverName.value) { error.value = 'Dê um nome ao servidor.'; return }
  void run(async () => {
    await createServer(serverName.value)
    serverName.value = ''
    emit('server-changed')
    emit('close')
  })
}

function join() {
  if (!code.value) { error.value = 'Informe o código do convite.'; return }
  void run(async () => {
    const before = activeId.value
    await joinServer(code.value)
    const entered = code.value
    code.value = ''
    await load()
    if (activeId.value !== before) {
      emit('server-changed')
      emit('close')
      return
    }
    notice.value = `Convite ${entered} aceito. Escolha o servidor na lista acima pra entrar nele.`
  })
}

function goRegister() {
  if (code.value) setPendingInvite(code.value)
  router.push('/register')
}
</script>

<style scoped>
.sp-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sp-block {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-start;
  background: var(--bg-1);
  border: 0.0625rem solid var(--border);
  padding: 0.875rem;
}

.sp-title {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.9375rem;
  margin: 0;
}

.sp-hint { margin: 0; }

.sp-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  width: 100%;
}

.sp-item {
  appearance: none;
  background: var(--bg-2);
  border: 0.0625rem solid var(--border-strong);
  color: var(--text);
  font-family: inherit;
  font-size: 0.875rem;
  text-align: left;
  padding: 0.625rem 0.75rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-width: 0;
}
.sp-item:hover:not(:disabled) { border-color: var(--primary-hi); }
.sp-item:disabled { opacity: 0.6; cursor: default; }
.sp-item-active { border-color: var(--primary-hi); background: color-mix(in srgb, var(--primary) 14%, transparent); }

.sp-item-name { font-weight: 600; min-width: 0; }
.sp-item-role {
  font-size: 0.6875rem;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.sp-error { color: var(--err); font-size: 0.8125rem; margin: 0; }
.sp-ok { color: var(--ok); font-size: 0.8125rem; margin: 0; }
</style>
