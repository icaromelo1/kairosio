<template>
  <div class="lg-root">
    <header class="lg-topo">
      <RouterLink to="/" class="lg-marca">Kairos</RouterLink>
      <nav class="lg-nav" aria-label="Páginas de ajuda">
        <RouterLink to="/termos">Termos</RouterLink>
        <RouterLink to="/privacidade">Privacidade</RouterLink>
        <RouterLink to="/suporte">Suporte</RouterLink>
        <RouterLink to="/excluir-conta">Excluir conta</RouterLink>
      </nav>
    </header>
    <main class="lg-conteudo">
      <h1>{{ titulo }}</h1>
      <p v-if="atualizado" class="lg-data">Atualizado em {{ atualizado }}</p>
      <slot />
    </main>
    <footer class="lg-rodape">
      <span>Kairos · feito por Icaro Melo</span>
      <a :href="`mailto:${CONTATO}`">{{ CONTATO }}</a>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { CONTATO } from './legal'

defineProps<{ titulo: string; atualizado?: string }>()
</script>

<style scoped>
.lg-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-0);
  color: var(--text);
}
.lg-topo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-bottom: 0.125rem solid var(--border-strong);
  background: var(--bg-1);
}
.lg-marca { font-family: 'Pixelify Sans', sans-serif; font-weight: 700; font-size: 1.25rem; color: var(--text); text-decoration: none; }
.lg-nav { display: flex; flex-wrap: wrap; gap: 1rem; font-size: 0.875rem; }
.lg-nav a { color: var(--text-2); text-decoration: none; }
.lg-nav a.router-link-active { color: var(--text); font-weight: 700; text-decoration: underline; }
.lg-conteudo {
  flex: 1;
  width: 100%;
  max-width: 46rem;
  margin: 0 auto;
  padding: 2rem 1.25rem 3rem;
  line-height: 1.6;
  font-size: 0.9375rem;
}
.lg-conteudo :deep(h1) { font-size: 1.75rem; margin: 0 0 0.25rem; }
.lg-conteudo :deep(h2) { font-size: 1.125rem; margin: 2rem 0 0.5rem; }
.lg-conteudo :deep(p), .lg-conteudo :deep(li) { color: var(--text-2); }
.lg-conteudo :deep(ul) { padding-left: 1.25rem; }
.lg-conteudo :deep(a) { color: var(--primary-hi, var(--text)); }
.lg-data { margin: 0 0 1.5rem; font-size: 0.8125rem; color: var(--text-4); }
.lg-rodape {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 1rem 1.25rem;
  font-size: 0.8125rem;
  color: var(--text-3);
  border-top: 0.125rem solid var(--border-strong);
}
.lg-rodape a { color: var(--text-3); }
</style>
