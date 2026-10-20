<template>
  <PanelShell title="personagem" icon="user" size="lg" :bloqueado="obrigatorio" @close="emit('close')">
    <div class="pp-root">
      <section class="pp-previa">
        <canvas ref="tela" class="pp-tela" />
        <div class="pp-poses">
          <button
            v-for="p in POSES" :key="p.pose"
            class="k-btn k-btn-ghost k-btn-xs" :class="{ 'k-active': pose === p.pose }"
            @click="trocarPose(p.pose)"
          >{{ p.nome }}</button>
        </div>
        <button class="k-btn k-btn-accent k-btn-sm pp-sortear" @click="sortear">
          <PixelIcon name="shuffle" size="0.75rem" />sortear
        </button>
        <div class="pp-presets">
          <span class="k-label">prontos</span>
          <button v-for="p in PRESETS" :key="p.nome" class="k-btn k-btn-ghost k-btn-xs" @click="usar(p.aparencia)">{{ p.nome }}</button>
        </div>
      </section>

      <section class="pp-opcoes">
        <div v-if="precisaNome" class="pp-nome">
          <label class="k-label" for="pp-nome">seu @nome</label>
          <input id="pp-nome" v-model.trim="nome" class="k-input k-input-sm" maxlength="20" placeholder="como vão te chamar" />
        </div>

        <nav class="pp-abas">
          <button class="pp-aba" :class="{ 'pp-aba-on': aba === 'corpo' }" @click="aba = 'corpo'">Corpo</button>
          <button
            v-for="s in SLOTS_EDITAVEIS" :key="s.slot"
            class="pp-aba" :class="{ 'pp-aba-on': aba === s.slot }"
            @click="aba = s.slot"
          >{{ s.nome }}</button>
        </nav>

        <div v-if="aba === 'corpo'" class="pp-painel">
          <span class="k-label">pele</span>
          <div class="pp-cores">
            <button
              v-for="c in TONS_DE_PELE" :key="c"
              class="pp-cor" :class="{ 'pp-cor-on': aparencia.pele === c }" :style="{ background: c }"
              :aria-label="`pele ${c}`" @click="aparencia.pele = c"
            />
          </div>
          <span class="k-label">cor do cabelo</span>
          <div class="pp-cores">
            <button
              v-for="c in CORES_DE_CABELO" :key="c"
              class="pp-cor" :class="{ 'pp-cor-on': aparencia.corCabelo === c }" :style="{ background: c }"
              :aria-label="`cabelo ${c}`" @click="definirCorCabelo(c)"
            />
            <input type="color" class="pp-cor-livre" :value="aparencia.corCabelo" aria-label="outra cor de cabelo" @input="definirCorCabelo(($event.target as HTMLInputElement).value)" />
          </div>
          <span class="k-label">cabelo</span>
          <div class="pp-itens">
            <button
              v-for="p in pecasDo('cabelo')" :key="p.id"
              class="pp-item" :class="{ 'pp-item-on': aparencia.pecas.cabelo.id === p.id }"
              @click="aparencia.pecas.cabelo.id = p.id"
            >{{ p.nome }}</button>
          </div>
        </div>

        <div v-else class="pp-painel">
          <span class="k-label">modelo</span>
          <div class="pp-itens">
            <button
              v-for="p in pecasDo(aba)" :key="p.id"
              class="pp-item" :class="{ 'pp-item-on': aparencia.pecas[aba].id === p.id }"
              @click="aparencia.pecas[aba].id = p.id"
            >{{ p.nome }}</button>
          </div>
          <template v-if="slotAtual?.colorivel && aparencia.pecas[aba].id !== 'nenhum' && !pecaDe(aba, aparencia.pecas[aba].id)?.semCor">
            <span class="k-label">cor</span>
            <div class="pp-cores">
              <button
                v-for="c in CORES_DE_ROUPA" :key="c"
                class="pp-cor" :class="{ 'pp-cor-on': aparencia.pecas[aba].cor === c }" :style="{ background: c }"
                :aria-label="`cor ${c}`" @click="aparencia.pecas[aba].cor = c"
              />
              <input type="color" class="pp-cor-livre" :value="aparencia.pecas[aba].cor" aria-label="outra cor" @input="aparencia.pecas[aba].cor = ($event.target as HTMLInputElement).value" />
            </div>
          </template>
          <p v-if="pecaDe(aba, aparencia.pecas[aba].id)?.semCor" class="k-hint-text">
            Segue a cor do cabelo (aba Corpo).
          </p>
        </div>

        <p v-if="erro" class="pp-erro">{{ erro }}</p>
        <div class="pp-rodape">
          <button v-if="!obrigatorio" class="k-btn k-btn-ghost k-btn-sm" @click="emit('close')">cancelar</button>
          <button class="k-btn k-btn-primary k-btn-sm" :disabled="salvando || (precisaNome && !nome)" @click="salvar">
            {{ salvando ? 'salvando…' : obrigatorio ? 'entrar no escritório' : 'salvar' }}
          </button>
        </div>
      </section>
    </div>
  </PanelShell>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import PanelShell from '@/components/PanelShell.vue'
