<template>
  <div class="reg-root">
    <div class="reg-card">
      <Logo id="monogram" size="lg" primary="var(--primary-hi)" accent="var(--accent)" />
      <h1>Criar conta</h1>
      <p class="reg-sub">Crie sua conta pra entrar no Kairos e ter seu mundo.</p>

      <div class="field-group">
        <label class="k-label" for="reg-email">E-mail</label>
        <input
          id="reg-email"
          ref="emailInputRef"
          v-model="email"
          type="email"
          class="k-input"
          :class="{ 'k-input-error': emailError }"
          placeholder="voce@email.com"
          autocomplete="email"
          :aria-invalid="!!emailError"
          :aria-describedby="emailError ? 'reg-email-error' : undefined"
          @blur="emailTouched = true"
          @keyup.enter="submit"
        />
        <p v-if="emailError" id="reg-email-error" class="k-field-error">{{ emailError }}</p>
      </div>

      <div class="field-group">
        <div class="reg-label-row">
          <label class="k-label" for="reg-username">Nome de usuário</label>
          <span class="reg-counter" :class="{ 'is-near-limit': usernameCount >= 16, 'is-at-limit': usernameCount >= 20 }">
            {{ usernameCount }}/20
          </span>
        </div>
        <div class="reg-user-field">
          <span class="reg-at">@</span>
          <input
            id="reg-username"
            ref="usernameInputRef"
            :value="username"
            type="text"
            class="k-input reg-user-input"
            :class="{ 'k-input-error': usernameStatusKind === 'error' }"
            placeholder="seunome"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            maxlength="20"
            :aria-invalid="usernameStatusKind === 'error'"
            :aria-describedby="usernameMessage ? 'reg-username-status' : undefined"
            @input="onUsernameInput"
            @keyup.enter="submit"
          />
        </div>
        <p class="k-hint-text reg-hint">
          3 a 20 caracteres — letras, números, ponto e sublinhado. Sem começar ou terminar com ponto,
          e sem pontos seguidos. É por ele que seus amigos te encontram, e ele só pode ser trocado a
          cada 30 dias.
        </p>
        <p v-if="usernameMessage" id="reg-username-status" class="reg-status" :class="'is-' + usernameStatusKind">
          {{ usernameMessage }}
        </p>
      </div>

      <div class="field-group">
        <label class="k-label" for="reg-password">Senha</label>
        <input
          id="reg-password"
          ref="passwordInputRef"
          v-model="password"
          type="password"
          class="k-input"
          :class="{ 'k-input-error': passwordError }"
          placeholder="mínimo 6 caracteres"
          autocomplete="new-password"
          :aria-invalid="!!passwordError"
          :aria-describedby="passwordError ? 'reg-password-error' : undefined"
          @blur="passwordTouched = true"
          @keyup.enter="submit"
        />
        <p v-if="passwordError" id="reg-password-error" class="k-field-error">{{ passwordError }}</p>
      </div>

      <div class="field-group">
        <label class="k-label" for="reg-confirm">Confirmar senha</label>
        <input
          id="reg-confirm"
          ref="confirmInputRef"
          v-model="confirm"
          type="password"
          class="k-input"
          :class="{ 'k-input-error': confirmError }"
          placeholder="repita a senha"
          autocomplete="new-password"
          :aria-invalid="!!confirmError"
          :aria-describedby="confirmError ? 'reg-confirm-error' : undefined"
          @blur="confirmTouched = true"
          @keyup.enter="submit"
        />
        <p v-if="confirmError" id="reg-confirm-error" class="k-field-error">{{ confirmError }}</p>
      </div>

      <button class="k-btn k-btn-primary reg-submit" :disabled="loading" @click="submit">
        {{ loading ? 'Criando…' : 'Cadastrar →' }}
      </button>

      <p v-if="error" class="reg-error">{{ error }}</p>

      <p class="reg-foot">
        Já tem conta?
        <a class="reg-foot-link" href="#" @click.prevent="router.push('/login')">Entrar →</a>
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

const emailInputRef = ref<HTMLInputElement>()
const usernameInputRef = ref<HTMLInputElement>()
const passwordInputRef = ref<HTMLInputElement>()
const confirmInputRef = ref<HTMLInputElement>()

const emailTouched = ref(false)
const passwordTouched = ref(false)
const confirmTouched = ref(false)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const usernameCount = computed(() => username.value.length)

