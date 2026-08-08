<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import PixelIcon from '@/components/PixelIcon.vue'
import TileThumb from '@/components/TileThumb.vue'
import { buscar, categorias, type TileResultado } from '@/game/furniture/busca'

const props = withDefaults(
  defineProps<{
    /** Peça em uso, para marcar o item já escolhido. */
    atual?: { pack: string; i: number } | null
    desabilitado?: boolean
    limite?: number
  }>(),
  { atual: null, desabilitado: false, limite: 60 },
)

const emit = defineEmits<{ escolher: [TileResultado] }>()

const idBusca = useId()
const idCat = useId()

const termo = ref('')
const cat = ref('')
const emDestaque = ref<TileResultado | null>(null)

const categoriasDisponiveis = categorias()

const resultados = computed<TileResultado[]>(() => {
  if (!termo.value.trim() && !cat.value) return []
  return buscar(termo.value, cat.value || undefined).slice(0, props.limite)
})

const buscando = computed(() => !!termo.value.trim() || !!cat.value)

function ehAtual(r: TileResultado): boolean {
  return !!props.atual && props.atual.pack === r.pack && props.atual.i === r.i
}

/* O nome fica numa linha própria embaixo da grade, não dentro do botão: rótulo
   dentro de uma célula de 2.75rem seria cortado em quase toda peça. */
const legenda = computed(() => {
  const r = emDestaque.value
  if (!r) return ''
  return `${r.nome} · ${r.cat} · ${r.pack}${r.solido ? ' · sólido' : ''}`
})
</script>

<template>
  <div class="cat">
    <label class="k-label" :for="idBusca">Buscar peças</label>
    <input
      :id="idBusca"
      v-model.trim="termo"
      class="k-input cat-campo"
      placeholder="nome ou tag (ex.: árvore)"
      :disabled="desabilitado"
    />

    <label class="k-label" :for="idCat">Categoria</label>
    <div class="cat-select-wrap">
      <select :id="idCat" v-model="cat" class="k-input cat-campo cat-select" :disabled="desabilitado">
        <option value="">todas as categorias</option>
        <option v-for="c in categoriasDisponiveis" :key="c" :value="c">{{ c }}</option>
      </select>
      <PixelIcon name="chevron-down" size="0.75rem" class="cat-select-seta" />
    </div>

    <p v-if="!buscando" class="cat-dica">Digite um nome ou escolha uma categoria pra ver as peças.</p>
    <p v-else-if="!resultados.length" class="cat-dica">Nenhuma peça encontrada.</p>

    <div v-else class="cat-grade" role="listbox" aria-label="Peças do catálogo">
      <button
        v-for="r in resultados"
        :key="r.pack + '-' + r.i"
        type="button"
        role="option"
        class="cat-item"
        :class="{ 'k-active': ehAtual(r) }"
        :aria-selected="ehAtual(r)"
        :aria-label="r.nome"
        :title="`${r.nome} (${r.pack})`"
        :disabled="desabilitado"
        @click="emit('escolher', r)"
        @pointerenter="emDestaque = r"
        @focus="emDestaque = r"
      >
        <TileThumb :peca="{ pack: r.pack, i: r.i, cols: r.cols, tile: r.tile }" />
      </button>
    </div>

    <p v-if="legenda" class="cat-legenda">{{ legenda }}</p>
  </div>
</template>

<style scoped>
.cat {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.cat-campo {
  width: 100%;
  min-height: 2rem;
}

.cat-select-wrap {
  position: relative;
  display: block;
}

.cat-select {
  appearance: none;
  padding-right: 1.75rem;
  text-transform: lowercase;
}

.cat-select-seta {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-3);
  pointer-events: none;
}

.cat-dica {
  margin: 0.25rem 0 0;
  font-size: 0.6875rem;
  line-height: 1.4;
  color: var(--text-3);
}

.cat-grade {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(2.75rem, 1fr));
  gap: 0.25rem;
  max-height: 13rem;
  overflow-y: auto;
  margin-top: 0.25rem;
  padding: 0.125rem;
}

/* 2.75rem = 44px de alvo, acima do mínimo de 32px */
.cat-item {
  min-width: 2.75rem;
  min-height: 2.75rem;
  padding: 0.1875rem;
  background: var(--bg-2);
  border: 0.125rem solid var(--tinta);
  cursor: pointer;
  display: block;
  box-shadow: 0 0.125rem 0 var(--tinta);
}

.cat-item:hover:not(:disabled) {
  background: var(--bg-4);
}

.cat-item:focus-visible {
  outline: none;
  box-shadow: 0 0.125rem 0 var(--tinta), 0 0 0 0.1875rem var(--accent);
}

.cat-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* .k-active pinta o fundo de musgo; a moldura interna creme separa a arte do
   tile do fundo escuro do estado ativo */
.cat-item.k-active {
  box-shadow: inset 0 0 0 0.125rem var(--bg-2), 0 0.125rem 0 var(--tinta);
}

.cat-legenda {
  margin: 0.25rem 0 0;
  font-size: 0.6875rem;
  line-height: 1.4;
  color: var(--text-2);
  overflow-wrap: anywhere;
}
</style>
