<template>
  <div v-if="liberado === false" class="ss-bloqueio">
    <div class="ss-caixa">
      <h1 class="ss-titulo"><PixelIcon name="lock" size="1rem" />Ferramenta de curadoria</h1>
      <p class="ss-texto">
        Esta tela grava no acervo do jogo e só uma conta com poder de sudo consegue salvar.
        Sem isso você conseguiria abrir e trabalhar, mas cada gravação voltaria recusada —
        e é pior descobrir isso depois de meia hora de trabalho.
      </p>
      <button class="k-btn k-btn-ghost k-btn-sm" @click="router.push('/game')">
        <PixelIcon name="corner-up-left" size="0.75rem" />voltar ao jogo
      </button>
    </div>
  </div>
  <slot v-else-if="liberado" />
  <div v-else class="ss-bloqueio"><span class="ss-carregando">verificando o acesso…</span></div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PixelIcon from '@/components/PixelIcon.vue'
import { me } from '@/services/auth.api'

// null = ainda checando. A rota só exige sessão; quem autoriza de verdade é o
// SudoGuard da API — esta guarda existe para a recusa aparecer na entrada, não
// no meio do trabalho.
const liberado = ref<boolean | null>(null)
const router = useRouter()

onMounted(async () => {
  try {
    liberado.value = (await me()).isAdmin
  } catch {
    liberado.value = false
  }
})
</script>

<style scoped>
.ss-bloqueio {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: var(--bg-0);
  padding: 1.5rem;
}

.ss-caixa {
  max-width: 30rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem;
  background: var(--bg-1);
  border: var(--ui-border-style);
  box-shadow: var(--contorno-duplo), var(--sombra-solida);
}

.ss-titulo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-family: var(--f-pixel);
  font-size: 1rem;
  letter-spacing: 0.04em;
}

.ss-texto {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.6;
  color: var(--text-2);
}

.ss-carregando {
  font-size: 0.8125rem;
  color: var(--text-3);
}
</style>
