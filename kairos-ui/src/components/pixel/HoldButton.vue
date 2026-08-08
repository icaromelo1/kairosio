<template>
  <button
    class="hb" type="button" :disabled="disabled || carregando"
    :style="{ '--hb-progresso': `${progresso * 100}%` }"
    @pointerdown="comecar" @pointerup="cancelar" @pointerleave="cancelar"
    @keydown.space.prevent="comecar" @keyup.space.prevent="cancelar"
  >
    <span class="hb-preenche" />
    <span class="hb-texto">{{ carregando ? rotuloCarregando : segurando ? 'segure…' : rotulo }}</span>
  </button>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'

const props = withDefaults(defineProps<{
  rotulo: string
  rotuloCarregando?: string
  duracao?: number
  disabled?: boolean
  carregando?: boolean
}>(), { rotuloCarregando: 'criando…', duracao: 600, disabled: false, carregando: false })

const emit = defineEmits<{ confirmar: [] }>()

const segurando = ref(false)
const progresso = ref(0)
let raf = 0
let inicio = 0

function passo(agora: number) {
  progresso.value = Math.min(1, (agora - inicio) / props.duracao)
  if (progresso.value >= 1) {
    zerar()
    emit('confirmar')
    return
  }
  raf = requestAnimationFrame(passo)
}

function comecar(e: Event) {
  if (props.disabled || props.carregando || segurando.value) return
  e.preventDefault()
  segurando.value = true
  inicio = performance.now()
  raf = requestAnimationFrame(passo)
}

function zerar() {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
  segurando.value = false
  progresso.value = 0
}

// soltar antes do fim cancela: é o ponto do controle. escrever no mapa vale
// para todos e não desfaz, então o clique acidental não pode bastar.
function cancelar() {
  if (segurando.value) zerar()
}

onBeforeUnmount(zerar)
</script>

<style scoped>
.hb {
  position: relative;
  appearance: none;
  overflow: hidden;
  min-height: 2.5rem;
  width: 100%;
  padding: 0 0.625rem;
  background: var(--err);
  color: var(--bg-2);
  border: 0.125rem solid var(--tinta);
  box-shadow: 0 0.1875rem 0 var(--err-hi);
  cursor: pointer;
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
}
.hb:disabled { background: #e8c9b0; color: var(--err); box-shadow: none; cursor: not-allowed; }
.hb-preenche {
  position: absolute;
  inset: 0 auto 0 0;
  width: var(--hb-progresso, 0%);
  background: var(--err-hi);
}
.hb-texto { position: relative; }
</style>