import PixelIcon from '@/components/PixelIcon.vue'
import { useAuthStore } from '@/stores/useAuthStore'
import { changeUsername, UsernameError } from '@/services/auth.api'
import { buscarPersonagem, salvarAparencia } from '@/services/personagem.api'
import { emitNomeAtualizado } from '@/services/presence'
import {
  APARENCIA_PADRAO, CORES_DE_CABELO, CORES_DE_ROUPA, PRESETS, SLOTS, TONS_DE_PELE,
  aparenciaAleatoria, pecaDe, pecasDo, sanitizarAparencia, type Aparencia, type Slot,
} from '@/mundo/personagem/catalogo'
import type { Previa } from '@/mundo/personagem/previa'
import type { Pose } from '@/mundo/tipos'

const props = defineProps<{ obrigatorio?: boolean }>()
const emit = defineEmits<{ close: []; salvo: [aparencia: Aparencia] }>()

const POSES: { pose: Pose; nome: string }[] = [
  { pose: 'parado', nome: 'parado' },
  { pose: 'andar', nome: 'andar' },
  { pose: 'acenar', nome: 'acenar' },
  { pose: 'dancar', nome: 'dançar' },
  { pose: 'correr', nome: 'correr' },
  { pose: 'sentar', nome: 'sentar' },
]
const SLOTS_EDITAVEIS = SLOTS.filter((s) => s.slot !== 'cabelo')

const auth = useAuthStore()
const tela = ref<HTMLCanvasElement | null>(null)
const aparencia = reactive<Aparencia>(copiar(APARENCIA_PADRAO))
const aba = ref<'corpo' | Slot>('corpo')
const pose = ref<Pose>('parado')
const nome = ref('')
const erro = ref('')
const salvando = ref(false)
const precisaNome = computed(() => !auth.username)
const slotAtual = computed(() => SLOTS.find((s) => s.slot === aba.value) ?? null)
let previa: Previa | null = null

function copiar(a: Aparencia): Aparencia {
  return JSON.parse(JSON.stringify(a)) as Aparencia
}

function usar(nova: Aparencia) {
  Object.assign(aparencia, copiar(nova))
}

function sortear() {
  usar(aparenciaAleatoria())
}

function definirCorCabelo(cor: string) {
  aparencia.corCabelo = cor
  aparencia.pecas.cabelo.cor = cor
}

function trocarPose(nova: Pose) {
  pose.value = nova
  previa?.pose(nova)
}

watch(aparencia, () => { void previa?.mostrar(copiar(aparencia)) }, { deep: true })

