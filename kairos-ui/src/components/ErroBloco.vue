<template>
  <div class="erro-bloco">
    <div class="erro-bloco-linha">
      <PixelIcon name="square-alert" size="0.9375rem" class="erro-bloco-icone" />
      <p class="erro-bloco-texto">{{ mensagem }}</p>
    </div>
    <button v-if="acaoTexto" class="k-btn k-btn-ghost k-btn-sm erro-bloco-acao" @click="emit('acao')">
      {{ acaoTexto }}
    </button>
    <slot />
  </div>
</template>

<script setup lang="ts">
import PixelIcon from '@/components/PixelIcon.vue'

withDefaults(defineProps<{ mensagem: string; acaoTexto?: string }>(), {
  acaoTexto: undefined,
})

const emit = defineEmits<{ acao: [] }>()
</script>

<style scoped>
/* Padrão de erro em painel: caixa creme com borda de tinta de --err (não vermelho
   puro sobre creme, que fica agressivo demais) — nunca error.message cru na tela. */
.erro-bloco {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  background: var(--bg-1);
  border: 0.125rem solid var(--err);
  box-shadow: inset 0 0 0 0.125rem rgba(244, 228, 193, 0.7);
  padding: 0.75rem 0.875rem;
}

.erro-bloco-linha {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.erro-bloco-icone {
  flex: none;
  color: var(--err);
  margin-top: 0.0625rem;
}

.erro-bloco-texto {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.45;
  color: var(--err-hi);
}

.erro-bloco-acao {
  align-self: flex-start;
}
</style>
