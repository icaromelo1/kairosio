<template>
  <LegalLayout titulo="Suporte">
    <p>Conte o que aconteceu. A mensagem chega direto ao criador do Kairos.</p>

    <form v-if="auth.isAuthenticated && !enviado" class="sp-form" @submit.prevent="enviar">
      <label class="sp-campo">
        <span class="k-label">assunto</span>
        <select v-model="assunto" class="k-input k-input-sm">
          <option v-for="a in ASSUNTOS" :key="a" :value="a">{{ a }}</option>
        </select>
      </label>
      <label class="sp-campo">
        <span class="k-label">mensagem</span>
        <textarea v-model.trim="mensagem" class="k-input" rows="6" maxlength="2000" placeholder="O que você fez, o que esperava e o que aconteceu." />
      </label>
      <p v-if="erro" class="sp-erro">{{ erro }}</p>
      <button class="k-btn k-btn-primary k-btn-sm" :disabled="enviando || mensagem.length < 5">{{ enviando ? 'enviando…' : 'enviar' }}</button>
      <p class="k-hint-text">A resposta vai para o e-mail da sua conta. Veja a <RouterLink to="/privacidade">política de privacidade</RouterLink>.</p>
    </form>

    <p v-else-if="enviado" class="sp-ok">Mensagem enviada. Obrigado! A resposta chega no e-mail da sua conta.</p>

    <p v-else>
      Sem estar logado, escreva para <a :href="`mailto:${CONTATO}`">{{ CONTATO }}</a>, ou
      <RouterLink to="/login">entre na sua conta</RouterLink> para usar o formulário.
    </p>

    <h2>Atalhos</h2>
    <ul>
      <li>Quer apagar a conta? Vá em <RouterLink to="/excluir-conta">Excluir conta</RouterLink>.</li>
      <li>Problemas com microfone, câmera ou alto-falante: no jogo, abra a engrenagem no rodapé da barra lateral.</li>
    </ul>
  </LegalLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import LegalLayout from './LegalLayout.vue'
import { CONTATO } from './legal'
import { createFeedback } from '@/services/feedback.api'
import { useAuthStore } from '@/stores/useAuthStore'

const ASSUNTOS = ['Erro no Kairos', 'Conta e acesso', 'Voz, vídeo e tela', 'Privacidade e dados', 'Sugestão', 'Outro assunto']

const auth = useAuthStore()
const assunto = ref(ASSUNTOS[0])
const mensagem = ref('')
const enviando = ref(false)
const enviado = ref(false)
const erro = ref('')

async function enviar() {
  erro.value = ''
  enviando.value = true
  try {
    await createFeedback({ kind: 'suporte', title: assunto.value, message: mensagem.value })
    enviado.value = true
  } catch {
    erro.value = `Não deu para enviar agora. Tente de novo ou escreva para ${CONTATO}.`
  } finally {
    enviando.value = false
  }
}
</script>

<style scoped>
.sp-form { display: flex; flex-direction: column; gap: 0.75rem; margin: 1rem 0; }
.sp-campo { display: flex; flex-direction: column; gap: 0.25rem; }
.sp-form .k-btn { align-self: flex-start; }
.sp-erro { margin: 0; color: var(--danger, #a83232); }
.sp-ok { font-weight: 700; color: var(--text); }
</style>
