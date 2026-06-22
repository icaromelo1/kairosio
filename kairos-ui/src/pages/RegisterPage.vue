<template>
  <div class="reg-root">
    <div class="reg-card">
      <Logo id="monogram" size="lg" primary="var(--primary-hi)" accent="var(--accent)" />
      <h1>Criar conta</h1>
      <p class="reg-sub">Crie sua conta pra entrar no Kairos e ter seu mundo.</p>

      <label class="reg-label">E-mail</label>
      <input v-model="email" type="email" class="k-input" placeholder="voce@email.com" @keyup.enter="submit" />

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
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { register } from '@/services/auth.api'
import { useAuthStore } from '@/stores/useAuthStore'
import { consumePendingInvite } from '@/services/org.api'
import Logo from '@/components/logos/Logo.vue'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const confirm = ref('')
const error = ref('')
const loading = ref(false)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function submit() {
  error.value = ''
  if (!EMAIL_RE.test(email.value)) {
    error.value = 'Informe um email válido.'
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
    const res = await register(email.value, password.value)
    authStore.setToken(res.token)
    // se veio por link de convite, leva o código pro onboarding já preenchido
    const invite = consumePendingInvite()
    router.push(invite ? { path: '/onboarding', query: { invite } } : '/onboarding')
  } catch (e) {
    const code = (e as Error).message
    error.value =
      code === 'email-exists'
        ? 'Este email já está cadastrado. Faça login.'
        : code === 'invalid-input'
          ? 'Dados inválidos. Confira email e senha.'
          : 'Não foi possível criar a conta. Tente de novo.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.reg-root {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background: radial-gradient(ellipse at 50% 0%, rgba(124, 58, 237, 0.18), transparent 50%), var(--bg-1);
}
.reg-card {
  width: min(420px, 100%);
  background: var(--bg-2);
  border: 1px solid var(--border-strong);
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.reg-card h1 {
  font-size: 24px;
  margin: 14px 0 0;
  font-weight: 600;
  letter-spacing: -0.02em;
}
.reg-sub {
  color: var(--text-3);
  font-size: 14px;
  margin: 0 0 12px;
}
.reg-label {
  font-size: 11px;
  letter-spacing: 0.14em;
  color: var(--text-3);
  text-transform: uppercase;
  margin-top: 8px;
}
.reg-submit {
  margin-top: 18px;
}
.reg-error {
  color: #f87171;
  font-size: 12px;
  margin: 10px 0 0;
  text-align: center;
}
.reg-foot {
  font-size: 12px;
  text-align: center;
  color: var(--text-3);
  margin: 14px 0 0;
}
.reg-foot a {
  color: var(--accent);
  font-weight: 600;
  text-decoration: none;
}
</style>
