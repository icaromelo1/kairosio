<template>
  <PanelShell title="personagem" icon="user" size="lg" :bloqueado="obrigatorio" @close="emit('close')">
    <div class="cp-grid">
      <div class="cp-stage">
        <span class="cp-eyebrow">seu avatar · ao vivo</span>
        <div class="cp-preview">
          <AvatarVista
            v-for="vista in VISTAS" :key="vista.id"
            :preset="characterStore.hairStyle"
            :direcao="vista.direcao"
            :rotulo="vista.rotulo"
            :cores="coresAlvo"
          />
        </div>
        <div class="cp-handle">
          <span class="cp-eyebrow">seu @nome</span>
          <p class="cp-handle-hint">
            É como você aparece no mundo, sobre o avatar e na lista de amigos.
          </p>

          <div class="cp-handle-row">
            <span class="cp-at">@</span>
            <input
              v-model.trim="handle"
              class="k-input cp-handle-input"
              type="text"
              maxlength="20"
              autocapitalize="off"
              autocomplete="off"
              spellcheck="false"
              placeholder="seu.nome"
              @keyup.enter="salvarHandle"
            />
            <button
              class="k-btn k-btn-sm"
              :disabled="!podeSalvarHandle"
              @click="salvarHandle"
            >{{ salvandoHandle ? 'Salvando…' : (handleAtual ? 'Trocar' : 'Definir') }}</button>
          </div>

          <p v-if="dicaHandle" class="cp-handle-hint">{{ dicaHandle }}</p>
          <p v-if="handleErro" class="cp-error">{{ handleErro }}</p>
          <p v-else-if="handleOk" class="cp-handle-ok">{{ handleOk }}</p>
          <p v-else-if="handleAviso" class="cp-handle-aviso">{{ handleAviso }}</p>
          <p v-else-if="!handleAtual" class="cp-handle-aviso">
            Você ainda não tem um @nome — sem ele ninguém consegue te adicionar.
          </p>
          <p v-else-if="bloqueadoAte" class="cp-handle-hint">
            Próxima troca liberada em {{ bloqueadoAte }}.
          </p>
        </div>
      </div>

      <div class="cp-controls">
        <div class="cp-tabs">
          <button
            v-for="tab in TABS" :key="tab.id"
            class="cp-tab" :class="{ 'k-active': activeTab === tab.id }"
            @click="activeTab = tab.id"
          >{{ tab.label }}</button>
        </div>

        <div v-if="activeTab === 'avatar'" class="cp-tab-content">
          <div class="cp-label">Personagem</div>
          <div class="cp-preset-grid">
            <button
              v-for="op in catalogoVisivel" :key="op.id"
              class="cp-preset" :class="{ 'k-active': op.id === idEquivalente }"
              @click="vestir(op)"
            >
              <img class="pixelated cp-preset-thumb" :src="avatarSpriteUrl(op.base, 'baixo', 0)" :alt="op.nome" />
              <span class="cp-hair-label">{{ op.nome }}</span>
            </button>
          </div>

          <div class="cp-avancado">
            <button
              class="k-btn k-btn-ghost k-btn-xs" :disabled="!characterStore.avatarId"
              :title="characterStore.avatarId ? 'Editar seus avatares em detalhe' : 'Salve um avatar primeiro'"
              @click="router.push('/admin/avatares')"
            >edição avançada dos meus avatares</button>
          </div>

          <div class="cp-label">Cores</div>
          <div v-for="grupo in GRUPOS_COR" :key="grupo.chave" class="cp-cor-linha">
            <span class="cp-cor-nome">{{ grupo.nome }}</span>
            <div class="cp-swatches">
              <button
                class="cp-swatch cp-swatch-orig"
                :class="{ 'cp-swatch-on': corAtual(grupo.chave) === grupo.padrao }"
                :aria-pressed="corAtual(grupo.chave) === grupo.padrao"
                :aria-label="`${grupo.nome}: cor original do personagem`"
                :title="`${grupo.nome}: cor original do personagem`"
                @click="definirCor(grupo.chave, grupo.padrao)"
              >orig</button>
              <button
                v-for="cor in grupo.cores" :key="cor"
                class="cp-swatch"
                :class="{ 'cp-swatch-on': corAtual(grupo.chave) === cor }"
                :style="{ background: cor }"
                :aria-pressed="corAtual(grupo.chave) === cor"
                :aria-label="`${grupo.nome}: ${cor}`"
                :title="`${grupo.nome}: ${cor}`"
                @click="definirCor(grupo.chave, cor)"
              ></button>
            </div>
          </div>
          <p class="k-hint-text cp-hint">
            «orig» devolve a cor que veio com o personagem. Você vê a mudança na hora aqui do lado,
            mas ninguém mais vê nada até você salvar.
          </p>
        </div>

        <div v-if="activeTab === 'photo'" class="cp-tab-content">
          <div class="cp-label">Foto de perfil</div>
          <p class="k-hint-text cp-hint">
            Se você configurar uma foto, ela substitui o avatar pixel no jogo (todo mundo passa a te
            ver por ela). Sem foto, continua o sprite normal.
          </p>
          <div class="cp-photo-row">
            <div class="cp-photo">
              <img v-if="characterStore.photoFile" :src="photoUrl(characterStore.photoFile)" alt="Sua foto de perfil" />
              <span v-else class="cp-photo-empty">sem foto</span>
            </div>
            <div class="cp-photo-actions">
              <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" class="cp-file" @change="onPhotoPicked" />
              <button class="k-btn k-btn-sm" :disabled="uploadingPhoto" @click="fileInput?.click()">
                {{ uploadingPhoto ? 'Enviando…' : (characterStore.photoFile ? 'Trocar foto' : 'Enviar foto') }}
              </button>
              <button v-if="characterStore.photoFile" class="k-btn k-btn-ghost k-btn-sm" @click="onRemovePhoto">Remover foto</button>
            </div>
          </div>
          <p v-if="photoError" class="cp-error">{{ photoError }}</p>
        </div>

        <p v-if="saveErro" class="cp-error">{{ saveErro }}</p>
        <div class="cp-actions">
          <button class="k-btn k-btn-ghost" :disabled="saving" @click="aleatorio">Aleatório</button>
          <button class="k-btn k-btn-accent cp-save" :disabled="saving" @click="save">
            {{ saving ? 'Salvando…' : 'Salvar e voltar ao jogo' }}
          </button>
        </div>
      </div>
    </div>
  </PanelShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PanelShell from '@/components/PanelShell.vue'