// Erro por campo (borda + mensagem) — só aparece após sair do campo ou tentar
// enviar, nunca durante a digitação em andamento.
const emailError = computed(() => {
  if (!emailTouched.value) return ''
  if (!email.value) return 'Informe um email.'
  if (!EMAIL_RE.test(email.value)) return 'Informe um email válido.'
  return ''
})
const passwordError = computed(() => {
  if (!passwordTouched.value) return ''
  if (!password.value) return 'Informe uma senha.'
  if (password.value.length < 6) return 'A senha precisa de pelo menos 6 caracteres.'
  return ''
})
const confirmError = computed(() => {
  if (!confirmTouched.value) return ''
  if (!confirm.value) return 'Confirme a senha.'
  if (confirm.value !== password.value) return 'As senhas não conferem.'
  return ''
})

const USERNAME_RE = /^[A-Za-z0-9._]{3,20}$/
const RESERVED = ['admin', 'kairos', 'suporte', 'sistema', 'moderador', 'eu']
const RULES_MESSAGE =
  'Use de 3 a 20 caracteres: letras, números, ponto e sublinhado — sem começar ou terminar com ponto e sem pontos seguidos.'
const CHECK_DELAY_MS = 450

type UsernameState = 'idle' | 'checking' | 'livre' | 'em-uso' | 'formato' | 'reservado' | 'limitado' | 'offline'

const USERNAME_ERROR_STATES: UsernameState[] = ['em-uso', 'formato', 'reservado', 'limitado']

const usernameState = ref<UsernameState>('idle')

// Estado do status abaixo do campo: 'ok' (verde), 'error' (vermelho — dispara
// também a borda do input) ou 'neutral' (verificando/offline — informativo,
// não é um erro).
const usernameStatusKind = computed<'ok' | 'error' | 'neutral'>(() => {
  if (usernameState.value === 'livre') return 'ok'
  if (USERNAME_ERROR_STATES.includes(usernameState.value)) return 'error'
  return 'neutral'
})
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

function onUsernameInput(event: Event) {
  const el = event.target as HTMLInputElement
  const cleaned = el.value.replace(/^@+/, '').replace(/\s+/g, '')
  if (el.value !== cleaned) el.value = cleaned
  username.value = cleaned
}

let checkTimer: ReturnType<typeof setTimeout> | undefined
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
  emailTouched.value = true
  passwordTouched.value = true
  confirmTouched.value = true

  if (emailError.value) {
    emailInputRef.value?.focus()
    return
  }
  const problem = localProblem(username.value)
  if (problem) {
    usernameState.value = problem
    usernameInputRef.value?.focus()
    return
  }
  if (usernameState.value === 'em-uso') {
    usernameInputRef.value?.focus()
    return
  }
  if (passwordError.value) {
    passwordInputRef.value?.focus()
    return
  }
  if (confirmError.value) {
    confirmInputRef.value?.focus()
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
  background: radial-gradient(ellipse at 50% 0%, rgba(242, 169, 59, 0.22), transparent 50%), var(--bg-1);
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

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-top: 0.375rem;
}

/* Erro de campo: dois sinais sempre juntos — borda #A83232 no input (via
   k-input-error) e mensagem Nunito 12px na mesma cor logo abaixo. */
.k-input-error {
  border-color: var(--err);
}
.k-input-error:focus {
  border-color: var(--err);
}
.k-field-error {
  margin: 0;
  font-family: var(--f-sans);
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--err);
}

.reg-label-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

/* Contador de caracteres do @nome — visível antes de estourar (fica âmbar
   perto do limite e vermelho ao chegar nos 20). */
.reg-counter {
  font-family: var(--f-sans);
  font-size: 0.75rem;
  color: var(--text-3);
  white-space: nowrap;
}
.reg-counter.is-near-limit {
  color: var(--warn);
}
.reg-counter.is-at-limit {
  color: var(--err);
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
  padding-left: 2rem;
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
.reg-status.is-error {
  color: var(--err);
}
.reg-status.is-neutral {
  color: var(--text-3);
}
.reg-submit {
  margin-top: 1.125rem;
}
.reg-error {
  color: var(--err);
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
/* Alvo de toque de 32px (2rem) — padding vertical fecha a altura mínima. */
.reg-foot-link {
  display: inline-flex;
  align-items: center;
  min-height: 2rem;
  padding: 0.25rem 0;
  color: var(--accent-texto);
  font-weight: 600;
  text-decoration: none;
}
.reg-foot-link:focus-visible {
  outline: none;
  box-shadow: 0 0 0 0.1875rem var(--accent);
}
</style>
