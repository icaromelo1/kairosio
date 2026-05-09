<template>
  <div class="screen-enter" :style="{
    minHeight: '100vh',
    padding: '32px',
    background: 'radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.18), transparent 50%), var(--bg-1)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
    overflowY: 'auto',
  }">
    <!-- Header -->
    <div style="width:100%;display:flex;justify-content:space-between;align-items:center">
      <Logo :id="gameStore.activeLogo" size="sm" primary="var(--primary-hi)" accent="var(--accent)" />
      <button class="k-btn k-btn-ghost" @click="router.push('/character')">← Voltar</button>
    </div>

    <!-- Title -->
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center">
      <span class="k-chip">novo mundo</span>
      <h1 :style="{ fontSize: '36px', margin: 0, fontWeight: 600, letterSpacing: '-0.03em' }">
        Olá, <span style="color:var(--accent)">{{ characterStore.name || 'viajante' }}</span>. Qual mundo você cria?
      </h1>
      <p style="color:var(--text-3);margin:0;font-size:15px">
        Você pode trocar de mundo a qualquer momento — esta é só sua sala default.
      </p>
    </div>

    <!-- Map cards grid -->
    <div :style="{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '20px',
      width: 'min(1000px, 100%)',
    }">
      <div
        v-for="theme in Object.values(MAP_THEMES)"
        :key="theme.id"
        class="k-card"
        :style="{
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          cursor: 'pointer',
          transition: 'transform 0.18s ease',
        }"
        @click="pickMap(theme.id)"
        @mouseenter="($event.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'"
        @mouseleave="($event.currentTarget as HTMLElement).style.transform = 'translateY(0)'"
      >
        <!-- Mini preview -->
        <div :style="{
          aspectRatio: '3/2',
          background: theme.floor[0],
          overflow: 'hidden',
          position: 'relative',
          border: '1px solid rgba(255,255,255,0.06)',
        }">
          <svg viewBox="0 0 120 80" width="100%" height="100%" preserveAspectRatio="none" class="pixelated">
            <rect
              v-for="tile in previewTiles"
              :key="`${tile.rx}-${tile.ry}`"
              :x="tile.rx * 8"
              :y="tile.ry * 8"
              width="8"
              height="8"
              :fill="(tile.rx + tile.ry) % 2 ? theme.floor[0] : theme.floor[1]"
            />
            <rect x="0" y="0" width="120" height="6" :fill="theme.wallTop" />
            <rect x="0" y="74" width="120" height="6" :fill="theme.wallTop" />
            <rect x="0" y="0" width="4" height="80" :fill="theme.wall" />
            <rect x="116" y="0" width="4" height="80" :fill="theme.wall" />
            <!-- zones -->
            <rect x="56" y="40" width="16" height="8" fill="rgba(255,255,255,0.55)" />
            <rect x="88" y="8" width="20" height="4" fill="rgba(34,211,238,0.5)" />
            <rect x="12" y="64" width="8" height="8" fill="rgba(124,58,237,0.6)" />
            <rect x="8" y="8" width="16" height="12" fill="rgba(124,58,237,0.55)" />
            <rect x="96" y="64" width="16" height="8" fill="rgba(251,191,36,0.5)" />
            <!-- avatar dot -->
            <rect x="62" y="42" width="3" height="4" :fill="characterStore.topColor" />
          </svg>
        </div>

        <!-- Info -->
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <h3 style="margin:0;font-size:18px;font-weight:600;letter-spacing:-0.02em">{{ theme.name }}</h3>
          <span style="font-size:10px;letter-spacing:0.18em;color:var(--text-4);text-transform:uppercase">{{ theme.label }}</span>
        </div>
        <p style="margin:0;font-size:13px;color:var(--text-3);line-height:1.5;min-height:36px">{{ theme.blurb }}</p>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
          <span style="font-size:11px;color:var(--text-4);font-family:var(--f-mono)">30×20 · 5 zonas · {{ theme.hours }}</span>
          <span style="font-size:13px;color:var(--accent);font-weight:600">Criar →</span>
        </div>
      </div>
    </div>

    <div style="color:var(--text-4);font-size:11px;letter-spacing:0.18em;text-transform:uppercase;margin-top:8px">
      ◇ mais mundos serão desbloqueados conforme você usa o Kairos ◇
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/useGameStore'
import { useCharacterStore } from '@/stores/useCharacterStore'
import { MAP_THEMES } from '@/game/constants'
import Logo from '@/components/logos/Logo.vue'

const router = useRouter()
const gameStore = useGameStore()
const characterStore = useCharacterStore()

const previewTiles = Array.from({ length: 10 }, (_, ry) =>
  Array.from({ length: 15 }, (_, rx) => ({ rx, ry }))
).flat()

function pickMap(id: string) {
  gameStore.activeMap = id as 'studio' | 'athenaeum' | 'agora'
  router.push('/game')
}
</script>