import AvatarVista from '@/components/AvatarVista.vue'
import { AVATAR_PRESETS, avatarSpriteUrl, sanitizeLook } from '@/game/pixi/avatar'
import { acervoDoSeletor, aleatorioDoAcervo, garantirAvatar, type OpcaoDeAvatar, type Rascunho } from '@/services/avatar.escolha'
import type { CoresAlvo } from '@/game/recolorir'
import { useCharacterStore } from '@/stores/useCharacterStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { emitNomeAtualizado } from '@/services/presence'
import { getCharacter, saveCharacter, uploadPhoto, removePhoto, photoUrl } from '@/services/character.api'
import { changeUsername, me, UsernameError } from '@/services/auth.api'

withDefaults(defineProps<{ obrigatorio?: boolean }>(), { obrigatorio: false })

const emit = defineEmits<{ close: [] }>()

const router = useRouter()
const characterStore = useCharacterStore()
const auth = useAuthStore()

const activeTab = ref<'avatar' | 'photo'>('avatar')
const saving = ref(false)
const saveErro = ref('')

const handle = ref('')
const handleAtual = ref('')
const handleErro = ref('')
const handleOk = ref('')
const handleAviso = ref('')
const salvandoHandle = ref(false)
const proximaTrocaEm = ref<string | null>(null)

const bloqueadoAte = computed(() => {
  if (!proximaTrocaEm.value) return ''
  const data = new Date(proximaTrocaEm.value)
  if (Number.isNaN(data.getTime()) || data.getTime() <= Date.now()) return ''
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
})

const podeSalvarHandle = computed(
  () => !salvandoHandle.value && !!handle.value && handle.value.toLowerCase() !== handleAtual.value.toLowerCase(),
)

// botão apagado não diz o que falta: a cor sozinha não comunica o motivo
const dicaHandle = computed(() => {
  if (salvandoHandle.value) return ''
  if (!handle.value) return 'Digite um @nome no campo para liberar o botão.'
  if (handle.value.toLowerCase() === handleAtual.value.toLowerCase()) {
    return 'Esse já é o seu @nome — mude alguma letra para liberar a troca.'
  }
  return ''
})

