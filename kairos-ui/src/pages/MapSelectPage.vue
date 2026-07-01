<template>
  <div class="screen-enter ms-root column items-center q-gutter-lg">
    <div class="row items-center justify-between ms-header">
      <Logo :id="gameStore.activeLogo" size="sm" primary="var(--primary-hi)" accent="var(--accent)" />
      <button class="k-btn k-btn-ghost" @click="router.push('/character')">← Voltar</button>
    </div>

    <div class="column items-center q-gutter-sm text-center">
      <span class="k-chip">{{ orgName ? orgName : 'escolha um mundo' }}</span>
      <h1 class="ms-title">
        Olá, <span class="ms-accent-text">{{ characterStore.name || 'viajante' }}</span>. Em qual mundo você entra?
      </h1>
      <p class="ms-subtitle">
        Você pode trocar de mundo a qualquer momento dentro do jogo.
      </p>
      <button v-if="!auth.isGuest" class="k-btn k-btn-accent q-mt-sm" @click="router.push('/editor/new')">+ Criar meu mundo</button>
      <span v-else class="ms-guest-hint">Entre com uma conta para criar seus próprios mundos.</span>
    </div>

    <p v-if="error" class="ms-error">{{ error }}</p>
    <p v-else-if="!maps.length" class="ms-muted">Carregando mundos…</p>

    <div class="ms-grid">
      <div v-for="m in maps" :key="m.id" class="k-card ms-card column q-gutter-sm" @click="pickMap(m.id)">
        <div class="ms-preview" :style="{ background: m.palette.floor[0] }">
          <svg viewBox="0 0 120 80" width="100%" height="100%" preserveAspectRatio="none" class="pixelated">
            <rect v-for="tile in previewTiles" :key="`${tile.rx}-${tile.ry}`"
              :x="tile.rx * 8" :y="tile.ry * 8" width="8" height="8"
              :fill="(tile.rx + tile.ry) % 2 ? m.palette.floor[0] : m.palette.floor[1]" />
            <rect x="0" y="0" width="120" height="6" :fill="m.palette.wallTop" />
            <rect x="0" y="74" width="120" height="6" :fill="m.palette.wallTop" />
            <rect x="0" y="0" width="4" height="80" :fill="m.palette.wall" />
            <rect x="116" y="0" width="4" height="80" :fill="m.palette.wall" />
            <!-- objetos reais do mapa (escalados pro preview) -->
            <rect v-for="o in m.objects" :key="o.id"
              :x="(o.x / m.width) * 120" :y="(o.y / m.height) * 80"
              :width="(o.w / m.width) * 120" :height="(o.h / m.height) * 80"
              :fill="o.color || objectTint(o.glow)" :opacity="o.color ? 1 : 0.7" />
          </svg>
        </div>

        <div class="row justify-between items-baseline">
          <h3 class="ms-card-title">{{ m.name }}</h3>
          <span class="ms-online" :class="{ 'ms-online-active': (counts[m.id] || 0) > 0 }">
            ● {{ counts[m.id] || 0 }} online
          </span>
        </div>
        <p class="ms-blurb">{{ m.blurb }}</p>
        <div class="row justify-between items-center q-mt-xs">
          <span class="ms-meta">{{ m.width }}×{{ m.height }} · {{ countZones(m) }} estações · {{ m.hours }}</span>
          <span class="row items-center q-gutter-md">
            <a v-if="m.ownerId && m.ownerId === auth.userId" href="#" class="ms-edit-link" @click.stop.prevent="router.push(`/editor/${m.id}`)">✎ Editar</a>
            <span class="ms-enter-label">Entrar →</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/useGameStore'
import { useCharacterStore } from '@/stores/useCharacterStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { interactableObjects, type MapDef } from '@/game/maps'
import { fetchMaps, fetchOnlineCounts } from '@/services/maps.api'
import { getMyOrg } from '@/services/org.api'
import Logo from '@/components/logos/Logo.vue'

const router = useRouter()
const gameStore = useGameStore()
const characterStore = useCharacterStore()
const auth = useAuthStore()

const maps = ref<MapDef[]>([])
const error = ref('')
const counts = ref<Record<string, number>>({})
const orgName = ref('')
let countTimer = 0

const previewTiles = Array.from({ length: 10 }, (_, ry) =>
  Array.from({ length: 15 }, (_, rx) => ({ rx, ry })),
).flat()

function countZones(m: MapDef) {
  return interactableObjects(m).length
}
function objectTint(glow?: string) {
  return glow === 'cyan' ? 'rgba(34,211,238,0.6)' : glow === 'gold' ? 'rgba(251,191,36,0.6)' : glow === 'green' ? 'rgba(52,211,153,0.6)' : 'rgba(124,58,237,0.6)'
}

function pickMap(id: string) {
  gameStore.activeMap = id
  router.push('/game')
}

async function loadCounts() {
  counts.value = await fetchOnlineCounts()
}

onMounted(async () => {
  try {
    maps.value = await fetchMaps()
  } catch (e) {
    error.value = 'Não foi possível carregar os mundos.'
  }
  loadCounts()
  countTimer = window.setInterval(loadCounts, 8000)
  getMyOrg().then((o) => { if (o) orgName.value = o.name })
})

onUnmounted(() => clearInterval(countTimer))
</script>

<style scoped>
.ms-root {
  height: 100vh;
  box-sizing: border-box;
  padding: 32px;
  background: radial-gradient(ellipse at 50% 0%, rgba(124, 58, 237, 0.18), transparent 50%), var(--bg-1);
  overflow-y: auto;
}

.ms-header { width: 100%; }

.ms-title {
  font-size: 36px;
  margin: 0;
  font-weight: 600;
  letter-spacing: -0.03em;
}

.ms-accent-text { color: var(--accent); }

.ms-subtitle {
  color: var(--text-3);
  margin: 0;
  font-size: 15px;
}

.ms-guest-hint {
  font-size: 12px;
  color: var(--text-4);
}

.ms-error { color: #f87171; }
.ms-muted { color: var(--text-3); }

.ms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  width: min(1000px, 100%);
}

.ms-card {
  padding: 18px;
  cursor: pointer;
  transition: transform 0.18s ease;
}

.ms-card:hover {
  transform: translateY(-3px);
}

.ms-preview {
  aspect-ratio: 3 / 2;
  overflow: hidden;
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.ms-card-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.ms-online {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-4);
}

.ms-online-active { color: var(--ok); }

.ms-blurb {
  margin: 0;
  font-size: 13px;
  color: var(--text-3);
  line-height: 1.5;
  min-height: 36px;
}

.ms-meta {
  font-size: 11px;
  color: var(--text-4);
  font-family: var(--f-mono);
}

.ms-edit-link {
  font-size: 13px;
  color: var(--text-2);
  font-weight: 600;
  text-decoration: none;
}

.ms-enter-label {
  font-size: 13px;
  color: var(--accent);
  font-weight: 600;
}

/* Telas estreitas (ou zoom alto): padding fixo de 32px + cards com mínimo de 280px
   causavam overflow horizontal em telas bem pequenas (~320-360px). */
@media (max-width: 480px) {
  .ms-root {
    padding: 16px;
  }
  .ms-title {
    font-size: 26px;
  }
  .ms-grid {
    grid-template-columns: 1fr;
  }
}
</style>
