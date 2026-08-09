<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PixelIcon from '@/components/PixelIcon.vue'
import PreviaMascara from '@/components/PreviaMascara.vue'
import TelaMascara from '@/components/TelaMascara.vue'
import { AVATAR_PRESETS } from '@/game/pixi/avatar'
import type { CoresAlvo } from '@/game/recolorir'
import { listarMascaras, salvarMascara } from '@/services/mascaras.api'
import { confiancaDe, lerTodasAsBases, urlDoSprite } from '@/services/mascaras.assets'
import {
  CODIGO,
  COR_REGIAO,
  DIRECOES,
  LIMITE_VIZINHANCA,
  MASCARA_VAZIA,
  PIXELS,
  QUADROS,
  REGIOES,
  VAZIO,
  ausenciasPendentes,
  balde,
  chaveDe,
  direcaoDe,
  ordenarFila,
  passoDe,
  percentualVizinhanca,
  pintar,
  propagarRegiao,
  quadrosDoCiclo,
  type ItemFila,
  type Regiao,
} from '@/services/mascaras.pixels'

const router = useRouter()

const PRESETS = AVATAR_PRESETS
const TOTAL = PRESETS.length * QUADROS.length
const CHAVE_RETOMADA = 'kairos_mascaras_atual'

const TECLA_REGIAO: Record<string, Regiao> = { '1': 'pele', '2': 'cabelo', '3': 'roupa', '4': 'contorno' }

const PALETA: { chave: keyof CoresAlvo; nome: string; cores: string[] }[] = [
  { chave: 'pele', nome: 'pele', cores: ['#f7dcc3', '#e0ac7e', '#9c6134', '#6b4326'] },
  { chave: 'cabelo', nome: 'cabelo', cores: ['#1a1410', '#b5651d', '#a83232', '#5b3fa8', '#e3e3e3'] },
  { chave: 'roupa', nome: 'roupa', cores: ['#2a4d8f', '#10695f', '#f2a93b', '#a03562'] },
]

const preset = ref(PRESETS[0]?.id ?? 'ruivo-verde')
const quadro = ref(QUADROS[0])

const carregando = ref(true)
const erro = ref('')
const salvoEm = ref('')
const salvando = ref(false)

const bases = ref(new Map<string, string>())
const pixels = ref(new Map<string, string>())
const intencionais = ref(new Map<string, Regiao[]>())
const revisados = ref(new Set<string>())
const duvidas = ref(new Set<string>())
const desfazer = new Map<string, string[]>()

const regiao = ref<Regiao | null>('pele')
const ferramenta = ref<'pincel' | 'balde'>('pincel')
const overlay = ref(true)
const contornoDestravado = ref(false)
const cores = ref<CoresAlvo>({ pele: null, cabelo: null, roupa: null })

const chaveAtual = computed(() => chaveDe(preset.value, quadro.value))
const pixelsAtuais = computed(() => pixels.value.get(chaveAtual.value) ?? MASCARA_VAZIA)
const baseAtual = computed(() => bases.value.get(chaveAtual.value) ?? MASCARA_VAZIA)
const confiancaAtual = computed(() => confiancaDe(preset.value, quadro.value))
const spriteAtual = computed(() => urlDoSprite(preset.value, quadro.value))
const intencionalAtual = computed(() => intencionais.value.get(chaveAtual.value) ?? [])
const ausentesAtuais = computed(() => ausenciasPendentes(pixelsAtuais.value, intencionalAtual.value))
const vizinhancaAtual = computed(() => percentualVizinhanca(confiancaAtual.value))
const podeDesfazer = computed(() => !!desfazer.get(chaveAtual.value)?.length)

function itemDe(idPreset: string, nomeQuadro: string): ItemFila {
  const chave = chaveDe(idPreset, nomeQuadro)
  const px = pixels.value.get(chave) ?? MASCARA_VAZIA
  return {
    chave,
    preset: idPreset,
    quadro: nomeQuadro,
    ausentes: ausenciasPendentes(px, intencionais.value.get(chave) ?? []),
    vizinhanca: percentualVizinhanca(confiancaDe(idPreset, nomeQuadro)),
    revisado: revisados.value.has(chave),
    duvida: duvidas.value.has(chave),
  }
}

