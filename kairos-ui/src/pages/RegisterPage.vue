<template>
  <div class="reg-root">
    <div class="reg-card">
      <Logo id="monogram" size="lg" primary="var(--primary-hi)" accent="var(--accent)" />
      <h1>Criar conta</h1>
      <p class="reg-sub">Crie sua conta pra entrar no Kairos e ter seu mundo.</p>

      <label class="reg-label">E-mail</label>
      <input v-model="email" type="email" class="k-input" placeholder="voce@email.com" @keyup.enter="submit" />

      <label class="reg-label">Nome de usuário</label>
      <div class="reg-user-field">
        <span class="reg-at">@</span>
        <input
          :value="username"
          type="text"
          class="k-input reg-user-input"
          placeholder="seunome"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          maxlength="20"
          @input="onUsernameInput"
          @keyup.enter="submit"
        />
      </div>
      <p class="k-hint-text reg-hint">
        3 a 20 caracteres — letras, números, ponto e sublinhado. Sem começar ou terminar com ponto,
        e sem pontos seguidos. É por ele que seus amigos te encontram, e ele só pode ser trocado a
        cada 30 dias.
      </p>
      <p v-if="usernameMessage" class="reg-status" :class="usernameOk ? 'is-ok' : 'is-bad'">
        {{ usernameMessage }}
      </p>

      <label class="reg-label">Senha</label>
      <input v-model="password" type="password" class="k-input" placeholder="mínimo 6 caracteres" @keyup.enter="submit" />

      <label class="reg-label">Confirmar senha</label>
      <input v-model="confirm" type="password" class="k-input" placeholder="repita a senha" @keyup.enter="submit" />

      <button class="k-btn k-btn-primary reg-submit" :disabled="loading" @click="submit">
        {{ loading ? 'Criando…' : 'Cadastrar →' }}
      </button>

      <p v-if="error" class="reg-error">{{ error }}</p>

      <p class="reg-foot">
        Já tem conta?
        <a href="#" @click.prevent="router.push('/login')">Entrar →</a>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { checkUsername, register } from '@/services/auth.api'
import { useAuthStore } from '@/stores/useAuthStore'
import { postAuthDest } from '@/services/postAuth'
import Logo from '@/components/logos/Logo.vue'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const username = ref('')
const password = ref('')
const confirm = ref('')
const error = ref('')
const loading = ref(false)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// espelho das regras do backend: serve pra avisar antes de gastar uma chamada,
// mas quem decide continua sendo o servidor
const USERNAME_RE = /^[A-Za-z0-9._]{3,20}$/
const RESERVED = ['admin', 'kairos', 'suporte', 'sistema', 'moderador', 'eu']
const RULES_MESSAGE =
  'Use de 3 a 20 caracteres: letras, números, ponto e sublinhado — sem começar ou terminar com ponto e sem pontos seguidos.'
const CHECK_DELAY_MS = 450

type UsernameState = 'idle' | 'checking' | 'livre' | 'em-uso' | 'formato' | 'reservado' | 'limitado' | 'offline'

const usernameState = ref<UsernameState>('idle')
const usernameOk = computed(() => usernameState.value === 'livre')
const usernameMessage = computed(() => {
  switch (usernameState.value) {
    case 'checking':
      return 'Verificando disponibilidade…'
    case 'livre':
      return `@${username.value} está livre.`
    case 'em-uso':
      return 'Esse nome de usuário já está em uso. Escolha outro.'
    case 'formato':
      return RULES_MESSAGE
    case 'reservado':
      return 'Esse nome de usuário é reservado pelo Kairos.'
    case 'limitado':
      return 'Muitas verificações seguidas. Espere um instante.'
    case 'offline':
      return 'Não deu pra verificar agora — o cadastro confirma.'
    default:
      return ''
  }
})

function localProblem(value: string): 'formato' | 'reservado' | null {
  if (!USERNAME_RE.test(value)) return 'formato'
  if (value.startsWith('.') || value.endsWith('.') || value.includes('..')) return 'formato'
  if (RESERVED.includes(value.toLowerCase())) return 'reservado'
  return null
}

// o campo já mostra o @ do lado de fora, e espaço nunca é aceito: tirar na
// digitação evita a pessoa descobrir isso só no erro
function onUsernameInput(event: Event) {
  const el = event.target as HTMLInputElement
  const cleaned = el.value.replace(/^@+/, '').replace(/\s+/g, '')
  if (el.value !== cleaned) el.value = cleaned
  username.value = cleaned
}

