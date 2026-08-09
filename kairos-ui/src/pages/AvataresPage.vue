<template>
  <div class="ap-root" data-captura-teclado>
      <header class="ap-topo">
        <button class="k-btn k-btn-ghost k-btn-sm" @click="router.push('/game')">
          <PixelIcon name="corner-up-left" size="0.75rem" />jogo
        </button>
        <span class="k-chip">{{ ehSudo ? 'acervo de avatares' : 'meus avatares' }}</span>

        <nav v-if="ehSudo" class="ap-filtros">
          <button
            v-for="f in FILTROS" :key="f.id"
            class="k-btn k-btn-ghost k-btn-xs" :class="{ 'k-active': filtro === f.id }"
            @click="filtro = f.id"
          >{{ f.rotulo }} <span class="ap-n">{{ contaDe(f.id) }}</span></button>
        </nav>

        <span class="ap-progresso">
          <span v-if="aviso" class="ap-aviso">{{ aviso }}</span>
        </span>
      </header>

      <main v-if="carregando" class="ap-vazio">carregando o acervo…</main>
      <main v-else-if="!visiveis.length" class="ap-vazio">Nenhum avatar neste filtro.</main>

      <main v-else class="ap-corpo">
        <section class="ap-grade">
          <button
            v-for="a in visiveis" :key="a.id"
            class="ap-cel" :class="{ 'k-active': a.id === selecionadoId }"
            :title="`${nomeDoCorpo(a.base)} · ${a.origem}`"
            @click="selecionadoId = a.id"
          >
            <AvatarVista :preset="a.base" direcao="baixo" :cores="coresDe(a)" :lado="48" rotulo="" />
            <span class="ap-selo" :class="`ap-selo-${a.origem}`">{{ a.origem }}</span>
            <span v-if="a.emUso" class="ap-uso">{{ a.emUso }}</span>
          </button>
        </section>

        <aside v-if="selecionado" class="ap-foco">
          <div class="ap-vistas">
            <AvatarVista
              v-for="d in DIRECOES" :key="d.id"
              :preset="selecionado.base"
              :direcao="d.id"
              :quadro="andando ? quadroDoCiclo : 0"
              :cores="coresDe(selecionado)"
              :lado="72"
              :rotulo="d.rotulo"
            />
          </div>

          <button class="k-btn k-btn-sm ap-testar" :class="{ 'k-active': andando }" @click="andando = !andando">
            {{ andando ? 'parar' : 'testar — andar' }}
          </button>
          <p class="k-hint-text">
            Andando é onde máscara errada aparece: a região mal classificada troca de cor
            no meio do ciclo.
          </p>

          <div v-if="podeEditar" class="ap-editar">
            <span class="k-label">corpo</span>
            <div class="ap-corpos">
              <button
                v-for="c in CORPOS" :key="c.id"
                class="k-btn k-btn-ghost k-btn-xs" :class="{ 'k-active': rascunho.base === c.id }"
                :title="c.nome" @click="rascunho.base = c.id"
              >
                <img class="pixelated ap-corpo-thumb" :src="miniatura(c.id)" :alt="c.nome" />
              </button>
            </div>

            <div v-for="g in GRUPOS_COR" :key="g.chave" class="ap-cor-linha">
              <span class="k-label">{{ g.nome }}</span>
              <div class="ap-swatches">
                <button
                  class="ap-swatch ap-swatch-orig" :class="{ 'k-active': rascunho[g.chave] === null }"
                  title="cor original do corpo" @click="rascunho[g.chave] = null"
                >orig</button>
                <button
                  v-for="cor in g.cores" :key="cor"
                  class="ap-swatch" :class="{ 'k-active': rascunho[g.chave] === cor }"
                  :style="{ background: cor }" :title="cor"
                  @click="rascunho[g.chave] = cor"
                ></button>
              </div>
            </div>

            <button
              class="k-btn k-btn-primary k-btn-sm"
              :disabled="!mudou || ocupado" @click="salvarEdicao"
            >{{ ocupado ? 'salvando…' : 'salvar alterações' }}</button>
            <p v-if="selecionado.emUso" class="k-hint-text">
              {{ selecionado.emUso }} pessoa(s) estão usando: salvar muda o avatar delas também.
            </p>
          </div>

          <dl class="ap-ficha">
            <div><dt>corpo</dt><dd>{{ nomeDoCorpo(selecionado.base) }}</dd></div>
            <div><dt>origem</dt><dd>{{ selecionado.origem }}</dd></div>
            <div><dt>autor</dt><dd>{{ selecionado.autor ?? '—' }}</dd></div>
            <div><dt>em uso</dt><dd>{{ selecionado.emUso }}</dd></div>
          </dl>

          <div class="ap-acoes">
            <button
              v-if="ehSudo && selecionado.origem === 'usuario'"
              class="k-btn k-btn-ghost k-btn-sm"
              :disabled="ocupado" @click="promoverSelecionado"
            >promover ao seletor</button>
            <button
              v-else-if="ehSudo && selecionado.origem === 'sudo'"
              class="k-btn k-btn-ghost k-btn-sm"
              :disabled="ocupado" @click="rebaixarSelecionado"
            >tirar do seletor</button>

            <button
              class="k-btn k-btn-ghost k-btn-sm ap-excluir"
              :disabled="!podeExcluir || ocupado"
              :title="motivoDoBloqueio"
              @click="excluirSelecionado"
            >{{ rotuloExcluir }}</button>
          </div>

          <p v-if="ehSudo" class="k-hint-text ap-mascara">
            A máscara é do <strong>corpo</strong>, não deste avatar: corrigir um pixel
            arruma todos os {{ contaDoCorpo(selecionado.base) }} avatares de
            {{ nomeDoCorpo(selecionado.base) }} de uma vez.
            <button class="k-btn k-btn-ghost k-btn-xs" @click="abrirMascara(selecionado.base)">
              corrigir máscara do corpo
            </button>
          </p>
        </aside>
      </main>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PixelIcon from '@/components/PixelIcon.vue'