// pior confiança primeiro — é a fila que o ←/→ percorre
const filaGlobal = computed(() =>
  ordenarFila(PRESETS.flatMap((p) => QUADROS.map((q) => itemDe(p.id, q)))),
)
const filaDoPreset = computed(() => filaGlobal.value.filter((i) => i.preset === preset.value))
const posicao = computed(() => filaDoPreset.value.findIndex((i) => i.quadro === quadro.value))

const totalRevisado = computed(() => revisados.value.size)
const pctRevisado = computed(() => `${Math.round((totalRevisado.value / TOTAL) * 100)}%`)
const filaDeDuvidas = computed(() => filaGlobal.value.filter((i) => i.duvida))

function pendencias(idPreset: string) {
  const itens = filaGlobal.value.filter((i) => i.preset === idPreset)
  let marcadas = 0
  for (const i of itens) marcadas += (intencionais.value.get(i.chave) ?? []).length
  return {
    ausencias: itens.filter((i) => i.ausentes.length).length,
    vizinhanca: itens.filter((i) => i.vizinhanca > LIMITE_VIZINHANCA).length,
    intencionais: marcadas,
    revisados: itens.filter((i) => i.revisado).length,
  }
}

const pendenciasDoPreset = computed(() => pendencias(preset.value))

// aba com "!" enquanto houver ausência não decidida — some quando tudo está
// pintado ou marcado como intencional
function temAlerta(idPreset: string): boolean {
  return pendencias(idPreset).ausencias > 0
}

const VISTAS = computed(() => {
  const passo = passoDe(quadro.value)
  const lado = direcaoDe(quadro.value) === 'esquerda' ? 'esquerda' : 'direita'
  return [
    { rotulo: 'frente', quadro: `baixo-${passo}` },
    { rotulo: 'lado', quadro: `${lado}-${passo}` },
    { rotulo: 'costas', quadro: `cima-${passo}` },
  ]
})

const miniaturas = computed(() => quadrosDoCiclo(quadro.value))

function pixelsDe(nomeQuadro: string): string {
  return pixels.value.get(chaveDe(preset.value, nomeQuadro)) ?? MASCARA_VAZIA
}

