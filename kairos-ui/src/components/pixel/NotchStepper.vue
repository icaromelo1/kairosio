<template>
  <div class="ns" :class="{ 'ns-disabled': disabled }">
    <button
      class="ns-step" type="button" :disabled="disabled"
      :aria-label="`diminuir ${rotulo}`" @click="ajustar(-step)"
    >−</button>

    <div
      ref="trilha"
      class="ns-trilha"
      role="slider"
      data-captura-teclado
      :tabindex="disabled ? -1 : 0"
      :aria-label="rotulo"
      :aria-valuemin="min"
      :aria-valuemax="max"
      :aria-valuenow="modelValue"
      :aria-valuetext="textoDoValor"
      @pointerdown="arrastar"
      @keydown="teclado"
      @focus="capturarTeclado"
      @blur="soltarTeclado"
    >
      <span
        v-for="(aceso, i) in pips" :key="i"
        class="ns-pip"
        :class="{ 'ns-pip-on': aceso, 'ns-pip-alto': i % marcaCada === 0 }"
      />
      <span class="ns-punho" :style="{ left: posicaoPunho }" />
    </div>

    <button
      class="ns-step" type="button" :disabled="disabled"
      :aria-label="`aumentar ${rotulo}`" @click="ajustar(step)"
    >+</button>
  </div>

  <p v-if="focado" class="ns-aviso"><span class="k-key">⌨</span>WASD pausado — Esc ou clique fora devolve</p>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: number
  min: number
  max: number
  step: number
  entalhes?: number
  rotulo: string
  disabled?: boolean
  escopo?: 'eu' | 'mundo'
}>(), { entalhes: 12, disabled: false, escopo: 'eu' })

const emit = defineEmits<{ 'update:modelValue': [number]; commit: [number] }>()

const TECLAS_DO_JOGO = new Set([' ', 'e', 'b', 'g', 'h', 'v', 'w', 'a', 's', 'd'])

const trilha = ref<HTMLElement | null>(null)
const focado = ref(false)

const fracao = computed(() => {
  const span = props.max - props.min
  return span <= 0 ? 0 : (props.modelValue - props.min) / span
})

const marcaCada = computed(() => (props.entalhes > 16 ? 6 : 3))

const pips = computed(() =>
  Array.from({ length: props.entalhes }, (_, i) => i / (props.entalhes - 1) <= fracao.value + 1e-9),
)

const posicaoPunho = computed(() => `calc(${(fracao.value * 100).toFixed(2)}% - ${(fracao.value * 1.25).toFixed(2)}rem)`)

const textoDoValor = computed(() => props.modelValue.toFixed(props.step < 1 ? 1 : 0))

function fixar(valor: number) {
  const passos = Math.round((valor - props.min) / props.step)
  const bruto = props.min + passos * props.step
  const casas = props.step < 1 ? 2 : 0
  return Number(Math.min(props.max, Math.max(props.min, bruto)).toFixed(casas))
}

function definir(valor: number) {
  const v = fixar(valor)
  if (v !== props.modelValue) emit('update:modelValue', v)
  return v
}

function ajustar(delta: number) {
  if (props.disabled) return
  emit('commit', definir(props.modelValue + delta))
}

function valorNoPonto(clientX: number): number {
  const el = trilha.value
  if (!el) return props.modelValue
  const r = el.getBoundingClientRect()
  const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
  return props.min + f * (props.max - props.min)
}

function arrastar(e: PointerEvent) {
  if (props.disabled) return
  const el = trilha.value
  if (!el) return
  el.focus()
  definir(valorNoPonto(e.clientX))
  const mover = (ev: PointerEvent) => definir(valorNoPonto(ev.clientX))
  const soltar = () => {
    window.removeEventListener('pointermove', mover)
    window.removeEventListener('pointerup', soltar)
    emit('commit', props.modelValue)
  }
  window.addEventListener('pointermove', mover)
  window.addEventListener('pointerup', soltar)
}

// o jogo lê WASD, setas e espaço direto do window. enquanto a trilha tem foco,
// tudo isso é do controle — e a devolução no blur/Esc não é detalhe: sem ela a
// pessoa fica presa no slider sem conseguir andar
function capturarTeclado() {
  if (props.disabled) return
  focado.value = true
}