let checkTimer: ReturnType<typeof setTimeout> | undefined
// resposta atrasada de um nome antigo não pode sobrescrever o resultado do atual
let checkSeq = 0

watch(username, (value) => {
  clearTimeout(checkTimer)
  const pedido = ++checkSeq
  if (!value) {
    usernameState.value = 'idle'
    return
  }
  const problem = localProblem(value)
  if (problem) {
    usernameState.value = problem
    return
  }
  usernameState.value = 'checking'
  checkTimer = setTimeout(async () => {
    try {
      const res = await checkUsername(value)
      if (pedido !== checkSeq) return
      usernameState.value = res.disponivel ? 'livre' : (res.motivo ?? 'em-uso')
    } catch (e) {
      if (pedido !== checkSeq) return
      usernameState.value = (e as Error).message === 'rate-limited' ? 'limitado' : 'offline'
    }
  }, CHECK_DELAY_MS)
})

onBeforeUnmount(() => clearTimeout(checkTimer))

async function submit() {
  error.value = ''
  if (!EMAIL_RE.test(email.value)) {
    error.value = 'Informe um email válido.'
    return
  }
  const problem = localProblem(username.value)
  if (problem) {
    error.value = problem === 'reservado' ? 'Esse nome de usuário é reservado pelo Kairos.' : RULES_MESSAGE
    return
  }
  if (usernameState.value === 'em-uso') {
    error.value = 'Esse nome de usuário já está em uso. Escolha outro.'
    return
  }
  if (password.value.length < 6) {
    error.value = 'A senha precisa de pelo menos 6 caracteres.'
    return
  }
  if (password.value !== confirm.value) {
    error.value = 'As senhas não conferem.'
    return
  }
  loading.value = true
  try {
    const res = await register(email.value, password.value, username.value)
    authStore.setToken(res.token)
    router.push(await postAuthDest())
  } catch (e) {
    const code = (e as Error).message
    if (code === 'username-taken') usernameState.value = 'em-uso'
    error.value = REGISTER_ERRORS[code] ?? 'Não foi possível criar a conta. Tente de novo.'
  } finally {
    loading.value = false
  }
}

const REGISTER_ERRORS: Record<string, string> = {
  'email-exists': 'Este email já está cadastrado. Faça login.',
  'username-taken': 'Esse nome de usuário já está em uso. Escolha outro.',
  'username-reserved': 'Esse nome de usuário é reservado pelo Kairos.',
  'username-invalid': RULES_MESSAGE,
  'invalid-input': 'Dados inválidos. Confira email, nome de usuário e senha.',
}
</script>

<style scoped>
.reg-root {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  background: radial-gradient(ellipse at 50% 0%, rgba(124, 58, 237, 0.18), transparent 50%), var(--bg-1);
}
.reg-card {
  width: min(26.25rem, 100%);
  background: var(--bg-2);
  border: 0.0625rem solid var(--border-strong);
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.reg-card h1 {
  font-size: 1.5rem;
  margin: 0.875rem 0 0;
  font-weight: 600;
  letter-spacing: -0.02em;
}
.reg-sub {
  color: var(--text-3);
  font-size: 0.875rem;
  margin: 0 0 0.75rem;
}
.reg-label {
  font-size: 0.6875rem;
  letter-spacing: 0.14em;
  color: var(--text-3);
  text-transform: uppercase;
  margin-top: 0.5rem;
}
.reg-user-field {
  position: relative;
  display: flex;
  align-items: center;
}
.reg-at {
  position: absolute;
  left: 0.875rem;
  font-family: var(--ui-font);
  font-size: 0.6875rem;
  color: var(--text-3);
  pointer-events: none;
}
.reg-user-input {
  padding-left: 1.875rem;
}
.reg-hint {
  font-size: 0.6875rem;
  margin: 0.375rem 0 0;
}
.reg-status {
  font-size: 0.6875rem;
  margin: 0.25rem 0 0;
}
.reg-status.is-ok {
  color: var(--ok);
}
.reg-status.is-bad {
  color: var(--warn);
}
.reg-submit {
  margin-top: 1.125rem;
}
.reg-error {
  color: #f87171;
  font-size: 0.75rem;
  margin: 0.625rem 0 0;
  text-align: center;
}
.reg-foot {
  font-size: 0.75rem;
  text-align: center;
  color: var(--text-3);
  margin: 0.875rem 0 0;
}
.reg-foot a {
  color: var(--accent);
  font-weight: 600;
  text-decoration: none;
}
</style>