function agora(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function definirPixels(chave: string, novos: string) {
  const m = new Map(pixels.value)
  m.set(chave, novos)
  pixels.value = m
}

function registrarDesfazer(chave: string, antes: string) {
  const pilha = desfazer.get(chave) ?? []
  pilha.push(antes)
  if (pilha.length > 80) pilha.shift()
  desfazer.set(chave, pilha)
}

async function gravar(chave: string) {
  const corte = chave.indexOf('/')
  const idPreset = chave.slice(0, corte)
  const nomeQuadro = chave.slice(corte + 1)
  salvando.value = true
  erro.value = ''
  try {
    await salvarMascara(idPreset, nomeQuadro, {
      pixels: pixels.value.get(chave) ?? MASCARA_VAZIA,
      intencional: [...(intencionais.value.get(chave) ?? [])],
      duvida: duvidas.value.has(chave),
      revisado: revisados.value.has(chave),
    })
    salvoEm.value = agora()
  } catch (e) {
    erro.value = 'não deu pra salvar — a correção não foi gravada'
    console.error(e)
  } finally {
    salvando.value = false
  }
}

let tracoAberto = false

function aoPintar(indice: number, continuacao: boolean) {
  if (ferramenta.value === 'balde' && continuacao) return
  const chave = chaveAtual.value
  const atual = pixelsAtuais.value
  const codigo = regiao.value ? CODIGO[regiao.value] : VAZIO
  const novos =
    ferramenta.value === 'balde'
      ? balde(atual, indice, codigo, contornoDestravado.value)
      : pintar(atual, indice, codigo, contornoDestravado.value)
  if (novos === atual) return
  if (!tracoAberto) registrarDesfazer(chave, atual)
  definirPixels(chave, novos)
  if (ferramenta.value === 'balde') {
    void gravar(chave)
    return
  }
  tracoAberto = true
}

// a pincelada inteira é uma decisão só: um PUT por traço, não por pixel
function aoFimTraco() {
  if (!tracoAberto) return
  tracoAberto = false
  void gravar(chaveAtual.value)
}

function desfazerUltimo() {
  const chave = chaveAtual.value
  const pilha = desfazer.get(chave)
  if (!pilha?.length) return
  definirPixels(chave, pilha.pop() as string)
  void gravar(chave)
}

function alvoIntencional(): Regiao | null {
  const escolhida = regiao.value
  if (
    escolhida &&
    escolhida !== 'contorno' &&
    (ausentesAtuais.value.includes(escolhida) || intencionalAtual.value.includes(escolhida))
  ) {
    return escolhida
  }
  return ausentesAtuais.value[0] ?? intencionalAtual.value[0] ?? null
}

function marcarIntencional(alvo?: Regiao) {
  const alvoFinal = alvo ?? alvoIntencional()
  if (!alvoFinal || alvoFinal === 'contorno') return
  const chave = chaveAtual.value
  const lista = [...(intencionais.value.get(chave) ?? [])]
  const i = lista.indexOf(alvoFinal)
  if (i >= 0) lista.splice(i, 1)
  else lista.push(alvoFinal)
  const m = new Map(intencionais.value)
  m.set(chave, lista)
  intencionais.value = m
  void gravar(chave)
}

function pintarAgora(alvo: Regiao) {
  regiao.value = alvo
  ferramenta.value = 'pincel'
}

// P só anda dentro do ciclo de caminhada — nunca entre vistas, porque costas
// não tem rosto
function propagar() {
  const alvo = regiao.value
  if (!alvo) return
  const origem = pixelsAtuais.value
  for (const irmao of quadrosDoCiclo(quadro.value)) {
    if (irmao === quadro.value) continue
    const chave = chaveDe(preset.value, irmao)
    const antes = pixels.value.get(chave) ?? MASCARA_VAZIA
    const base = bases.value.get(chave) ?? MASCARA_VAZIA
    const novos = propagarRegiao(origem, antes, base, CODIGO[alvo], contornoDestravado.value)
    if (novos === antes) continue
    registrarDesfazer(chave, antes)
    definirPixels(chave, novos)
    void gravar(chave)
  }
}

function alternarDuvida() {
  const chave = chaveAtual.value
  const s = new Set(duvidas.value)
  if (s.has(chave)) s.delete(chave)
  else s.add(chave)
  duvidas.value = s
  void gravar(chave)
}

function irPara(idPreset: string, nomeQuadro: string) {
  preset.value = idPreset
  quadro.value = nomeQuadro
  tracoAberto = false
  try {
    localStorage.setItem(CHAVE_RETOMADA, chaveDe(idPreset, nomeQuadro))
  } catch {
    /* modo privado sem storage: a retomada cai no primeiro não revisado */
  }
}

function avancar() {
  const proximo = filaDoPreset.value.find((i) => !i.revisado && i.quadro !== quadro.value)
  if (proximo) return irPara(preset.value, proximo.quadro)
  const outro = filaGlobal.value.find((i) => !i.revisado)
  if (outro) irPara(outro.preset, outro.quadro)
}

async function confirmar() {
  const chave = chaveAtual.value
  const s = new Set(revisados.value)
  s.add(chave)
  revisados.value = s
  const d = new Set(duvidas.value)
  d.delete(chave)
  duvidas.value = d
  await gravar(chave)
  avancar()
}

function passoNaFila(delta: number) {
  const lista = filaDoPreset.value
  if (!lista.length) return
  const destino = Math.min(lista.length - 1, Math.max(0, posicao.value + delta))
  const alvo = lista[destino]
  if (alvo) irPara(preset.value, alvo.quadro)
}

function trocarVista(delta: number) {
  const atual = DIRECOES.indexOf(direcaoDe(quadro.value))
  const proxima = DIRECOES[(atual + delta + DIRECOES.length) % DIRECOES.length]
  irPara(preset.value, `${proxima}-${passoDe(quadro.value)}`)
}

function trocarPreset(idPreset: string) {
  const lista = filaGlobal.value.filter((i) => i.preset === idPreset)
  const alvo = lista.find((i) => !i.revisado) ?? lista[0]
  if (alvo) irPara(idPreset, alvo.quadro)
}

function definirCor(chave: keyof CoresAlvo, cor: string) {
  cores.value = { ...cores.value, [chave]: cores.value[chave] === cor ? null : cor }
}

function ehRegiao(v: string): v is Regiao {
  return (REGIOES as string[]).includes(v)
}

function retomar() {
  let salvo: string | null = null
  try {
    salvo = localStorage.getItem(CHAVE_RETOMADA)
  } catch {
    salvo = null
  }
  if (salvo) {
    const corte = salvo.indexOf('/')
    const idPreset = salvo.slice(0, corte)
    const nomeQuadro = salvo.slice(corte + 1)
    if (PRESETS.some((p) => p.id === idPreset) && QUADROS.includes(nomeQuadro)) {
      preset.value = idPreset
      quadro.value = nomeQuadro
      return
    }
  }
  const pendente = filaGlobal.value.find((i) => !i.revisado) ?? filaGlobal.value[0]
  if (pendente) {
    preset.value = pendente.preset
    quadro.value = pendente.quadro
  }
}

async function carregar() {
  carregando.value = true
  erro.value = ''
  // as máscaras do bootstrap vêm dos arquivos e não dependem da API: se a
  // listagem falhar (sessão sem sudo, servidor fora), a tela ainda mostra o
  // estado real dos 72 quadros em vez de 72 máscaras vazias
  const base = await lerTodasAsBases(PRESETS.map((p) => p.id))
  bases.value = base
  pixels.value = new Map(base)
  try {
    const lista = await listarMascaras()
    const px = new Map(base)
    const inten = new Map<string, Regiao[]>()
    const rev = new Set<string>()
    const dv = new Set<string>()
    for (const r of lista) {
      const chave = chaveDe(r.preset, r.quadro)
      if (r.pixels && r.pixels.length === PIXELS) px.set(chave, r.pixels)
      if (r.intencional?.length) inten.set(chave, r.intencional.filter(ehRegiao))
      if (r.revisado) rev.add(chave)
      if (r.duvida) dv.add(chave)
    }
    pixels.value = px
    intencionais.value = inten
    revisados.value = rev
    duvidas.value = dv
  } catch (e) {
    erro.value = 'não deu pra ler as correções já feitas'
    console.error(e)
  } finally {
    retomar()
    carregando.value = false
  }
}

// a ferramenta vive fora do canvas do jogo: o teclado inteiro é dela, sem WASD
function aoTeclado(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  const k = e.key.toLowerCase()
  const daTecla = TECLA_REGIAO[k]
  if (daTecla) {
    e.preventDefault()
    regiao.value = daTecla
    return
  }
  if (k === '0') {
    e.preventDefault()
    regiao.value = null
    return
  }
  if (k === 'b') {
    e.preventDefault()
    ferramenta.value = 'pincel'
    return
  }
  if (k === 'f') {
    e.preventDefault()
    ferramenta.value = 'balde'
    return
  }
  if (k === 't') {
    e.preventDefault()
    overlay.value = !overlay.value
    return
  }
  if (k === 'x') {
    e.preventDefault()
    marcarIntencional()
    return
  }
  if (k === 'p') {
    e.preventDefault()
    propagar()
    return
  }
  if (k === 'd') {
    e.preventDefault()
    alternarDuvida()
    return
  }
  if (k === 'z') {
    e.preventDefault()
    desfazerUltimo()
    return
  }
  if (k === 'enter') {
    e.preventDefault()
    void confirmar()
    return
  }
  if (k === 'arrowleft') {
    e.preventDefault()
    passoNaFila(-1)
    return
  }
  if (k === 'arrowright') {
    e.preventDefault()
    passoNaFila(1)
    return
  }
  if (k === 'arrowup') {
    e.preventDefault()
    trocarVista(-1)
    return
  }
  if (k === 'arrowdown') {
    e.preventDefault()
    trocarVista(1)
  }
}

onMounted(() => {
  window.addEventListener('keydown', aoTeclado)
  void carregar()
})
onUnmounted(() => window.removeEventListener('keydown', aoTeclado))
</script>

<template>
  <div class="mp-root" data-captura-teclado>
    <header class="mp-topo">
      <button class="k-btn k-btn-ghost k-btn-sm" @click="router.push('/game')">
        <PixelIcon name="corner-up-left" size="0.75rem" />jogo
      </button>
      <span class="k-chip">máscaras do avatar</span>

      <nav class="mp-abas">
        <button
          v-for="p in PRESETS" :key="p.id"
          class="k-btn k-btn-ghost k-btn-xs mp-aba" :class="{ 'k-active': preset === p.id }"
          :title="p.nome"
          @click="trocarPreset(p.id)"
        >
          {{ p.id }}
          <span class="mp-n">{{ pendencias(p.id).revisados }}/{{ QUADROS.length }}</span>
          <span v-if="temAlerta(p.id)" class="mp-alerta" aria-label="tem região ausente sem decisão">!</span>
        </button>
      </nav>

      <div class="mp-progresso">
        <span class="mp-barra"><i :style="{ width: pctRevisado }"></i></span>
        <span class="mp-n">{{ totalRevisado }}/{{ TOTAL }}</span>
        <span class="mp-salvo">salvo {{ salvoEm || '--:--' }}</span>
      </div>
    </header>

    <p v-if="erro" class="mp-erro">{{ erro }}</p>

    <main v-if="carregando" class="mp-vazio">lendo as 72 máscaras e as correções já feitas…</main>

    <main v-else class="mp-foco">
      <section class="mp-palco">
        <span class="k-label">{{ preset }} · {{ quadro }} — {{ posicao + 1 }}º da fila</span>

        <TelaMascara
          :pixels="pixelsAtuais"
          :base="baseAtual"
          :confianca="confiancaAtual"
          :sprite="spriteAtual"
          :overlay="overlay"
          @pintar="aoPintar"
          @fim-traco="aoFimTraco"
        />

        <div class="mp-ciclo">
          <button
            v-for="q in miniaturas" :key="q"
            class="mp-mini" :class="{ 'mp-mini-atual': q === quadro }"
            :title="`quadro ${q} do ciclo`"
            @click="irPara(preset, q)"
          >
            <img class="mp-mini-img" :src="urlDoSprite(preset, q)" :alt="q" />
          </button>
          <span class="mp-ciclo-nota">ciclo de {{ direcaoDe(quadro) }}</span>
        </div>

        <div class="mp-ferramentas">
          <span class="k-label">região</span>
          <div class="mp-linha">
            <button
              v-for="(r, i) in REGIOES" :key="r"
              class="k-btn k-btn-ghost k-btn-xs mp-regiao"
              :class="{ 'k-active': regiao === r }"
              @click="regiao = r"
            >
              <span class="mp-tecla">{{ i + 1 }}</span>
              <span class="mp-amostra" :style="{ background: COR_REGIAO[r] }"></span>
              {{ r }}<template v-if="r === 'contorno'"> 🔒</template>
            </button>
            <button
              class="k-btn k-btn-ghost k-btn-xs mp-regiao" :class="{ 'k-active': regiao === null }"
              @click="regiao = null"
            ><span class="mp-tecla">0</span>nenhuma</button>
          </div>

          <p v-if="regiao === 'contorno'" class="mp-nota">
            Contorno é travado: ele existe para o overlay dizer «isto nunca recolore».
            <button
              class="k-btn k-btn-ghost k-btn-xs" :class="{ 'k-active': contornoDestravado }"
              @click="contornoDestravado = !contornoDestravado"
            >{{ contornoDestravado ? 'destravado' : 'destravar' }}</button>
          </p>

          <span class="k-label">ferramenta</span>
          <div class="mp-linha">
            <button
              class="k-btn k-btn-ghost k-btn-xs mp-regiao" :class="{ 'k-active': ferramenta === 'pincel' }"
              @click="ferramenta = 'pincel'"
            ><span class="mp-tecla">B</span>pincel</button>
            <button
              class="k-btn k-btn-ghost k-btn-xs mp-regiao" :class="{ 'k-active': ferramenta === 'balde' }"
              @click="ferramenta = 'balde'"
            ><span class="mp-tecla">F</span>balde</button>
            <button
              class="k-btn k-btn-ghost k-btn-xs mp-regiao" :class="{ 'k-active': overlay }"
              @click="overlay = !overlay"
            ><span class="mp-tecla">T</span>confiança</button>
            <button
              class="k-btn k-btn-ghost k-btn-xs mp-regiao" :disabled="!podeDesfazer"
              @click="desfazerUltimo"
            ><span class="mp-tecla">Z</span>desfazer</button>
          </div>

          <div class="mp-legenda">
            <span class="mp-legenda-item"><i class="mp-chave mp-chave-solido"></i>decidido pela cor</span>
            <span class="mp-legenda-item"><i class="mp-chave mp-chave-hachura"></i>vizinhança — palpite</span>
            <span class="mp-legenda-item"><i class="mp-chave mp-chave-mao"></i>corrigido à mão</span>
          </div>
        </div>
      </section>

      <section class="mp-trabalho">
        <div v-if="ausentesAtuais.length" class="mp-decisao">
          <div class="mp-decisao-faixa"></div>
          <p class="mp-decisao-texto">
            Este quadro não tem nenhum pixel de
            <strong>{{ ausentesAtuais.join(', ') }}</strong>. O swatch dessa cor não muda nada aqui:
            ou é defeito do bootstrap e falta pintar, ou é legítimo — costas não mostram rosto.
          </p>
          <div v-for="r in ausentesAtuais" :key="r" class="mp-decisao-linha">
            <span class="mp-decisao-nome">{{ r }}</span>
            <button class="k-btn k-btn-primary k-btn-sm" @click="pintarAgora(r)">pintar agora</button>
            <button class="k-btn k-btn-ghost k-btn-sm" @click="marcarIntencional(r)">
              <span class="mp-tecla">X</span>intencional
            </button>
          </div>
        </div>

        <div v-if="intencionalAtual.length" class="mp-marcadas">
          <span class="k-label">ausência intencional neste quadro</span>
          <div class="mp-linha">
            <button
              v-for="r in intencionalAtual" :key="r"
              class="k-btn k-btn-ghost k-btn-xs" @click="marcarIntencional(r)"
            >{{ r }} · desmarcar</button>
          </div>
        </div>

        <div class="mp-previa">
          <span class="k-label">como fica no mapa</span>
          <div class="mp-vistas">
            <PreviaMascara
              v-for="v in VISTAS" :key="v.quadro"
              :class="{ 'mp-vista-atual': v.quadro === quadro }"
              :preset="preset"
              :quadro="v.quadro"
              :pixels="pixelsDe(v.quadro)"
              :cores="cores"
              :rotulo="v.rotulo"
            />
          </div>
          <div v-for="grupo in PALETA" :key="grupo.chave" class="mp-cor-linha">
            <span class="mp-cor-nome">{{ grupo.nome }}</span>
            <button
              v-for="cor in grupo.cores" :key="cor"
              class="mp-swatch" :class="{ 'mp-swatch-on': cores[grupo.chave] === cor }"
              :style="{ background: cor }"
              :aria-label="`${grupo.nome}: ${cor}`"
              :title="`${grupo.nome}: ${cor}`"
              @click="definirCor(grupo.chave, cor)"
            ></button>
          </div>
          <p class="mp-nota">
            Escolha uma cor e veja se muda alguma coisa. Swatch que não muda nada é máscara furada.
          </p>
        </div>

        <div class="mp-acoes">
          <button class="k-btn k-btn-ghost k-btn-sm" :disabled="posicao <= 0" @click="passoNaFila(-1)">
            ← anterior
          </button>
          <button
            class="k-btn k-btn-ghost k-btn-sm" :class="{ 'k-active': duvidas.has(chaveAtual) }"
            @click="alternarDuvida"
          ><span class="mp-tecla">D</span>dúvida</button>
          <button class="k-btn k-btn-ghost k-btn-sm" :disabled="!regiao" @click="propagar">
            <span class="mp-tecla">P</span>propagar no ciclo
          </button>
          <button class="k-btn k-btn-primary k-btn-sm mp-confirmar" :disabled="salvando" @click="confirmar">
            {{ salvando ? 'salvando…' : 'confirmar e avançar · enter' }}
          </button>
        </div>

        <p class="mp-nota">
          ←/→ anda na fila deste preset · ↑/↓ troca a vista mantendo o passo ·
          {{ Math.round(vizinhancaAtual) }}% deste quadro veio de vizinhança.
        </p>
      </section>

      <aside class="mp-pendencias">
        <span class="k-label">pendências de {{ preset }}</span>
        <ul class="mp-contas">
          <li><span class="mp-n">{{ pendenciasDoPreset.ausencias }}</span> quadros com região ausente sem decisão</li>
          <li><span class="mp-n">{{ pendenciasDoPreset.vizinhanca }}</span> quadros acima de {{ LIMITE_VIZINHANCA }}% de vizinhança</li>
          <li><span class="mp-n">{{ pendenciasDoPreset.intencionais }}</span> ausências marcadas como intencionais</li>
        </ul>

        <span class="k-label">fila deste preset</span>
        <ol class="mp-fila">
          <li v-for="item in filaDoPreset" :key="item.chave">
            <button
              class="mp-fila-item" :class="{ 'mp-fila-on': item.quadro === quadro }"
              @click="irPara(item.preset, item.quadro)"
            >
              <span class="mp-fila-nome">{{ item.quadro }}</span>
              <span v-if="item.ausentes.length" class="mp-alerta">!</span>
              <span v-if="item.duvida" class="mp-marca">?</span>
              <span v-if="item.revisado" class="mp-marca mp-marca-ok">ok</span>
              <span class="mp-n">{{ Math.round(item.vizinhanca) }}%</span>
            </button>
          </li>
        </ol>

        <template v-if="filaDeDuvidas.length">
          <span class="k-label">dúvidas ({{ filaDeDuvidas.length }})</span>
          <div class="mp-linha">
            <button
              v-for="item in filaDeDuvidas" :key="item.chave"
              class="k-btn k-btn-ghost k-btn-xs" @click="irPara(item.preset, item.quadro)"
            >{{ item.chave }}</button>
          </div>
        </template>
      </aside>
    </main>
  </div>
</template>

<style scoped>
.mp-root {
  min-height: 100vh;
  background: var(--bg-0);
  display: flex;
  flex-direction: column;
}

.mp-topo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding: 0.75rem 1rem;
  background: var(--bg-1);
  border-bottom: var(--ui-border-style);
}