function soltarTeclado() {
  focado.value = false
}

function teclado(e: KeyboardEvent) {
  if (props.disabled) return
  const grande = (props.max - props.min) / 10
  const mapa: Record<string, number> = {
    ArrowLeft: -props.step, ArrowDown: -props.step, a: -props.step, s: -props.step,
    ArrowRight: props.step, ArrowUp: props.step, d: props.step, w: props.step,
    PageDown: -grande, PageUp: grande,
  }
  const tecla = e.key.length === 1 ? e.key.toLowerCase() : e.key

  if (tecla === 'Escape' || tecla === 'Enter') {
    trilha.value?.blur()
    e.preventDefault()
    e.stopPropagation()
    return
  }
  if (tecla === 'Home') { emit('commit', definir(props.min)); e.preventDefault(); e.stopPropagation(); return }
  if (tecla === 'End') { emit('commit', definir(props.max)); e.preventDefault(); e.stopPropagation(); return }

  const delta = mapa[tecla]
  if (delta === undefined) {
    // teclas que o jogo consome (andar, interagir, dançar, voz, esconder HUD)
    // são engolidas mesmo sem mexer no valor: com o stepper focado, apertar E
    // não pode interagir com o cenário nem V abrir a sala de voz
    if (TECLAS_DO_JOGO.has(tecla)) { e.preventDefault(); e.stopPropagation() }
    return
  }
  emit('commit', definir(props.modelValue + delta))
  e.preventDefault()
  e.stopPropagation()
}

// se o componente sumir com o foco dentro (painel fechado, troca de mundo), o
// blur nunca dispara e o aviso ficaria mentindo
onBeforeUnmount(soltarTeclado)
</script>

<style scoped>
.ns {
  display: flex;
  gap: 0.25rem;
  align-items: stretch;
  width: 100%;
}

.ns-step {
  appearance: none;
  width: 2.125rem;
  min-width: 2.125rem;
  height: 2.125rem;
  border: 0.125rem solid var(--tinta);
  background: var(--bg-2);
  color: var(--text);
  font-family: var(--f-num);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 0.125rem 0 var(--tinta);
}
.ns-step:hover { background: var(--bg-4); }
.ns-step:active { transform: translateY(0.125rem); box-shadow: none; }
.ns-step:disabled { background: var(--bg-0); color: #a99c84; border-color: #b9ac93; box-shadow: none; cursor: not-allowed; }

.ns-trilha {
  position: relative;
  flex: 1;
  height: 2.125rem;
  display: flex;
  align-items: flex-end;
  gap: 0.125rem;
  padding: 0 0.5rem 0.5rem;
  background: var(--bg-2);
  border: 0.125rem solid var(--tinta);
  box-shadow: inset 0 0.125rem 0 rgba(36, 28, 21, 0.08);
  cursor: ew-resize;
  outline: none;
  touch-action: none;
}
.ns-trilha:focus-visible { box-shadow: 0 0 0 0.1875rem var(--accent); }

.ns-pip {
  flex: 1;
  height: 0.625rem;
  background: rgba(36, 28, 21, 0.16);
}
.ns-pip-alto { height: 1rem; }
.ns-pip-on { background: var(--primary); }

.ns-punho {
  position: absolute;
  top: -0.1875rem;
  width: 1.25rem;
  height: 2.375rem;
  background: var(--tinta);
  box-shadow: inset 0 0 0 0.125rem var(--bg-1), inset 0 -0.375rem 0 0 var(--primary);
  pointer-events: none;
}

.ns-disabled .ns-trilha { background: var(--bg-0); border-color: #b9ac93; cursor: not-allowed; }
.ns-disabled .ns-pip { background: #c9bca3; }
.ns-disabled .ns-punho { background: #b9ac93; box-shadow: inset 0 0 0 0.125rem var(--bg-0); }

.ns-aviso {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin: 0.25rem 0 0;
  padding: 0.25rem 0.375rem;
  background: var(--accent);
  border: 0.125rem solid var(--tinta);
  color: var(--tinta);
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
</style>
