<template>
  <div v-if="itens.length" class="ab" aria-live="polite">
    <span class="ab-titulo">ativos</span>
    <button
      v-for="i in itens" :key="i.id"
      class="ab-chip" :class="i.escopo === 'mundo' ? 'ab-mundo' : 'ab-eu'"
      type="button" :title="`desligar ${i.label}`"
      @click="emit('desligar', i.id)"
    >{{ i.label }}</button>
  </div>
</template>

<script setup lang="ts">
export interface PoderAtivo { id: string; label: string; escopo?: 'eu' | 'mundo' }
defineProps<{ itens: PoderAtivo[] }>()
const emit = defineEmits<{ desligar: [string] }>()
</script>

<style scoped>
.ab {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem;
  background: var(--tinta);
  border: 0.125rem solid var(--tinta);
  box-shadow: 0 0.25rem 0 #0d0b08;
  flex-wrap: wrap;
}
.ab-titulo {
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #b9ac93;
  padding: 0 0.25rem;
}
.ab-chip {
  appearance: none;
  border: none;
  cursor: pointer;
  padding: 0.3125rem 0.375rem;
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--bg-2);
}
.ab-eu { background: var(--primary); }
.ab-mundo { background: var(--mundo); }
.ab-chip:hover { box-shadow: inset 0 0 0 0.125rem rgba(255, 246, 224, 0.6); }
</style>