import AvatarVista from '@/components/AvatarVista.vue'
import { AVATAR_PRESETS } from '@/game/pixi/avatar'
import { acervo, atualizar, excluir, promover, type AvatarDoAcervo } from '@/services/avatares.api'
import { avatarSpriteUrl } from '@/game/pixi/avatar'
import { me } from '@/services/auth.api'

type Filtro = 'todos' | 'base' | 'sudo' | 'usuario' | 'livres'

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: 'todos', rotulo: 'todos' },
  { id: 'base', rotulo: 'corpos' },
  { id: 'sudo', rotulo: 'do sudo' },
  { id: 'usuario', rotulo: 'de usuários' },
  { id: 'livres', rotulo: 'livres' },
]

const DIRECOES = [
  { id: 'baixo' as const, rotulo: 'frente' },
  { id: 'esquerda' as const, rotulo: 'esquerda' },
  { id: 'direita' as const, rotulo: 'direita' },
  { id: 'cima' as const, rotulo: 'costas' },
]

const CORPOS = AVATAR_PRESETS
const NOME_DO_CORPO = new Map(AVATAR_PRESETS.map((p) => [p.id, p.nome]))
const miniatura = (base: string) => avatarSpriteUrl(base, 'baixo', 0)

// mesma paleta do painel de personagem: duas listas divergiriam e a pessoa veria
// cores aqui que não consegue escolher lá
type ChaveCor = 'pele' | 'cabelo' | 'roupa'
const GRUPOS_COR: { chave: ChaveCor; nome: string; cores: string[] }[] = [
  { chave: 'pele', nome: 'pele', cores: ['#f7dcc3', '#efc9a4', '#e0ac7e', '#c68642', '#9c6134', '#6b4326'] },
  { chave: 'cabelo', nome: 'cabelo', cores: ['#1a1410', '#6b4423', '#b5651d', '#d9a441', '#a83232', '#5b3fa8', '#10695f', '#e3e3e3'] },
  { chave: 'roupa', nome: 'roupa', cores: ['#2a4d8f', '#10695f', '#a83232', '#f2a93b', '#7b5ea7', '#a03562', '#241c15', '#fff6e0'] },
]
const nomeDoCorpo = (id: string) => NOME_DO_CORPO.get(id) ?? id

const router = useRouter()
const lista = ref<AvatarDoAcervo[]>([])
const carregando = ref(true)
const ocupado = ref(false)
const aviso = ref('')
const filtro = ref<Filtro>('todos')
const selecionadoId = ref<string | null>(null)
const ehSudo = ref(false)

// rascunho da edição: nada vai ao servidor até salvar
const rascunho = ref<{ base: string; pele: string | null; cabelo: string | null; roupa: string | null }>({
  base: '', pele: null, cabelo: null, roupa: null,
})

