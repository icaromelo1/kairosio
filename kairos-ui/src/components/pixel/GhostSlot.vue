<template>
  <div class="gs" aria-hidden="true">{{ label || 'n/a' }}</div>
</template>

<script setup lang="ts">
defineProps<{ label?: string }>()
</script>

<style scoped>
/* slot condicional que não se aplica agora. ocupa o mesmo espaço em vez de
   colapsar: sem isto a barra muda de largura sozinha e os botões dançam de
   lugar quando a pessoa entra ou sai de uma sala. */
.gs {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 2.125rem;
  border: 0.125rem dashed rgba(36, 28, 21, 0.28);
  color: rgba(36, 28, 21, 0.4);
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
</style>