.mp-abas { display: flex; gap: 0.375rem; flex-wrap: wrap; }
.mp-aba { gap: 0.375rem; }

.mp-progresso { margin-left: auto; display: flex; align-items: center; gap: 0.5rem; }
.mp-barra {
  display: block;
  width: 8rem;
  height: 0.75rem;
  background: var(--bg-0);
  border: 0.125rem solid var(--tinta);
}
.mp-barra i { display: block; height: 100%; background: var(--primary); }

.mp-n {
  font-family: var(--f-num);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-2);
}

.mp-salvo {
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--tinta);
  background: var(--accent);
  border: 0.125rem solid var(--tinta);
  padding: 0.25rem 0.375rem;
}

.mp-alerta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1rem;
  height: 1rem;
  background: var(--err);
  color: var(--bg-2);
  border: 0.125rem solid var(--tinta);
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.mp-erro { margin: 0; padding: 0.5rem 1rem; font-size: 0.8125rem; color: var(--err); }
.mp-vazio { padding: 2rem; font-size: 0.8125rem; color: var(--text-3); }

.mp-foco {
  display: grid;
  grid-template-columns: minmax(15rem, 19rem) minmax(0, 34rem) minmax(13rem, 17rem);
  gap: 1.25rem;
  padding: 1.25rem;
  align-items: start;
  justify-content: center;
}

