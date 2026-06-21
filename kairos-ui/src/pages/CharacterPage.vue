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
        <button class="k-btn k-btn-ghost back-btn" @click="router.push('/login')">← Voltar</button>
      </div>

      <!-- Columns flanking avatar -->
      <div class="column-left">
        <PixelColumn :scale="4" color="var(--text-3)" :height="32" :style="{ opacity: 0.32 }" />
      </div>
      <div class="column-right">
        <PixelColumn :scale="4" color="var(--text-3)" :height="32" :style="{ opacity: 0.32 }" />
      </div>

      <!-- Avatar center -->
      <div class="avatar-center">
        <span class="avatar-label-top">Crie seu avatar</span>

        <div class="avatar-preview" style="width:240px;height:300px">
          <PixiAvatarPreview
            :hairStyle="characterStore.hairStyle"
            :hairColor="characterStore.hairColor"
            :skin="characterStore.skin"
            :topColor="characterStore.topColor"
            :pantsColor="characterStore.pantsColor"
          />
        </div>

        <span class="avatar-label-bottom">◇ frente · idle ◇</span>

        <input
          v-model="characterStore.name"
          class="k-input name-input"
          type="text"
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
            :class="{ active: characterStore.hairStyle === style.id }"
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
        <div class="section-label" style="margin-top: 16px">Cor do Cabelo</div>
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
                  ? '0 0 0 2px var(--bg-2), 0 0 0 4px var(--primary-hi)'
                  : 'inset 0 0 0 1px rgba(255,255,255,0.06)',
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
                  ? '0 0 0 2px var(--bg-2), 0 0 0 4px var(--primary-hi)'
                  : 'inset 0 0 0 1px rgba(255,255,255,0.06)',
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
                  ? '0 0 0 2px var(--bg-2), 0 0 0 4px var(--primary-hi)'
                  : 'inset 0 0 0 1px rgba(255,255,255,0.06)',
              }"
            />
          </button>
        </div>

        <div class="section-label" style="margin-top: 16px">Cor da Calça</div>
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
                  ? '0 0 0 2px var(--bg-2), 0 0 0 4px var(--primary-hi)'
                  : 'inset 0 0 0 1px rgba(255,255,255,0.06)',
              }"
            />
          </button>
        </div>
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
import { getCharacter, saveCharacter } from '@/services/character.api'

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
    })
  }
  router.push('/map-select')
}

const activeTab = ref<'hair' | 'skin' | 'outfit'>('hair')

const TABS = [
  { id: 'hair', label: 'Cabelo' },
  { id: 'skin', label: 'Pele' },
  { id: 'outfit', label: 'Roupa' },
]

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
]

const SKIN_TONES = [
  '#f4d4ba', '#e8b894', '#c98c68', '#9c6b3f', '#6b4226', '#3e2718',
]

const TOP_COLORS = [
  '#7c3aed', '#22d3ee', '#34d399', '#fbbf24', '#f87171', '#e8e8f0',
]

const PANTS_COLORS = [
  '#1f2937', '#3b3b4a', '#4c1d95', '#0f766e', '#7f1d1d', '#92400e',
]
</script>

<style scoped>
.char-root {
  display: grid;
  grid-template-columns: 1fr 380px;
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
  padding: 32px;
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
  top: 20px;
  left: 20px;
  z-index: 2;
}

.back-wrap {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
}

.back-btn {
  font-size: 11px;
  padding: 8px 14px;
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
  gap: 16px;
  z-index: 1;
}

.avatar-label-top {
  font-family: var(--f-pixel);
  font-size: 11px;
  color: var(--text-3);
  letter-spacing: 0.32em;
  text-transform: uppercase;
}

.avatar-preview {
  padding: 40px;
  background: radial-gradient(ellipse at center, rgba(124, 58, 237, 0.2) 0%, transparent 70%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-label-bottom {
  font-family: var(--f-mono);
  font-size: 12px;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.name-input {
  width: 260px;
  text-align: center;
  background: var(--bg-1);
  border: 3px solid var(--text-3);
  color: var(--text);
  font-family: var(--f-sans);
  font-size: 15px;
  padding: 10px 14px;
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
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 28px 24px 24px;
  gap: 16px;
  overflow-y: auto;
}

.panel-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.panel-eyebrow {
  font-family: var(--f-pixel);
  font-size: 9px;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.panel-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--text);
  font-family: var(--f-sans);
}

/* Tabs */
.tabs-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  border: 3px solid var(--border-strong);
}

.tab-btn {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--text-3);
  font-family: var(--f-pixel);
  font-size: 9px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 10px 6px;
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
}

.tab-btn:not(:last-child) {
  border-right: 2px solid var(--border-strong);
}

.tab-btn.active {
  background: var(--bg-3);
  color: var(--text);
}

/* Tab content */
.tab-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-family: var(--f-pixel);
  font-size: 9px;
  color: var(--text-3);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

/* Hair style selector */
.hair-style-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.hair-style-btn {
  appearance: none;
  background: var(--bg-3);
  border: 2px solid transparent;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px 4px;
  transition: border-color 0.1s, background 0.1s;
}

.hair-style-btn.active {
  border-color: var(--primary-hi);
  background: rgba(124, 58, 237, 0.12);
}

.hair-style-btn:hover:not(.active) {
  border-color: var(--border-strong);
}

.hair-style-label {
  font-family: var(--f-pixel);
  font-size: 7px;
  color: var(--text-3);
  text-transform: lowercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* Swatches */
.swatches-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.swatch-btn {
  appearance: none;
  border: 2px solid transparent;
  padding: 2px;
  cursor: pointer;
  background: var(--bg-1);
  transition: border-color 0.1s;
}

.swatch-inner {
  display: block;
  width: 30px;
  height: 30px;
}

.swatch-big {
  width: 38px;
  height: 38px;
}

/* Summary */
.summary-card {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
  padding: 14px 16px;
  margin-top: auto;
}

.summary-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.summary-key {
  font-family: var(--f-pixel);
  font-size: 8px;
  color: var(--text-3);
  text-transform: uppercase;
  white-space: nowrap;
}

.summary-val {
  font-family: var(--f-mono);
  font-size: 11px;
  color: var(--text-2);
  text-transform: capitalize;
}

.swatch-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

/* Enter button */
.enter-btn {
  width: 100%;
  padding: 16px 18px;
  margin-top: auto;
}
</style>
