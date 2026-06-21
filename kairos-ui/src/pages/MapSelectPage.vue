<template>
  <div class="screen-enter" :style="{
    minHeight: '100vh', padding: '32px',
    background: 'radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.18), transparent 50%), var(--bg-1)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', overflowY: 'auto',
  }">
    <div style="width:100%;display:flex;justify-content:space-between;align-items:center">
      <Logo :id="gameStore.activeLogo" size="sm" primary="var(--primary-hi)" accent="var(--accent)" />
      <button class="k-btn k-btn-ghost" @click="router.push('/character')">← Voltar</button>
    </div>

    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center">
      <span class="k-chip">escolha um mundo</span>
      <h1 :style="{ fontSize: '36px', margin: 0, fontWeight: 600, letterSpacing: '-0.03em' }">
        Olá, <span style="color:var(--accent)">{{ characterStore.name || 'viajante' }}</span>. Em qual mundo você entra?
      </h1>
      <p style="color:var(--text-3);margin:0;font-size:15px">
        Você pode trocar de mundo a qualquer momento dentro do jogo.
      </p>
    </div>

    <p v-if="error" style="color:#f87171">{{ error }}</p>
    <p v-else-if="!maps.length" style="color:var(--text-3)">Carregando mundos…</p>

    <div :style="{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '20px', width: 'min(1000px, 100%)',
    }">
      <div
        v-for="m in maps" :key="m.id" class="k-card"
        :style="{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', cursor: 'pointer', transition: 'transform 0.18s ease' }"
        @click="pickMap(m.id)"
        @mouseenter="($event.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'"
        @mouseleave="($event.currentTarget as HTMLElement).style.transform = 'translateY(0)'"
      >
        <div :style="{ aspectRatio: '3/2', background: m.palette.floor[0], overflow: 'hidden', position: 'relative', border: '1px solid rgba(255,255,255,0.06)' }">
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

        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <h3 style="margin:0;font-size:18px;font-weight:600;letter-spacing:-0.02em">{{ m.name }}</h3>
          <span style="font-size:10px;letter-spacing:0.18em;color:var(--text-4);text-transform:uppercase">{{ m.label }}</span>
        </div>
        <p style="margin:0;font-size:13px;color:var(--text-3);line-height:1.5;min-height:36px">{{ m.blurb }}</p>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
          <span style="font-size:11px;color:var(--text-4);font-family:var(--f-mono)">{{ m.width }}×{{ m.height }} · {{ countZones(m) }} estações · {{ m.hours }}</span>
          <span style="font-size:13px;color:var(--accent);font-weight:600">Entrar →</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/useGameStore'
import { useCharacterStore } from '@/stores/useCharacterStore'
import { interactableObjects, type MapDef } from '@/game/maps'
import { fetchMaps } from '@/services/maps.api'
import Logo from '@/components/logos/Logo.vue'

const router = useRouter()
const gameStore = useGameStore()
const characterStore = useCharacterStore()

const maps = ref<MapDef[]>([])
const error = ref('')

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

onMounted(async () => {
  try {
    maps.value = await fetchMaps()
  } catch (e) {
    error.value = 'Não foi possível carregar os mundos.'
  }
})
</script>