// o ciclo de 3 quadros do jogo, no mesmo ritmo — é o que revela máscara errada
const andando = ref(false)
const quadroDoCiclo = ref<0 | 1 | 2>(0)
let relogio: ReturnType<typeof setInterval> | null = null

const visiveis = computed(() => lista.value.filter((a) => casa(a, filtro.value)))
const selecionado = computed(() => lista.value.find((a) => a.id === selecionadoId.value) ?? null)

function casa(a: AvatarDoAcervo, f: Filtro): boolean {
  if (f === 'todos') return true
  if (f === 'livres') return a.emUso === 0 && a.origem !== 'base'
  return a.origem === f
}

const contaDe = (f: Filtro) => lista.value.filter((a) => casa(a, f)).length
const contaDoCorpo = (base: string) => lista.value.filter((a) => a.base === base).length

const coresDe = (a: AvatarDoAcervo) => ({ pele: a.pele, cabelo: a.cabelo, roupa: a.roupa })

// corpo do acervo não se edita: é a raiz dos outros. O resto o servidor confere de
// novo — dono ou sudo
const podeEditar = computed(() => !!selecionado.value && selecionado.value.origem !== 'base')

const mudou = computed(() => {
  const a = selecionado.value
  if (!a) return false
  return rascunho.value.base !== a.base || rascunho.value.pele !== a.pele ||
    rascunho.value.cabelo !== a.cabelo || rascunho.value.roupa !== a.roupa
})

function carregarRascunho() {
  const a = selecionado.value
  rascunho.value = a
    ? { base: a.base, pele: a.pele, cabelo: a.cabelo, roupa: a.roupa }
    : { base: '', pele: null, cabelo: null, roupa: null }
}

watch(selecionado, carregarRascunho, { immediate: true })

async function salvarEdicao() {
  const a = selecionado.value
  if (!a || !mudou.value) return
  ocupado.value = true
  aviso.value = ''
  try {
    await atualizar(a.id, { ...rascunho.value })
    await recarregar()
  } catch {
    aviso.value = 'Não deu pra salvar a alteração agora.'
  } finally {
    ocupado.value = false
  }
}

// corpo do acervo nunca se exclui: é a raiz de todos os outros
const podeExcluir = computed(
  () => !!selecionado.value && selecionado.value.origem !== 'base' && selecionado.value.emUso === 0,
)

const motivoDoBloqueio = computed(() => {
  const a = selecionado.value
  if (!a) return ''
  if (a.origem === 'base') return 'Os 6 corpos do acervo não se excluem'
  if (a.emUso) return `${a.emUso} pessoa(s) estão usando este avatar`
  return 'Excluir'
})

const rotuloExcluir = computed(() => {
  const a = selecionado.value
  if (a && a.origem !== 'base' && a.emUso) return `em uso por ${a.emUso}`
  return 'excluir'
})

async function recarregar() {
  carregando.value = true
  try {
    lista.value = await acervo()
    if (!lista.value.some((a) => a.id === selecionadoId.value)) {
      selecionadoId.value = lista.value[0]?.id ?? null
    }
  } catch {
    aviso.value = 'Não deu pra ler o acervo agora.'
  } finally {
    carregando.value = false
  }
}

async function excluirSelecionado() {
  const a = selecionado.value
  if (!a) return
  ocupado.value = true
  aviso.value = ''
  try {
    const r = await excluir(a.id)
    // o 409 vem do ON DELETE RESTRICT do banco, não de uma contagem nossa: entre
    // contar e apagar caberia alguém vestir o avatar
    if (!r.ok) aviso.value = `${r.emUso} pessoa(s) estão usando — não dá pra excluir.`
    else await recarregar()
  } catch {
    aviso.value = 'Não deu pra excluir agora.'
  } finally {
    ocupado.value = false
  }
}

async function trocarOrigem(destino: 'sudo' | 'usuario') {
  const a = selecionado.value
  if (!a) return
  ocupado.value = true
  try {
    await promover(a.id, destino)
    await recarregar()
  } catch {
    aviso.value = 'Não deu pra mudar a origem agora.'
  } finally {
    ocupado.value = false
  }
}

const promoverSelecionado = () => trocarOrigem('sudo')
const rebaixarSelecionado = () => trocarOrigem('usuario')

const abrirMascara = (base: string) => router.push({ path: '/admin/mascaras', query: { preset: base } })