const VISTAS = [
  { id: 'frente', rotulo: 'frente', direcao: 'baixo' },
  { id: 'lado', rotulo: 'lado', direcao: 'esquerda' },
  { id: 'costas', rotulo: 'costas', direcao: 'cima' },
] as const

type ChaveCor = 'skin' | 'hairColor' | 'topColor'

// mesma regra do jogo (coresEscolhidas, em game/pixi/avatar.ts): cor igual ao
// padrão quer dizer "não escolhi", e o preset mantém a arte original. Se o
// preview recolorisse mesmo assim, ele mostraria uma cor que o mapa não mostra.
const COR_PADRAO: Record<ChaveCor, string> = {
  skin: '#e8b894',
  hairColor: '#3d2817',
  topColor: '#2c7441',
}

const GRUPOS_COR: { chave: ChaveCor; nome: string; padrao: string; cores: string[] }[] = [
  {
    chave: 'skin',
    nome: 'Pele',
    padrao: COR_PADRAO.skin,
    cores: ['#f7dcc3', '#efc9a4', '#e0ac7e', '#c68642', '#9c6134', '#6b4326'],
  },
  {
    chave: 'hairColor',
    nome: 'Cabelo',
    padrao: COR_PADRAO.hairColor,
    cores: ['#1a1410', '#6b4423', '#b5651d', '#d9a441', '#a83232', '#5b3fa8', '#10695f', '#e3e3e3'],
  },
  {
    chave: 'topColor',
    nome: 'Roupa',
    padrao: COR_PADRAO.topColor,
    cores: ['#2a4d8f', '#10695f', '#a83232', '#f2a93b', '#7b5ea7', '#a03562', '#241c15', '#fff6e0'],
  },
]

function corAtual(chave: ChaveCor): string {
  if (chave === 'skin') return characterStore.skin
  if (chave === 'hairColor') return characterStore.hairColor
  return characterStore.topColor
}

function definirCor(chave: ChaveCor, cor: string) {
  if (chave === 'skin') characterStore.skin = cor
  else if (chave === 'hairColor') characterStore.hairColor = cor
  else characterStore.topColor = cor
}

const coresAlvo = computed<CoresAlvo>(() => {
  const usar = (chave: ChaveCor) => {
    const v = corAtual(chave)
    return v && v.toLowerCase() !== COR_PADRAO[chave] ? v : null
  }
  return { pele: usar('skin'), cabelo: usar('hairColor'), roupa: usar('topColor') }
})

function sorteia<T>(lista: readonly T[]): T | undefined {
  return lista[Math.floor(Math.random() * lista.length)]
}

const catalogoVisivel = ref<OpcaoDeAvatar[]>([])

// o card destacado é o do avatar equivalente ao rascunho — não o "último clicado".
// Assim mexer numa cor tira o destaque sozinho, que é a verdade: já não é mais aquele
const idEquivalente = computed(() => {
  const alvo = coresAlvo.value
  return catalogoVisivel.value.find(
    (o) => o.base === characterStore.hairStyle &&
      o.pele === (alvo.pele ?? null) && o.cabelo === (alvo.cabelo ?? null) &&
      o.roupa === (alvo.roupa ?? null),
  )?.id ?? null
})

function vestir(op: OpcaoDeAvatar) {
  characterStore.hairStyle = op.base
  definirCor('skin', op.pele ?? COR_PADRAO.skin)
  definirCor('hairColor', op.cabelo ?? COR_PADRAO.hairColor)
  definirCor('topColor', op.roupa ?? COR_PADRAO.topColor)
}

// sorteio é rascunho: mexe só no que está na tela, sem tocar no servidor.
// Sorteia do acervo inteiro, inclusive avatares criados por outras pessoas — que é
// o que faz o mundo ficar mais variado à medida que gente cria.
async function aleatorio() {
  const doAcervo = await aleatorioDoAcervo()
  if (doAcervo) {
    vestir(doAcervo)
    return
  }
  // acervo indisponível: cai no sorteio local em vez de não fazer nada
  const preset = sorteia(AVATAR_PRESETS)
  if (preset) characterStore.hairStyle = preset.id
  for (const grupo of GRUPOS_COR) {
    const cor = sorteia([grupo.padrao, ...grupo.cores])
    if (cor) definirCor(grupo.chave, cor)
  }
}

