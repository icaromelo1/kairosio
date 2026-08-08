<template>
  <div class="login-root">
    <!-- Background SVG city map -->
    <svg
      class="city-bg pixelated"
      width="100%"
      height="100%"
      viewBox="0 0 200 100"
      preserveAspectRatio="xMidYMid slice"
    >
      <rect x="0" y="62" width="200" height="1" fill="rgba(36, 28, 21, 0.35)" />
      <g fill="rgba(36, 28, 21, 0.18)">
        <rect x="10" y="50" width="6" height="12" />
        <rect x="18" y="44" width="8" height="18" />
        <rect x="28" y="48" width="4" height="14" />
        <rect x="34" y="40" width="10" height="22" />
        <rect x="46" y="46" width="6" height="16" />
        <rect x="54" y="42" width="12" height="20" />
        <rect x="68" y="50" width="6" height="12" />
        <rect x="76" y="38" width="8" height="24" />
        <rect x="86" y="46" width="6" height="16" />
        <rect x="94" y="42" width="14" height="20" />
        <rect x="110" y="50" width="6" height="12" />
        <rect x="118" y="44" width="10" height="18" />
        <rect x="130" y="46" width="6" height="16" />
        <rect x="138" y="40" width="12" height="22" />
        <rect x="152" y="48" width="6" height="14" />
        <rect x="160" y="44" width="10" height="18" />
        <rect x="172" y="48" width="8" height="14" />
        <rect x="182" y="42" width="12" height="20" />
      </g>
      <g fill="#fbbf24" opacity="0.5">
        <rect x="20" y="48" width="1" height="1" /><rect x="36" y="44" width="1" height="1" />
        <rect x="40" y="50" width="1" height="1" /><rect x="56" y="46" width="1" height="1" />
        <rect x="60" y="52" width="1" height="1" /><rect x="78" y="42" width="1" height="1" />
        <rect x="96" y="46" width="1" height="1" /><rect x="100" y="50" width="1" height="1" />
        <rect x="120" y="48" width="1" height="1" /><rect x="140" y="44" width="1" height="1" />
        <rect x="144" y="50" width="1" height="1" /><rect x="162" y="48" width="1" height="1" />
        <rect x="184" y="46" width="1" height="1" />
      </g>
    </svg>

    <!-- Top meander border -->
    <div class="border-top">
      <MeanderBorder color="var(--accent)" :height="12" :opacity="0.55" />
    </div>

    <!-- Bottom meander border -->
    <div class="border-bottom">
      <MeanderBorder color="var(--accent)" :height="12" :opacity="0.55" />
    </div>

    <!-- Center content -->
    <div class="login-center">
      <!-- Logo -->
      <div class="logo-wrap">
        <Logo id="monogram" size="lg" primary="var(--primary-hi)" accent="var(--accent)" />
      </div>

      <!-- Subtitle with columns -->
      <div class="subtitle-row">
        <PixelColumn :scale="1.2" color="var(--text-3)" :height="24" />
        <span class="subtitle-text">seu mundo produtivo</span>
        <PixelColumn :scale="1.2" color="var(--text-3)" :height="24" />
      </div>

      <!-- Login card -->
      <div class="k-card login-card">
        <div class="card-toprow">
          <span class="k-chip">v0.1 · Beta</span>
        </div>

        <!-- Email -->
        <div class="field-group">
          <label class="k-label">E-mail</label>
          <input
            v-model="email"
            class="k-input"
            type="email"
            placeholder="voce@kairos.io"
            autocomplete="email"
          />
        </div>

        <!-- Password -->
        <div class="field-group">
          <label class="k-label">Senha</label>
          <input
            v-model="password"
            class="k-input"
            type="password"
            placeholder="••••••••"
            autocomplete="current-password"
          />
        </div>

        <!-- Remember + forgot -->
        <div class="remember-row">
          <label class="remember-label">
            <input v-model="keepConnected" type="checkbox" class="k-checkbox" />
            <span>manter conectado</span>
          </label>
          <a class="forgot-link" href="#" @click.prevent>esqueci a senha</a>
        </div>

        <!-- Submit -->
        <button class="k-btn k-btn-primary submit-btn" :disabled="loading" @click="handleLogin">{{ loading ? 'Entrando…' : 'Entrar →' }}</button>
        <ErroBloco v-if="error" class="login-erro" :mensagem="error" />
        <p style="font-size:0.75rem;margin:0.625rem 0 0;text-align:center;color:var(--text-3)">
          Não tem conta?
          <a href="#" style="color:var(--accent-texto);font-weight:600;text-decoration:none" @click.prevent="goRegister">Criar conta →</a>
        </p>

        <!-- Divider -->
        <div class="k-divider">
          <span>ou continue com</span>
        </div>

        <!-- Social login grid -->
        <div class="social-grid">
          <button class="k-btn k-btn-ghost social-btn" @click="socialSoon">
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285f4" d="M22.5 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.9c-.3 1.4-1 2.6-2.2 3.4v2.8h3.6c2.1-1.9 3.2-4.7 3.2-8z" />
              <path fill="#34a853" d="M12 23c2.9 0 5.4-1 7.2-2.8l-3.6-2.8c-1 .7-2.3 1.1-3.6 1.1-2.8 0-5.1-1.9-6-4.4H2.3v2.8C4.1 20.5 7.8 23 12 23z" />
              <path fill="#fbbc04" d="M6 14.1c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1V7.1H2.3C1.5 8.6 1 10.3 1 12s.5 3.4 1.3 4.9L6 14.1z" />
              <path fill="#ea4335" d="M12 5.5c1.6 0 3 .5 4.1 1.6l3.1-3.1C17.4 2.1 14.9 1 12 1 7.8 1 4.1 3.5 2.3 7.1L6 9.9c.9-2.5 3.2-4.4 6-4.4z" />
            </svg>
            Google
          </button>
          <button class="k-btn k-btn-ghost social-btn" @click="socialSoon">
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="currentColor" d="M12 .5C5.7.5.5 5.7.5 12c0 5 3.3 9.3 7.8 10.8.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2.9-.3 2-.4 3-.4s2 .1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.7 1.6.2 2.8.1 3.1.7.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.5-1.5 7.8-5.8 7.8-10.8C23.5 5.7 18.3.5 12 .5z" />
            </svg>
            GitHub
          </button>
        </div>

      </div>

      <!-- Footer -->
      <div class="login-footer">
        <span>© Kairos 2026</span>
        <span class="footer-links">
          <a href="#" @click.prevent>termos</a>
          <span> · </span>
          <a href="#" @click.prevent>privacidade</a>
          <span> · </span>
          <a href="#" @click.prevent>discord</a>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import MeanderBorder from '@/components/pixel/MeanderBorder.vue'
