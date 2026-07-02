<template>
  <div class="char-root">
    <!-- LEFT: Avatar stage -->
    <div class="stage-col">
      <!-- Top meander -->
      <div class="stage-border-top">
        <MeanderBorder color="var(--accent)" :height="12" :opacity="0.4" />
      </div>

      <!-- Logo top-left -->
      <div class="stage-logo">
        <Logo :id="gameStore.activeLogo" size="sm" primary="var(--primary-hi)" accent="var(--accent)" />
      </div>

      <!-- Back button -->
      <div class="back-wrap">
        <button class="k-btn k-btn-ghost k-btn-sm" @click="router.push('/login')">← Voltar</button>
      </div>

      <!-- Columns flanking avatar -->
      <div class="column-left">
        <PixelColumn :scale="4" color="var(--text-3)" :height="32" />
      </div>
      <div class="column-right">
        <PixelColumn :scale="4" color="var(--text-3)" :height="32" />
      </div>

      <!-- Avatar center -->
      <div class="avatar-center">
        <span class="avatar-label-top">Crie seu avatar</span>

        <div class="avatar-preview">
          <PixiAvatarPreview
            :hairStyle="characterStore.hairStyle"
            :hairColor="characterStore.hairColor"
            :skin="characterStore.skin"
            :topColor="characterStore.topColor"
            :pantsColor="characterStore.pantsColor"
            :accessory="characterStore.accessory"
          />
        </div>

        <span class="avatar-label-bottom">◇ frente · idle ◇</span>

        <input
          v-model.trim="characterStore.name"
          class="k-input name-input"
          type="text"
          maxlength="20"
          placeholder="Seu nome..."
        />
      </div>

      <!-- Bottom meander -->
      <div class="stage-border-bottom">
        <MeanderBorder color="var(--accent)" :height="12" :opacity="0.4" />
      </div>
    </div>

    <!-- RIGHT: Customization panel -->
    <div class="panel-col">
      <!-- Header -->
      <div class="panel-header">
        <span class="panel-eyebrow">Personalização</span>
        <span class="panel-title">Faça do seu jeito</span>
      </div>

      <!-- Tabs -->
      <div class="tabs-grid">
        <button
          v-for="tab in TABS"
          :key="tab.id"
          class="tab-btn"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Tab content: Cabelo -->
      <div v-if="activeTab === 'hair'" class="tab-content">
        <!-- Hair style selector -->
        <div class="section-label">Estilo</div>
        <div class="hair-style-grid">
          <button
            v-for="style in HAIR_STYLES"
            :key="style.id"
            class="hair-style-btn"
            :class="{ active: characterStore.hairStyle === style.id, 'k-active': characterStore.hairStyle === style.id }"
            @click="characterStore.hairStyle = style.id as any"
          >
            <PixelAvatar
              :scale="2"
              :bobbing="false"
              :shadow="false"
              :hairStyle="style.id as any"
              :hairColor="characterStore.hairColor"
              :skin="characterStore.skin"
              :topColor="characterStore.topColor"
              :pantsColor="characterStore.pantsColor"
            />
            <span class="hair-style-label">{{ style.label }}</span>
          </button>
        </div>

        <!-- Hair color swatches -->
        <div class="section-label q-mt-md">Cor do Cabelo</div>
        <div class="swatches-wrap">
          <button
            v-for="color in HAIR_COLORS"
            :key="color"
            class="swatch-btn"
            @click="characterStore.hairColor = color"
          >
            <span
              class="swatch-inner"
              :style="{
                background: color,
                boxShadow: characterStore.hairColor === color
                  ? '0 0 0 0.125rem var(--bg-2), 0 0 0 0.25rem var(--primary-hi)'
                  : 'inset 0 0 0 0.0625rem rgba(255,255,255,0.06)',
              }"
            />
          </button>
        </div>
      </div>

      <!-- Tab content: Pele -->
      <div v-if="activeTab === 'skin'" class="tab-content">
        <div class="section-label">Tom de Pele</div>
        <div class="swatches-wrap">
          <button
            v-for="color in SKIN_TONES"
            :key="color"
            class="swatch-btn"
            @click="characterStore.skin = color"
          >
            <span
              class="swatch-inner swatch-big"
              :style="{
                background: color,
                boxShadow: characterStore.skin === color
                  ? '0 0 0 0.125rem var(--bg-2), 0 0 0 0.25rem var(--primary-hi)'
                  : 'inset 0 0 0 0.0625rem rgba(255,255,255,0.06)',
              }"
            />
          </button>
        </div>
      </div>

      <!-- Tab content: Roupa -->
      <div v-if="activeTab === 'outfit'" class="tab-content">
        <div class="section-label">Cor da Camisa</div>
        <div class="swatches-wrap">
          <button
            v-for="color in TOP_COLORS"
            :key="color"
            class="swatch-btn"
            @click="characterStore.topColor = color"
          >
            <span
              class="swatch-inner swatch-big"
              :style="{
                background: color,
                boxShadow: characterStore.topColor === color
                  ? '0 0 0 0.125rem var(--bg-2), 0 0 0 0.25rem var(--primary-hi)'
                  : 'inset 0 0 0 0.0625rem rgba(255,255,255,0.06)',
              }"
            />
          </button>
        </div>

        <div class="section-label q-mt-md">Cor da Calça</div>
        <div class="swatches-wrap">
          <button
            v-for="color in PANTS_COLORS"
            :key="color"
            class="swatch-btn"
            @click="characterStore.pantsColor = color"
          >
            <span
              class="swatch-inner swatch-big"
              :style="{
                background: color,
                boxShadow: characterStore.pantsColor === color
                  ? '0 0 0 0.125rem var(--bg-2), 0 0 0 0.25rem var(--primary-hi)'
                  : 'inset 0 0 0 0.0625rem rgba(255,255,255,0.06)',
              }"
            />
          </button>
        </div>

        <div class="section-label q-mt-md">Acessório</div>
        <div class="swatches-wrap">
          <button
            v-for="a in ACCESSORIES"
            :key="a.id"
            class="acc-btn"
            :class="{ on: characterStore.accessory === a.id }"
            @click="characterStore.accessory = a.id"
          >{{ a.label }}</button>
        </div>
      </div>

      <!-- Tab content: Foto de perfil -->
      <div v-if="activeTab === 'photo'" class="tab-content">
        <div class="section-label">Foto de perfil</div>
        <p v-if="!auth.isAuthenticated" class="k-hint-text">Faça login pra configurar uma foto de perfil.</p>
        <template v-else>
          <p class="k-hint-text">
            Se você configurar uma foto, ela substitui o avatar pixel no jogo (todo mundo passa a te ver por ela). Sem foto, continua o sprite normal.
          </p>
          <div class="photo-row row items-center q-gutter-md">
            <div class="photo-preview">
              <img v-if="characterStore.photoFile" :src="photoUrl(characterStore.photoFile)" alt="Sua foto de perfil" />
              <span v-else class="photo-empty">sem foto</span>
            </div>
            <div class="column q-gutter-xs">
              <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" class="photo-file-input" @change="onPhotoPicked" />
              <button class="k-btn k-btn-ghost k-btn-sm" :disabled="uploadingPhoto" @click="fileInput?.click()">
                {{ uploadingPhoto ? 'Enviando…' : (characterStore.photoFile ? 'Trocar foto' : 'Enviar foto') }}
              </button>
              <button v-if="characterStore.photoFile" class="k-btn k-btn-ghost k-btn-sm" @click="onRemovePhoto">Remover foto</button>
            </div>
          </div>
          <p v-if="photoError" class="photo-error">{{ photoError }}</p>
        </template>
      </div>

      <!-- Summary card -->
      <div class="summary-card k-card">
        <div class="summary-item">
          <span class="summary-key">Nome</span>
          <span class="summary-val">{{ characterStore.name || '—' }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-key">Cabelo</span>
          <span class="summary-val">{{ characterStore.hairStyle }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-key">Cor Cabelo</span>
          <span class="summary-val swatch-dot" :style="{ background: characterStore.hairColor }" />
        </div>
        <div class="summary-item">
          <span class="summary-key">Pele</span>
          <span class="summary-val swatch-dot" :style="{ background: characterStore.skin }" />
        </div>
        <div class="summary-item">
          <span class="summary-key">Topo</span>
          <span class="summary-val swatch-dot" :style="{ background: characterStore.topColor }" />
        </div>
        <div class="summary-item">
          <span class="summary-key">Calça</span>
          <span class="summary-val swatch-dot" :style="{ background: characterStore.pantsColor }" />
        </div>
      </div>

      <!-- Enter button -->
      <button class="k-btn k-btn-accent enter-btn" @click="enterKairos">
        Entrar no Kairos →
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import MeanderBorder from '@/components/pixel/MeanderBorder.vue'
import PixelColumn from '@/components/pixel/PixelColumn.vue'
import PixelAvatar from '@/components/pixel/PixelAvatar.vue'
import PixiAvatarPreview from '@/components/PixiAvatarPreview.vue'
import Logo from '@/components/logos/Logo.vue'
import { useCharacterStore } from '@/stores/useCharacterStore'
import { useGameStore } from '@/stores/useGameStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { getCharacter, saveCharacter, uploadPhoto, removePhoto, photoUrl } from '@/services/character.api'

const router = useRouter()
const characterStore = useCharacterStore()
const gameStore = useGameStore()
const auth = useAuthStore()

// carrega a customização salva no banco (cross-device), se logado
onMounted(async () => {
  if (!auth.isAuthenticated) return
  const saved = await getCharacter()
  if (saved && saved.hairStyle) characterStore.$patch(saved)
})

// salva no banco (best-effort) e entra
async function enterKairos() {
  if (auth.isAuthenticated) {
    await saveCharacter({
      name: characterStore.name,
      hairStyle: characterStore.hairStyle,
      hairColor: characterStore.hairColor,
      skin: characterStore.skin,
      topColor: characterStore.topColor,
      pantsColor: characterStore.pantsColor,
      accessory: characterStore.accessory,
    })
  }
  router.push('/map-select')
}

const activeTab = ref<'hair' | 'skin' | 'outfit' | 'photo'>('hair')

const TABS = [
  { id: 'hair', label: 'Cabelo' },
  { id: 'skin', label: 'Pele' },
  { id: 'outfit', label: 'Roupa' },
  { id: 'photo', label: 'Foto' },
]

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

const HAIR_STYLES = [
  { id: 'short', label: 'short' },
  { id: 'curly', label: 'curly' },
  { id: 'ponytail', label: 'ponytail' },
  { id: 'mohawk', label: 'mohawk' },
  { id: 'helmet', label: 'helmet' },
  { id: 'buzz', label: 'buzz' },
  { id: 'long', label: 'long' },
]

const HAIR_COLORS = [
  '#1a1a1a', '#3d2817', '#6b3410', '#a0522d', '#d4a259',
  '#f4d35e', '#c2185b', '#7b1fa2', '#1565c0', '#cfd8dc',
  '#e84393', '#00b894', '#fd79a8', '#6c5ce7', '#b2bec3',
]

const SKIN_TONES = [
  '#ffe0bd', '#f4d4ba', '#e8b894', '#d9a066', '#c98c68',
  '#9c6b3f', '#7a5230', '#6b4226', '#4e3320', '#3e2718',
]

const TOP_COLORS = [
  '#7c3aed', '#22d3ee', '#34d399', '#fbbf24', '#f87171', '#e8e8f0',
  '#ec4899', '#f97316', '#84cc16', '#0ea5e9', '#1e293b', '#a855f7',
]

const PANTS_COLORS = [
  '#1f2937', '#3b3b4a', '#4c1d95', '#0f766e', '#7f1d1d', '#92400e',
  '#0c4a6e', '#365314', '#831843', '#111827', '#5b21b6', '#78350f',
]

const ACCESSORIES = [
  { id: 'none' as const, label: 'Nenhum' },
  { id: 'glasses' as const, label: '🤓 Óculos' },
  { id: 'hat' as const, label: '🧢 Chapéu' },
]
</script>

<style scoped>
.char-root {
  display: grid;
  grid-template-columns: 1fr 23.75rem;
  height: 100vh;
  background:
    radial-gradient(ellipse at 30% 30%, rgba(124, 58, 237, 0.15), transparent 50%),
    var(--bg-1);
  overflow: hidden;
}

/* ---- LEFT / STAGE ---- */
.stage-col {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 2rem;
}

.stage-border-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}

.stage-border-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  transform: scaleY(-1);
}