// o rascunho como estava ao abrir: se nada mudou, salvar não pode criar avatar novo
const inicial = ref<Rascunho | null>(null)

const rascunhoAtual = computed<Rascunho>(() => ({
  base: characterStore.hairStyle,
  pele: coresAlvo.value.pele ?? null,
  cabelo: coresAlvo.value.cabelo ?? null,
  roupa: coresAlvo.value.roupa ?? null,
}))

onMounted(async () => {
  if (!auth.isAuthenticated) return
  const saved = await getCharacter()
  // sanitizeLook antes de gravar no store: sem isso um hairStyle legado (o antigo
  // default 'short') entrava cru, nenhum card destacava e o mundo caía calado no
  // corpo padrão — painel e mapa mostravam coisas diferentes
  if (saved && saved.hairStyle) {
    const limpo = sanitizeLook(saved)
    characterStore.$patch({ ...saved, hairStyle: limpo.hairStyle })
  }
  inicial.value = { ...rascunhoAtual.value }
  try {
    catalogoVisivel.value = await acervoDoSeletor()
  } catch {
    catalogoVisivel.value = []
  }
  try {
    const perfil = await me()
    handleAtual.value = perfil.username ?? ''
    handle.value = perfil.username ?? ''
  } catch {
    handleAviso.value = 'Não deu pra ler seu @nome agora.'
  }
})

async function salvarHandle() {
  if (!podeSalvarHandle.value) return
  salvandoHandle.value = true
  handleErro.value = ''
  handleOk.value = ''
  handleAviso.value = ''
  try {
    const view = await changeUsername(handle.value)
    handleAtual.value = view.username ?? ''
    handle.value = view.username ?? ''
    proximaTrocaEm.value = view.proximaTrocaEm
    handleOk.value = `Pronto: agora você é @${view.username}.`
    emitNomeAtualizado()
  } catch (e) {
    if (e instanceof UsernameError) {
      handleErro.value = e.message
      if (e.proximaTrocaEm) proximaTrocaEm.value = e.proximaTrocaEm
    } else {
      handleErro.value = 'Não deu pra trocar o nome de usuário.'
    }
  } finally {
    salvandoHandle.value = false
  }
}

async function save() {
  if (!auth.isAuthenticated) {
    emit('close')
    return
  }
  saving.value = true
  saveErro.value = ''
  // fechar sem olhar a resposta escondia falha de salvamento: o painel sumia
  // como se tivesse dado certo e a mudança voltava atrás no próximo carregamento
  // só vira avatar novo se o rascunho realmente mudou; reabrir e salvar sem mexer
  // continua vestindo a mesma linha
  let avatarId = characterStore.avatarId
  const mudou =
    !inicial.value ||
    inicial.value.base !== rascunhoAtual.value.base ||
    inicial.value.pele !== rascunhoAtual.value.pele ||
    inicial.value.cabelo !== rascunhoAtual.value.cabelo ||
    inicial.value.roupa !== rascunhoAtual.value.roupa
  if (mudou || !avatarId) {
    try {
      avatarId = await garantirAvatar(rascunhoAtual.value)
    } catch {
      saving.value = false
      saveErro.value = 'Não deu pra guardar esse avatar. Tente de novo em instantes.'
      return
    }
  }

  const ok = await saveCharacter({
    avatarId,
    hairStyle: characterStore.hairStyle,
    hairColor: characterStore.hairColor,
    skin: characterStore.skin,
    topColor: characterStore.topColor,
    pantsColor: characterStore.pantsColor,
  })
  saving.value = false
  if (!ok) {
    saveErro.value = 'Não deu pra salvar o avatar. Tente de novo em instantes.'
    return
  }
  characterStore.avatarId = avatarId
  inicial.value = { ...rascunhoAtual.value }
  emit('close')
}

const fileInput = ref<HTMLInputElement | null>(null)
const uploadingPhoto = ref(false)
const photoError = ref('')

async function onPhotoPicked(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  photoError.value = ''
  uploadingPhoto.value = true
  const res = await uploadPhoto(file)
  uploadingPhoto.value = false
  if (fileInput.value) fileInput.value.value = ''
  if (!res.ok) { photoError.value = res.error || 'Falha ao enviar a foto'; return }
  characterStore.photoFile = res.photoFile || null
}