import PixelColumn from '@/components/pixel/PixelColumn.vue'
import Logo from '@/components/logos/Logo.vue'
import ErroBloco from '@/components/ErroBloco.vue'
import { useAuthStore } from '@/stores/useAuthStore'
import { login } from '@/services/auth.api'
import { postAuthDest } from '@/services/postAuth'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const keepConnected = ref(false)
const error = ref('')
const loading = ref(false)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Entrar: SÓ login. Conta inexistente → manda criar conta (não cria automático).
async function handleLogin() {
  error.value = ''
  if (!EMAIL_RE.test(email.value)) {
    error.value = 'Informe um email válido.'
    return
  }
  if (!password.value) {
    error.value = 'Informe a senha.'
    return
  }
  loading.value = true
  try {
    const res = await login(email.value, password.value)
    authStore.setToken(res.token)
    router.push(await postAuthDest())
  } catch (e) {
    error.value =
      (e as Error).message === 'invalid-credentials'
        ? 'Email ou senha incorretos. Não tem conta? Crie uma.'
        : 'Não foi possível entrar. Tente de novo.'
  } finally {
    loading.value = false
  }
}

function goRegister() {
  router.push('/register')
}

function socialSoon() {
  error.value = 'Login com Google/GitHub em breve. Use email e senha.'
}