.stage-logo {
  position: absolute;
  top: 1.25rem;
  left: 1.25rem;
  z-index: 2;
}

.back-wrap {
  position: absolute;
  top: 1.25rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
}

.column-left {
  position: absolute;
  left: 12%;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.32;
}

.column-right {
  position: absolute;
  right: 12%;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.32;
}

.avatar-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  z-index: 1;
}

.avatar-label-top {
  font-family: var(--f-pixel);
  font-size: 0.6875rem;
  color: var(--text-3);
  letter-spacing: 0.32em;
  text-transform: uppercase;
}

.avatar-preview {
  padding: 2.5rem;
  background: radial-gradient(ellipse at center, rgba(124, 58, 237, 0.2) 0%, transparent 70%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-label-bottom {
  font-family: var(--f-mono);
  font-size: 0.75rem;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.name-input {
  width: min(16.25rem, 100%);
  text-align: center;
  background: var(--bg-1);
  border: 0.1875rem solid var(--text-3);
  color: var(--text);
  font-family: var(--f-sans);
  font-size: 0.9375rem;
  padding: 0.625rem 0.875rem;
  outline: none;
}

.name-input:focus {
  border-color: var(--primary-hi);
}

.name-input::placeholder {
  color: var(--text-4);
}

/* ---- RIGHT / PANEL ---- */
.panel-col {
  background: var(--bg-2);
  border-left: 0.0625rem solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 1.75rem 1.5rem 1.5rem;
  gap: 1rem;
  overflow-y: auto;
}

.panel-header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.panel-eyebrow {
  font-family: var(--f-pixel);
  font-size: 0.5625rem;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.panel-title {
  font-size: 1.375rem;
  font-weight: 600;
  color: var(--text);
  font-family: var(--f-sans);
}

/* Tabs */
.tabs-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  border: 0.1875rem solid var(--border-strong);
}

.tab-btn {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--text-3);
  font-family: var(--f-pixel);
  font-size: 0.5625rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.625rem 0.375rem;
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
}

.tab-btn:not(:last-child) {
  border-right: 0.125rem solid var(--border-strong);
}

.tab-btn.active {
  background: var(--bg-3);
  color: var(--text);
}

/* Tab content */
.tab-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-label {
  font-family: var(--f-pixel);
  font-size: 0.5625rem;
  color: var(--text-3);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

/* Hair style selector */
.hair-style-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.375rem;
}

.hair-style-btn {
  appearance: none;
  background: var(--bg-3);
  border: 0.125rem solid transparent;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.25rem;
  transition: border-color 0.1s, background 0.1s;
}

.hair-style-btn:hover:not(.active) {
  border-color: var(--border-strong);
}

.hair-style-label {
  font-family: var(--f-pixel);
  font-size: 0.4375rem;
  color: var(--text-3);
  text-transform: lowercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* k-hint-text (tokens.css) cobre font-size/color/line-height; só falta o margin:0 */
.k-hint-text { margin: 0; }
.photo-preview {
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
.photo-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.photo-empty {
  font-size: 0.5625rem;
  color: var(--text-4);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.photo-file-input {
  display: none;
}
.photo-error {
  color: var(--err);
  font-size: 0.75rem;
  margin: 0;
}

/* Swatches */
.swatches-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.acc-btn {
  appearance: none;
  border: 0.0625rem solid var(--border);
  background: var(--bg-1);
  color: var(--text-2);
  padding: 0.5rem 0.875rem;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 600;
}
.acc-btn.on {
  border-color: var(--primary-hi);
  color: var(--text);
  box-shadow: 0 0 0 0.125rem var(--bg-2), 0 0 0 0.25rem var(--primary-hi);
}

.swatch-btn {
  appearance: none;
  border: 0.125rem solid transparent;
  padding: 0.125rem;
  cursor: pointer;
  background: var(--bg-1);
  transition: border-color 0.1s;
}

.swatch-inner {
  display: block;
  width: 1.875rem;
  height: 1.875rem;
}

.swatch-big {
  width: 2.375rem;
  height: 2.375rem;
}

/* Summary */
.summary-card {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem 1rem;
  padding: 0.875rem 1rem;
  margin-top: auto;
}

.summary-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.summary-key {
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  color: var(--text-3);
  text-transform: uppercase;
  white-space: nowrap;
}

.summary-val {
  font-family: var(--f-mono);
  font-size: 0.6875rem;
  color: var(--text-2);
  text-transform: capitalize;
}

.swatch-dot {
  display: inline-block;
  width: 0.875rem;
  height: 0.875rem;
  flex-shrink: 0;
}

/* Enter button */
.enter-btn {
  width: 100%;
  padding: 1rem 1.125rem;
  margin-top: auto;
}

/* B4: em telas estreitas o grid de 2 colunas + 100vh fixo cortava o painel.
   Empilha (preview em cima, controles embaixo) e libera o scroll da página. */
@media (max-width: 51.25rem) {
  .char-root {
    grid-template-columns: 1fr;
    height: auto;
    min-height: 100vh;
    overflow: visible;
  }
  .stage-col {
    min-height: 50vh;
  }
  .panel-col {
    border-left: none;
    border-top: 0.0625rem solid var(--border);
    overflow-y: visible;
  }
}

/* padding fixo de 2rem do stage-col sobrava pouco espaço em telas bem estreitas
   (name-input já é relativo, mas o padding em si ainda apertava o preview). */
@media (max-width: 25rem) {
  .stage-col {
    padding: 1rem;
  }
}
</style>