async function onRemovePhoto() {
  photoError.value = ''
  const ok = await removePhoto()
  if (ok) characterStore.photoFile = null
  else photoError.value = 'Falha ao remover a foto'
}

const TABS = [
  { id: 'avatar', label: 'Avatar' },
  { id: 'photo', label: 'Foto' },
] as const
</script>

<style scoped>
.cp-grid {
  display: grid;
  grid-template-columns: 15rem 1fr;
  gap: 1.25rem;
  align-items: start;
}

.cp-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  background: var(--bg-1);
  border: 0.0625rem solid var(--border);
  padding: 1rem 0.75rem;
}

.cp-eyebrow {
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  color: var(--text-3);
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.cp-preview {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.375rem;
}


.cp-handle {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.375rem;
  width: 100%;
  border-top: 0.0625rem solid var(--border);
  padding-top: 0.75rem;
}

.cp-handle .cp-eyebrow { text-align: center; }

.cp-handle-hint {
  margin: 0;
  font-size: 0.6875rem;
  line-height: 1.4;
  color: var(--text-3);
  text-align: center;
}

.cp-handle-row {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.cp-at {
  font-family: var(--f-sans);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-3);
}

.cp-handle-input {
  flex: 1;
  min-width: 0;
  font-family: var(--f-mono);
}

.cp-handle-ok { color: var(--ok); font-size: 0.75rem; margin: 0; text-align: center; }
.cp-handle-aviso { color: var(--warn); font-size: 0.75rem; margin: 0; text-align: center; }

.cp-controls {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
}

.cp-tabs {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  border: 0.1875rem solid var(--border-strong);
}

.cp-tab {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--text-3);
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.625rem 0.375rem;
  cursor: pointer;
}
.cp-tab:not(:last-child) { border-right: 0.125rem solid var(--border-strong); }

.cp-tab-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.cp-label {
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  color: var(--text-3);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.cp-preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(4.5rem, 1fr));
  gap: 0.375rem;
}

.cp-preset {
  appearance: none;
  background: var(--bg-3);
  border: 0.125rem solid transparent;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.25rem;
}
.cp-preset:hover:not(.k-active) { border-color: var(--border-strong); }

.cp-preset-thumb {
  width: 2.5rem;
  height: 2.5rem;
  object-fit: contain;
}

.cp-hair-label {
  font-family: var(--f-sans);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-3);
  text-transform: lowercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.cp-cor-linha {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.cp-cor-nome {
  font-family: var(--f-sans);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-2);
}

.cp-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

/* 2.125rem = 34px: passa do alvo mínimo de 32px mesmo com a borda contando. */
.cp-swatch {
  appearance: none;
  width: 2.125rem;
  height: 2.125rem;
  padding: 0;
  cursor: pointer;
  border: 0.125rem solid var(--border);
  background: var(--bg-2);
  flex: none;
}
.cp-swatch:hover { border-color: var(--border-strong); }
.cp-swatch:focus-visible { outline: none; border-color: var(--tinta); box-shadow: 0 0 0 0.1875rem var(--accent); }

/* âmbar tem 1,00:1 sobre a grama e some sozinho: o anel só carrega a seleção
   porque vem colado na borda de tinta. */
.cp-swatch-on {
  border-color: var(--tinta);
  box-shadow: 0 0 0 0.1875rem var(--accent);
}

.cp-swatch-orig {
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text);
}

.cp-hint { margin: 0; }

.cp-photo-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.cp-photo {
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 50%;
  overflow: hidden;
  background: var(--bg-1);
  border: 0.125rem solid var(--border-strong);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.cp-photo img { width: 100%; height: 100%; object-fit: cover; }

.cp-photo-empty {
  font-size: 0.5625rem;
  color: var(--text-4);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.cp-photo-actions {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  align-items: flex-start;
}

.cp-file { display: none; }

.cp-error { color: var(--err); font-size: 0.75rem; margin: 0; }

/* um destaque só por painel: âmbar é "confirmar e voltar ao jogo". Aleatório
   não escreve nada, então não disputa a atenção — fica em ghost. */
.cp-actions {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
  margin-top: 0.25rem;
}

.cp-save { flex: 1; }

@media (max-width: 44rem) {
  .cp-grid { grid-template-columns: 1fr; }
  .cp-stage { max-width: 22rem; margin: 0 auto; }
}

@media (max-width: 26.25rem) {
  .cp-actions { flex-direction: column; }
}
</style>