.mp-palco,
.mp-trabalho,
.mp-pendencias {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--bg-1);
  border: var(--ui-border-style);
  box-shadow: var(--contorno-duplo), var(--sombra-solida);
}

.mp-ciclo { display: flex; align-items: center; gap: 0.375rem; flex-wrap: wrap; }
.mp-mini {
  width: 2rem;
  height: 2rem;
  padding: 0;
  display: grid;
  place-items: center;
  background: var(--bg-2);
  border: 0.125rem solid var(--tinta);
  cursor: pointer;
}
.mp-mini-atual { box-shadow: 0 0 0 0.1875rem var(--accent); }
.mp-mini-img { width: 1.5rem; height: 1.5rem; image-rendering: pixelated; }
.mp-ciclo-nota { font-family: var(--f-sans); font-size: 0.75rem; color: var(--text-3); }

.mp-ferramentas { display: flex; flex-direction: column; gap: 0.375rem; }
.mp-linha { display: flex; gap: 0.25rem; flex-wrap: wrap; align-items: center; }
.mp-regiao { gap: 0.3125rem; }

.mp-tecla {
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0 0.25rem;
  border: 0.0625rem solid var(--border-strong);
}

.mp-amostra {
  width: 0.75rem;
  height: 0.75rem;
  border: 0.0625rem solid var(--tinta);
  display: inline-block;
}

