<template>
  <LegalLayout titulo="Excluir minha conta">
    <p>Apagar a conta remove na hora:</p>
    <ul>
      <li>conta, @nome, e-mail e login com Google ou GitHub;</li>
      <li>personagem;</li>
      <li>mensagens diretas, amizades e convites;</li>
      <li>participação em servidores e feedbacks enviados.</li>
    </ul>
    <p>
      Servidores em que você é dono passam para o membro mais antigo (administradores primeiro). Se não houver mais
      ninguém, o servidor é apagado com tudo o que tem dentro. Tarefas e notas que você criou em servidores com outras
      pessoas continuam lá, sem ligação com você. Cópias de segurança do banco vencem em até 90 dias. Não dá para desfazer.
    </p>

    <form v-if="auth.isAuthenticated" class="ec-form" @submit.prevent="excluir">
      <label class="ec-campo">
        <span class="k-label">digite EXCLUIR para confirmar</span>
        <input v-model.trim="confirmacao" class="k-input k-input-sm" autocomplete="off" />
      </label>
      <p v-if="erro" class="ec-erro">{{ erro }}</p>
      <button class="k-btn k-btn-sm ec-botao" :disabled="confirmacao !== 'EXCLUIR' || excluindo">
        {{ excluindo ? 'excluindo…' : 'excluir minha conta' }}
      </button>
    </form>
    <p v-else-if="excluida" class="ec-ok">Conta excluída. Obrigado por ter passado pelo Kairos.</p>
    <p v-else>
      <RouterLink to="/login">Entre na sua conta</RouterLink> e volte a esta página para excluí-la. Se não consegue entrar,
      escreva para <a :href="`mailto:${CONTATO}`">{{ CONTATO }}</a> a partir do e-mail da conta.
    </p>
  </LegalLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import LegalLayout from './LegalLayout.vue'
import { CONTATO } from './legal'
import { excluirConta } from '@/services/auth.api'
import { useAuthStore } from '@/stores/useAuthStore'

const auth = useAuthStore()
const confirmacao = ref('')
const excluindo = ref(false)
const excluida = ref(false)
const erro = ref('')

async function excluir() {
  erro.value = ''
  excluindo.value = true
  try {
    await excluirConta()
    auth.logout()
    excluida.value = true
  } catch {
    erro.value = `Não deu para excluir agora. Tente de novo ou escreva para ${CONTATO}.`
  } finally {
    excluindo.value = false
  }
}
</script>

<style scoped>
.ec-form { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1.5rem; max-width: 20rem; }
.ec-campo { display: flex; flex-direction: column; gap: 0.25rem; }
.ec-botao { align-self: flex-start; background: #a83232; color: #fff; border-color: #6e1f1f; }
.ec-botao:disabled { opacity: 0.5; }
.ec-erro { margin: 0; color: var(--danger, #a83232); }
.ec-ok { font-weight: 700; color: var(--text); }
</style>
