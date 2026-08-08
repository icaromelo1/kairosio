<template>
  <button
    class="tr" type="button" role="switch"
    :aria-checked="modelValue" :disabled="disabled"
    :class="{ 'tr-on': modelValue }"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span class="tr-switch"><span class="tr-knob" /></span>
    <span class="tr-texto">
      <span class="tr-label">{{ label }}</span>
      <span v-if="hint" class="tr-hint">{{ hint }}</span>
    </span>
    <span class="tr-estado">{{ modelValue ? 'ON' : 'OFF' }}</span>
  </button>
</template>

<script setup lang="ts">
defineProps<{ modelValue: boolean; label: string; hint?: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()
</script>

<style scoped>
.tr {
  appearance: none;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  min-height: 2.5rem;
  padding: 0.375rem 0.625rem;
  background: var(--bg-2);
  border: 0.125rem solid var(--tinta);
  cursor: pointer;
  text-align: left;
}
.tr:hover:not(:disabled) { background: var(--bg-4); }
.tr:disabled { opacity: 0.55; cursor: not-allowed; }
.tr-on { box-shadow: inset 0.25rem 0 0 var(--primary); }

.tr-switch {
  display: flex;
  width: 2.125rem;
  min-width: 2.125rem;
  height: 1.125rem;
  padding: 0.0625rem;
  background: #d9c9aa;
  border: 0.125rem solid var(--tinta);
  justify-content: flex-start;
}
.tr-on .tr-switch { background: var(--primary); justify-content: flex-end; }
.tr-knob { width: 0.75rem; height: 0.75rem; background: var(--bg-1); box-shadow: inset 0 0 0 1px rgba(36, 28, 21, 0.35); }
.tr-on .tr-knob { background: var(--bg-2); }

.tr-texto { flex: 1; display: flex; flex-direction: column; gap: 0.0625rem; min-width: 0; }
.tr-label {
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text);
}
/* a dica quebra em duas linhas em rótulo longo: com altura fixa ela vazava por
   cima da linha seguinte */
.tr-hint { font-family: var(--f-sans); font-size: 0.6875rem; line-height: 1.25; color: var(--text-3); }
.tr-estado { font-family: var(--f-pixel); font-size: 0.5rem; letter-spacing: 0.1em; color: var(--text-3); }
.tr-on .tr-estado { color: var(--primary-hi); }
</style>