.mp-legenda { display: flex; flex-direction: column; gap: 0.25rem; margin-top: 0.25rem; }
.mp-legenda-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-family: var(--f-sans);
  font-size: 0.75rem;
  color: var(--text-3);
}
.mp-chave {
  width: 1rem;
  height: 1rem;
  border: 0.0625rem solid var(--tinta);
  display: inline-block;
  flex: none;
}
.mp-chave-solido { background: rgba(42, 77, 143, 0.6); }
.mp-chave-hachura {
  background-image: repeating-linear-gradient(
    45deg,
    #2a4d8f 0 0.125rem,
    transparent 0.125rem 0.25rem
  );
}
.mp-chave-mao { background: rgba(42, 77, 143, 0.78); border-color: var(--accent); }

.mp-decisao {
  border: 0.125rem solid var(--err);
  background: rgba(168, 50, 50, 0.08);
  box-shadow: inset 0 0 0 0.125rem rgba(244, 228, 193, 0.7);
  padding: 0.625rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.mp-decisao-faixa {
  height: 0.5rem;
  margin: -0.625rem -0.625rem 0;
  background: repeating-linear-gradient(45deg, var(--err) 0 0.375rem, #e8c9b0 0.375rem 0.75rem);
}
.mp-decisao-texto { margin: 0; font-size: 0.8125rem; line-height: 1.5; color: var(--text-2); }
.mp-decisao-linha { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.mp-decisao-nome {
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--err-hi);
  min-width: 4rem;
}

.mp-marcadas { display: flex; flex-direction: column; gap: 0.25rem; }

.mp-previa { display: flex; flex-direction: column; gap: 0.5rem; }
.mp-vistas { display: grid; grid-template-columns: repeat(3, minmax(0, 7rem)); gap: 0.5rem; }
.mp-vista-atual { outline: 0.1875rem solid var(--accent); outline-offset: 0.125rem; }

.mp-cor-linha { display: flex; align-items: center; gap: 0.25rem; flex-wrap: wrap; }
.mp-cor-nome {
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-3);
  min-width: 4rem;
}
.mp-swatch {
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 0.125rem solid var(--tinta);
  cursor: pointer;
}
.mp-swatch-on { box-shadow: 0 0 0 0.1875rem var(--accent); }

.mp-acoes { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
.mp-confirmar { margin-left: auto; }

.mp-nota { margin: 0; font-size: 0.75rem; line-height: 1.5; color: var(--text-3); }

.mp-contas { margin: 0; padding-left: 1rem; display: flex; flex-direction: column; gap: 0.25rem; }
.mp-contas li { font-size: 0.75rem; line-height: 1.4; color: var(--text-2); }

.mp-fila { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0.125rem; }
.mp-fila-item {
  width: 100%;
  min-height: 2rem;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.375rem;
  background: var(--bg-2);
  border: 0.125rem solid var(--border);
  cursor: pointer;
  text-align: left;
}
.mp-fila-item:hover { border-color: var(--tinta); }
.mp-fila-on { border-color: var(--tinta); box-shadow: inset 0 0 0 0.125rem var(--accent); }
.mp-fila-nome { flex: 1; font-family: var(--f-sans); font-size: 0.75rem; color: var(--text); }
.mp-marca {
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.125rem 0.25rem;
  border: 0.0625rem solid var(--tinta);
  background: var(--bg-0);
  color: var(--text-2);
}
.mp-marca-ok { background: var(--ok); color: var(--bg-2); }

@media (max-width: 76rem) {
  .mp-foco { grid-template-columns: minmax(0, 19rem) minmax(0, 34rem); }
  .mp-pendencias { grid-column: 1 / -1; }
}

@media (max-width: 56rem) {
  .mp-foco { grid-template-columns: minmax(0, 1fr); }
  .mp-pendencias { grid-column: auto; }
}
</style>
