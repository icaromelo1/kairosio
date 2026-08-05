<template>
  <section class="cc" :class="`cc-${escopo}`">
    <header class="cc-head">
      <span class="cc-titulo">{{ titulo }}</span>
      <span v-if="nota" class="cc-nota">{{ nota }}</span>
    </header>
    <div class="cc-corpo"><slot /></div>
    <footer v-if="$slots.rodape" class="cc-rodape"><slot name="rodape" /></footer>
  </section>
</template>

<script setup lang="ts">
defineProps<{ titulo: string; nota?: string; escopo?: 'eu' | 'mundo' }>()
</script>

<style scoped>
.cc {
  background: var(--bg-1);
  border: 0.125rem solid var(--tinta);
  box-shadow: var(--ui-shadow);
  width: 100%;
}
.cc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.4375rem 0.625rem;
}
.cc-eu .cc-head { background: var(--primary); box-shadow: inset 0 -0.125rem 0 var(--primary-lo); }
.cc-mundo .cc-head { background: var(--mundo); box-shadow: inset 0 -0.125rem 0 var(--mundo-hi); }
.cc-titulo {
  font-family: var(--f-pixel);
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--bg-2);
}
.cc-nota { font-family: var(--f-pixel); font-size: 0.5rem; letter-spacing: 0.08em; color: rgba(255, 246, 224, 0.75); }
.cc-corpo { padding: 0.75rem; display: flex; flex-direction: column; gap: 0.625rem; }
.cc-rodape { border-top: 0.125rem solid var(--tinta); display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; }
</style>