// callback de OAuth: /login?token=... → guarda a sessão e entra.
// replace (não push): a URL com o token não pode sobrar no histórico do navegador
const route = useRoute()
onMounted(async () => {
  const token = route.query.token
  if (typeof token === 'string' && token) {
    authStore.setToken(token)
    router.replace(await postAuthDest())
  }
})
</script>

<style scoped>
.login-root {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  /* B4: padding + box-sizing garante scroll da página quando o card não cabe (telas baixas) */
  padding: 2.5rem 1rem;
  box-sizing: border-box;
  background:
    radial-gradient(ellipse at 50% 60%, rgba(242, 169, 59, 0.22) 0%, transparent 55%),
    radial-gradient(ellipse at 80% 20%, rgba(251, 191, 36, 0.08) 0%, transparent 40%),
    var(--bg-0);
  overflow-x: hidden;
  overflow-y: auto;
}

.city-bg {
  position: absolute;
  inset: 0;
  opacity: 0.35;
  pointer-events: none;
  z-index: 0;
}

.border-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1;
}

.border-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1;
  transform: scaleY(-1);
}

.login-center {
  position: relative;
  z-index: 2;
  width: min(27.5rem, 100%);
  padding: 0 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  align-items: center;
}

.logo-wrap {
  display: flex;
  justify-content: center;
}

.subtitle-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.subtitle-text {
  font-size: 0.6875rem;
  color: var(--text-3);
  letter-spacing: 0.32em;
  text-transform: uppercase;
  font-family: var(--f-pixel);
  white-space: nowrap;
}

.login-card {
  width: 100%;
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.card-toprow {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.k-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  background: var(--bg-3);
  border: 0.125rem solid var(--border-strong);
  color: var(--text-3);
  font-family: var(--f-pixel);
  font-size: 0.5625rem;
  letter-spacing: 0.05em;
}


.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.k-label {
  font-family: var(--f-pixel);
  font-size: 0.5625rem;
  color: var(--text-3);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.k-input {
  width: 100%;
  background: var(--bg-1);
  border: 0.1875rem solid var(--text-3);
  color: var(--text);
  font-family: var(--f-sans);
  font-size: 0.875rem;
  padding: 0.625rem 0.75rem;
  outline: none;
  transition: border-color 0.15s;
}

.k-input:focus {
  border-color: var(--primary-hi);
}

.k-input::placeholder {
  color: var(--text-4);
}

.remember-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.remember-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-family: var(--f-sans);
  font-size: 0.8125rem;
  color: var(--text-2);
  user-select: none;
}

.k-checkbox {
  appearance: none;
  width: 1rem;
  height: 1rem;
  border: 0.1875rem solid var(--text-3);
  background: var(--bg-1);
  cursor: pointer;
  flex-shrink: 0;
  position: relative;
}

.k-checkbox:checked {
  background: var(--primary);
  border-color: var(--primary-hi);
}

.k-checkbox:checked::after {
  content: '';
  position: absolute;
  inset: 0.125rem;
  background: var(--primary-hi);
}

.forgot-link {
  font-family: var(--f-sans);
  font-size: 0.8125rem;
  color: var(--primary-hi);
  text-decoration: none;
  white-space: nowrap;
}

.forgot-link:hover {
  text-decoration: underline;
}

.submit-btn {
  width: 100%;
  padding: 0.875rem 1.125rem;
}

.login-erro {
  margin-top: 0.5rem;
}

.k-divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--text-4);
  font-family: var(--f-sans);
  font-size: 0.75rem;
}

.k-divider::before,
.k-divider::after {
  content: '';
  flex: 1;
  height: 0.0625rem;
  background: var(--border);
}

.social-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.625rem;
}

.social-btn {
  font-size: 0.6875rem;
  padding: 0.625rem 0.75rem;
  gap: 0.375rem;
}

.login-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  font-size: 0.6875rem;
  color: var(--text-4);
  font-family: var(--f-sans);
}

.footer-links {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.footer-links a {
  color: var(--text-4);
  text-decoration: none;
}

.footer-links a:hover {
  color: var(--text-3);
}
</style>
