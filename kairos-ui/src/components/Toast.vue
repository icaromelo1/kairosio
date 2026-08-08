<template>
  <div class="toast-host" aria-live="polite">
    <TransitionGroup name="toast" tag="div" class="toast-list">
      <div v-for="a in avisos" :key="a.id" class="toast" :class="`toast-${a.tipo}`">
        <PixelIcon :name="iconePara(a.tipo)" size="0.875rem" class="toast-icone" />
        <p class="toast-texto">{{ a.texto }}</p>
        <button class="toast-fechar" aria-label="Fechar aviso" @click="fecharAviso(a.id)">
          <PixelIcon name="close" size="0.75rem" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import PixelIcon from '@/components/PixelIcon.vue'
import { avisos, fecharAviso, type TipoAviso } from '@/services/avisos'

function iconePara(tipo: TipoAviso): string {
  return tipo === 'ok' ? 'check' : 'square-alert'
}
</script>

<style scoped>
/* Host global de toast: canto inferior direito, nunca sobre a coluna central
   (reservada ao avatar). position:fixed relativo à viewport, acima de tudo. */
.toast-host {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 9999;
  pointer-events: none;
  display: flex;
  justify-content: flex-end;
  max-width: min(20rem, calc(100vw - 2rem));
}

.toast-list {
  display: flex;
  flex-direction: column-reverse;
  gap: 0.5rem;
  align-items: flex-end;
  width: 100%;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  width: 100%;
  background: var(--bg-1);
  border: 0.125rem solid var(--tinta);
  box-shadow: var(--ui-shadow);
  padding: 0.625rem 0.75rem;
}

.toast-erro { border-color: var(--err); }
.toast-aviso { border-color: var(--warn); }
.toast-ok { border-color: var(--ok); }

.toast-icone { flex: none; margin-top: 0.125rem; }
.toast-erro .toast-icone { color: var(--err); }
.toast-aviso .toast-icone { color: var(--warn); }
.toast-ok .toast-icone { color: var(--ok); }

.toast-texto {
  margin: 0;
  flex: 1;
  font-size: 0.8125rem;
  line-height: 1.4;
  color: var(--text);
}

.toast-fechar {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  padding: 0.125rem;
  flex: none;
  display: inline-flex;
}
.toast-fechar:hover {
  color: var(--text);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(0.5rem);
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: none;
  }
  .toast-enter-from,
  .toast-leave-to {
    opacity: 1;
    transform: none;
  }
}
</style>