async function salvar() {
  erro.value = ''
  salvando.value = true
  try {
    if (precisaNome.value) {
      const resposta = await changeUsername(nome.value)
      auth.setUsername(resposta.username ?? nome.value)
      emitNomeAtualizado()
    }
    const final = copiar(aparencia)
    await salvarAparencia(final)
    emit('salvo', final)
  } catch (e) {
    erro.value = e instanceof UsernameError || e instanceof Error ? e.message : 'Não deu pra salvar.'
  } finally {
    salvando.value = false
  }
}

onMounted(async () => {
  const atual = await buscarPersonagem().catch(() => null)
  if (atual?.aparencia) usar(sanitizarAparencia(atual.aparencia))
  else if (props.obrigatorio) usar(aparenciaAleatoria())
  if (!tela.value) return
  const { Previa: ClassePrevia } = await import('@/mundo/personagem/previa')
  previa = new ClassePrevia(tela.value)
  await previa.mostrar(copiar(aparencia))
})

onUnmounted(() => {
  previa?.destruir()
  previa = null
})
</script>

<style scoped>
.pp-root {
  display: grid;
  grid-template-columns: minmax(14rem, 18rem) 1fr;
  gap: 1rem;
  min-height: 26rem;
}

.pp-previa {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: stretch;
}

.pp-tela {
  width: 100%;
  aspect-ratio: 4 / 5;
  background: radial-gradient(circle at 50% 70%, var(--bg-3), var(--bg-0));
  border: 0.125rem solid var(--tinta);
  touch-action: none;
  outline: none;
}

.pp-poses, .pp-presets { display: flex; flex-wrap: wrap; gap: 0.25rem; align-items: center; }
.pp-presets .k-label { margin: 0 0.25rem 0 0; }
.pp-sortear { align-self: flex-start; }

.pp-opcoes {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  min-width: 0;
}

.pp-nome { display: flex; flex-direction: column; gap: 0.25rem; }

.pp-abas { display: flex; flex-wrap: wrap; gap: 0.25rem; }

.pp-aba {
  appearance: none;
  cursor: pointer;
  min-height: 2rem;
  padding: 0.3125rem 0.5rem;
  background: var(--bg-1);
  border: 0.125rem solid var(--tinta);
  color: var(--text-2);
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.pp-aba-on { background: var(--primary); color: var(--bg-2); }

.pp-painel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--bg-2);
  border: 0.0625rem solid var(--border);
  flex: 1;
}

.pp-painel .k-label { margin: 0.25rem 0 0; }

.pp-itens { display: grid; grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr)); gap: 0.375rem; }

.pp-item {
  appearance: none;
  cursor: pointer;
  min-height: 2.25rem;
  padding: 0.375rem;
  background: var(--bg-1);
  border: 0.125rem solid var(--border-strong);
  color: var(--text);
  font-size: 0.8125rem;
  font-weight: 600;
}

.pp-item:hover { background: var(--bg-3); }
.pp-item-on { background: var(--accent); border-color: var(--tinta); }

.pp-cores { display: flex; flex-wrap: wrap; gap: 0.375rem; align-items: center; }

.pp-cor {
  appearance: none;
  cursor: pointer;
  width: 1.75rem;
  height: 1.75rem;
  border: 0.125rem solid var(--tinta);
  box-shadow: inset 0 0 0 0.125rem var(--bg-2);
}

.pp-cor-on { outline: 0.1875rem solid var(--accent); outline-offset: 0.0625rem; }

.pp-cor-livre {
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  border: 0.125rem dashed var(--tinta);
  background: none;
  cursor: pointer;
}

.pp-erro { margin: 0; color: var(--err); font-size: 0.8125rem; }

.pp-rodape { display: flex; justify-content: flex-end; gap: 0.5rem; }

@media (max-width: 48rem) {
  .pp-root { grid-template-columns: 1fr; }
  .pp-tela { aspect-ratio: 1; max-height: 16rem; }
}
</style>