onMounted(() => {
  void me().then((p) => { ehSudo.value = !!p.isAdmin }).catch(() => { ehSudo.value = false })
  void recarregar()
  relogio = setInterval(() => {
    if (!andando.value) return
    quadroDoCiclo.value = ([0, 1, 0, 2] as const)[
      (([0, 1, 0, 2] as const).indexOf(quadroDoCiclo.value) + 1) % 4
    ]
  }, 180)
})

onUnmounted(() => {
  if (relogio) clearInterval(relogio)
})
</script>

<style scoped>
.ap-root { height: 100vh; display: flex; flex-direction: column; background: var(--bg-1); }

.ap-topo {
  display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
  padding: 0.75rem 1rem; border-bottom: var(--ui-border-style);
}
.ap-filtros { display: flex; gap: 0.375rem; flex-wrap: wrap; }
.ap-progresso { margin-left: auto; }
.ap-n { font-family: var(--f-num); font-size: 0.8125rem; font-variant-numeric: tabular-nums; }
.ap-aviso { font-family: var(--f-sans); font-size: 0.75rem; color: var(--warn); }

.ap-vazio { padding: 2rem; font-size: 0.8125rem; color: var(--text-3); }

.ap-corpo {
  flex: 1; min-height: 0; display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(16rem, 22rem);
}
@media (max-width: 52rem) { .ap-corpo { grid-template-columns: 1fr; } }

.ap-grade {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(4.5rem, 1fr));
  gap: 0.5rem; padding: 1rem; overflow-y: auto; align-content: start;
}

.ap-cel {
  position: relative; padding: 0.25rem; cursor: pointer;
  background: var(--bg-2); border: var(--ui-border-style);
}
.ap-cel.k-active { box-shadow: inset 0 0 0 0.125rem var(--accent); }

.ap-selo {
  position: absolute; left: 0; bottom: 0;
  font-family: var(--f-sans); font-size: 0.5625rem; font-weight: 700;
  letter-spacing: 0.06em; text-transform: uppercase;
  padding: 0 0.1875rem; color: var(--cream); background: var(--tinta);
}
.ap-selo-base { background: var(--ok); }
.ap-selo-sudo { background: var(--accent); color: var(--tinta); }

.ap-uso {
  position: absolute; right: 0; top: 0;
  font-family: var(--f-num); font-size: 0.625rem;
  padding: 0 0.1875rem; color: var(--cream); background: var(--warn);
}

.ap-foco {
  border-left: var(--ui-border-style); padding: 1rem;
  display: flex; flex-direction: column; gap: 0.75rem; overflow-y: auto;
}
.ap-vistas { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.375rem; }
.ap-testar { align-self: flex-start; }

.ap-ficha { display: grid; gap: 0.25rem; margin: 0; }
.ap-ficha > div { display: flex; justify-content: space-between; gap: 0.5rem; }
.ap-ficha dt {
  font-family: var(--f-sans); font-size: 0.6875rem; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--text-3);
}
.ap-ficha dd { margin: 0; font-size: 0.8125rem; }

.ap-editar {
  display: flex; flex-direction: column; gap: 0.5rem;
  border-top: var(--ui-border-style); padding-top: 0.75rem;
}
.ap-corpos { display: flex; flex-wrap: wrap; gap: 0.25rem; }
.ap-corpo-thumb { width: 1.5rem; height: 1.5rem; display: block; }
.ap-cor-linha { display: flex; flex-direction: column; gap: 0.25rem; }
.ap-swatches { display: flex; flex-wrap: wrap; gap: 0.25rem; }

/* 1.75rem = 28px; abaixo disso o alvo fica difícil no toque */
.ap-swatch {
  width: 1.75rem; height: 1.75rem; padding: 0; cursor: pointer;
  border: 0.125rem solid var(--tinta); background: var(--bg-2);
}
.ap-swatch.k-active { box-shadow: 0 0 0 0.125rem var(--accent); }
.ap-swatch-orig {
  width: auto; padding: 0 0.375rem;
  font-family: var(--f-sans); font-size: 0.625rem; font-weight: 700;
  letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-2);
}

.ap-acoes { display: flex; flex-wrap: wrap; gap: 0.375rem; }
.ap-excluir:not(:disabled) { color: var(--err); }
.ap-mascara { border-top: var(--ui-border-style); padding-top: 0.75rem; }
</style>
