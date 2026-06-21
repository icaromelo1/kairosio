<template>
  <div class="screen-enter" :style="{
    height: '100vh',
    display: 'grid',
    gridTemplateColumns: gameStore.sidebarOpen ? '264px 1fr' : '56px 1fr',
    background: 'var(--bg-0)',
    overflow: 'hidden',
    transition: 'grid-template-columns 0.25s ease',
  }">
    <!-- Sidebar -->
    <aside :style="{
      background: 'var(--bg-2)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: gameStore.sidebarOpen ? '16px' : '8px',
      gap: '14px',
      overflow: 'hidden',
      transition: 'padding 0.25s ease',
    }">
      <!-- Header sidebar -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
        <Logo v-if="gameStore.sidebarOpen" :id="gameStore.activeLogo" size="sm" primary="var(--primary-hi)" accent="var(--accent)" />
        <PixelK v-else :scale="3" color="var(--primary-hi)" accent="var(--accent)" />
        <button @click="gameStore.sidebarOpen = !gameStore.sidebarOpen" :style="{
          appearance: 'none', background: 'transparent',
          border: '1px solid var(--border)', color: 'var(--text-2)',
          width: '28px', height: '28px', cursor: 'pointer',
          display: 'grid', placeItems: 'center', fontSize: '14px', flexShrink: 0,
        }">{{ gameStore.sidebarOpen ? '‹' : '›' }}</button>
      </div>

      <template v-if="gameStore.sidebarOpen">
        <!-- User card -->
        <div :style="{
          background: 'var(--bg-1)', border: '1px solid var(--border)',
          padding: '12px', display: 'flex', alignItems: 'center', gap: '10px',
        }">
          <div style="width:36px;height:36px;background:var(--bg-3);display:grid;place-items:center">
            <PixelAvatar :scale="1.6" v-bind="avatarProps" :shadow="false" />
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              {{ characterStore.name || 'Convidado' }}
            </div>
            <div style="font-size:10px;color:var(--ok);font-family:var(--f-mono);letter-spacing:0.1em;text-transform:uppercase">
              ● focado
            </div>
          </div>
        </div>

        <!-- Worlds nav -->
        <div style="display:flex;flex-direction:column;gap:4px">
          <div style="font-size:10px;letter-spacing:0.18em;color:var(--text-3);text-transform:uppercase;font-weight:600;padding:4px 6px">
            Mundos
          </div>
          <button
            v-for="(theme, id) in MAP_THEMES"
            :key="id"
            @click="gameStore.activeMap = id as 'studio' | 'athenaeum' | 'agora'"
            :style="{
              appearance: 'none', textAlign: 'left',
              background: gameStore.activeMap === id ? 'rgba(124,58,237,0.12)' : 'transparent',
              border: gameStore.activeMap === id ? '1px solid rgba(124,58,237,0.32)' : '1px solid transparent',
              color: gameStore.activeMap === id ? 'var(--text)' : 'var(--text-2)',
              padding: '8px 10px', fontSize: '13px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '10px',
              fontFamily: 'inherit',
            }"
          >
            <span style="flex:1">{{ theme.name }}</span>
            <span v-if="gameStore.activeMap === id" style="font-size:9px;color:var(--accent);letter-spacing:0.16em;text-transform:uppercase;font-weight:700">atual</span>
          </button>
        </div>

        <!-- User actions -->
        <div style="display:flex;flex-direction:column;gap:4px">
          <div style="font-size:10px;letter-spacing:0.18em;color:var(--text-3);text-transform:uppercase;font-weight:600;padding:4px 6px">Você</div>
          <button class="k-btn k-btn-ghost" @click="router.push('/character')" style="width:100%;justify-content:flex-start">Editar avatar</button>
          <button class="k-btn k-btn-ghost" @click="router.push('/feedback')" style="width:100%;justify-content:flex-start">Feedback / Reportar bug</button>
          <button class="k-btn k-btn-ghost" @click="router.push('/login')" style="width:100%;justify-content:flex-start">Sair</button>
        </div>

        <!-- Tip -->
        <div :style="{
          marginTop: 'auto', padding: '12px',
          background: 'rgba(124,58,237,0.08)',
          border: '1px dashed rgba(124,58,237,0.3)',
          fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.5,
        }">
          <strong style="color:var(--primary-hi);font-size:10px;letter-spacing:0.16em;text-transform:uppercase;display:block;margin-bottom:4px">
            dica do Kairos
          </strong>
          Aproxime-se da Sala de Servidores para conversar com seu Agente IA.
        </div>
      </template>

      <template v-else>
        <div style="display:flex;flex-direction:column;gap:8px;align-items:center">
          <button
            v-for="(theme, id) in MAP_THEMES"
            :key="id"
            @click="gameStore.activeMap = id as 'studio' | 'athenaeum' | 'agora'"
            :title="theme.name"
            :style="{
              appearance: 'none', width: '36px', height: '36px',
              background: gameStore.activeMap === id ? 'var(--bg-3)' : 'transparent',
              border: gameStore.activeMap === id ? '1px solid var(--primary-hi)' : '1px solid var(--border)',
              display: 'grid', placeItems: 'center', cursor: 'pointer', fontSize: '12px', color: 'var(--text-2)',
            }">{{ id === 'studio' ? '🖥' : id === 'athenaeum' ? '📚' : '🌿' }}</button>
        </div>
      </template>
    </aside>

    <!-- Game stage -->
    <div ref="stageRef" :style="{
      position: 'relative', overflow: 'hidden',
      background: `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.2), rgba(0,0,0,0.7) 80%), ${currentTheme.wall}`,
      display: 'grid', placeItems: 'center',
    }">
      <!-- Map -->
      <div :style="{
        width: MAP_W * TILE + 'px', height: MAP_H * TILE + 'px',
        position: 'relative',
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        imageRendering: 'pixelated',
      }">
        <!-- Floor SVG -->
        <svg
          :width="MAP_W * TILE"
          :height="MAP_H * TILE"
          :viewBox="`0 0 ${MAP_W * TILE} ${MAP_H * TILE}`"
          class="pixelated"
          style="position:absolute;inset:0"
        >
          <rect
            v-for="tile in allTiles"
            :key="`${tile.x}-${tile.y}`"
            :x="tile.x * TILE"
            :y="tile.y * TILE"
            :width="TILE"
            :height="TILE"
            :fill="tile.isWall ? currentTheme.wall : currentTheme.floor[(tile.x + tile.y) % 2]"
          />
          <rect x="0" y="0" :width="MAP_W * TILE" :height="TILE / 2" :fill="currentTheme.wallTop" />
          <!-- decor -->
          <rect
            v-for="(d, i) in currentTheme.decor"
            :key="i"
            :x="d.x * TILE"
            :y="d.y * TILE"
            :width="d.w * TILE"
            :height="d.h * TILE"
            :fill="d.color"
          />
          <!-- grid lines -->
          <g :stroke="currentTheme.floorTrim" stroke-width="1" opacity="0.6">
            <line v-for="i in MAP_W + 1" :key="`v${i}`" :x1="(i-1) * TILE" :y1="TILE" :x2="(i-1) * TILE" :y2="(MAP_H - 1) * TILE" />
            <line v-for="i in MAP_H + 1" :key="`h${i}`" :x1="TILE" :y1="(i-1) * TILE" :x2="(MAP_W - 1) * TILE" :y2="(i-1) * TILE" />
          </g>
        </svg>

        <!-- Zone objects -->
        <div
          v-for="zone in MAP_ZONES"
          :key="zone.id"
          :style="{
            position: 'absolute',
            left: zone.x * TILE + 'px', top: zone.y * TILE + 'px',
            width: zone.w * TILE + 'px', height: zone.h * TILE + 'px',
            zIndex: 2,
          }"
          :class="activeZone?.id === zone.id ? `glow-${zone.glow}` : ''"
        >
          <svg :width="zone.w * TILE" :height="zone.h * TILE"
            :viewBox="`0 0 ${zone.w * TILE} ${zone.h * TILE}`" class="pixelated">
            <!-- Desk -->
            <g v-if="zone.id === 'desk'">
              <rect x="4" y="20" width="120" height="34" fill="#3a2a1a" />
              <rect x="4" y="20" width="120" height="4" fill="#52391f" />
              <rect x="44" y="0" width="40" height="22" fill="#0a0a10" />
              <rect x="46" y="2" width="36" height="16" :fill="activeZone?.id === 'desk' ? '#22d3ee' : '#a78bfa'" />
              <rect x="60" y="22" width="8" height="4" fill="#0a0a10" />
              <rect x="46" y="38" width="36" height="6" fill="#15151f" />
            </g>
            <!-- Board -->
            <g v-else-if="zone.id === 'board'">
              <rect x="0" y="0" width="160" height="28" fill="#0a0a10" />
              <rect x="2" y="4" width="156" height="20" fill="#15151f" />
              <rect x="8" y="9" width="20" height="2" :fill="activeZone?.id === 'board' ? '#22d3ee' : '#a78bfa'" />
              <rect x="32" y="9" width="14" height="2" :fill="activeZone?.id === 'board' ? '#22d3ee' : '#a78bfa'" />
            </g>
            <!-- Jukebox -->
            <g v-else-if="zone.id === 'jukebox'">
              <rect x="6" y="6" width="52" height="58" fill="#3a1a1a" />
              <rect x="10" y="14" width="44" height="22" fill="#0a0a10" />
              <circle cx="32" cy="25" r="9" fill="#0a0a10" />
              <circle cx="32" cy="25" r="3" :fill="activeZone?.id === 'jukebox' ? '#fbbf24' : '#fb923c'" />
            </g>
            <!-- Servers -->
            <g v-else-if="zone.id === 'servers'">
              <rect x="0" y="0" width="128" height="60" fill="#0a0a10" />
              <rect x="8" y="6" width="22" height="50" fill="#15151f" />
              <rect x="34" y="6" width="22" height="50" fill="#15151f" />
              <rect x="60" y="6" width="22" height="50" fill="#15151f" />
              <g v-for="i in 6" :key="i">
                <rect :x="25" :y="9 + (i-1) * 8" width="2" height="2" :fill="activeZone?.id === 'servers' ? '#fbbf24' : '#34d399'" />
              </g>
              <!-- NPC -->
              <rect x="100" y="30" width="8" height="6" fill="#e8b894" />
              <rect x="99" y="29" width="10" height="2" fill="#1565c0" />
              <rect x="98" y="36" width="12" height="8" fill="#22d3ee" />
            </g>
            <!-- Shelf -->
            <g v-else-if="zone.id === 'shelf'">
              <rect x="0" y="0" width="128" height="62" fill="#3a2a1a" />
              <rect x="0" y="20" width="128" height="3" fill="#1a1306" />
              <rect
                v-for="i in 11"
                :key="i"
                :x="4 + (i-1) * 11"
                y="4"
                width="9"
                height="16"
                :fill="(['#7c3aed','#fbbf24','#22d3ee','#34d399','#f87171','#a78bfa','#fb923c'])[(i-1) % 7]"
              />
            </g>
          </svg>
        </div>

        <!-- Avatares remotos (outros usuários) -->
        <div
          v-for="peer in remotePlayers.values()"
          :key="peer.id"
          :style="{
            position: 'absolute',
            left: peer.x * TILE + 'px', top: peer.y * TILE + 'px',
            transform: 'translate(-50%, -90%)',
            zIndex: 4, pointerEvents: 'none',
            transition: 'left 0.12s linear, top 0.12s linear',
          }"
        >
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
            <span :style="{
              fontSize: '9px', fontWeight: 600, color: 'var(--text)',
              background: 'rgba(13,13,20,0.82)', border: '1px solid var(--border)',
              padding: '1px 5px', whiteSpace: 'nowrap', letterSpacing: '0.02em',
            }">{{ peer.name }}</span>
            <div style="filter:drop-shadow(0 4px 0 rgba(34,211,238,0.4))">
              <PixelAvatar :scale="3" v-bind="peer.avatar" :shadow="true" :bobbing="true" />
            </div>
          </div>
        </div>

        <!-- Avatar -->
        <div :style="{
          position: 'absolute',
          left: avatarX * TILE + 'px', top: avatarY * TILE + 'px',
          transform: 'translate(-50%, -90%)',
          zIndex: 5, pointerEvents: 'none',
          transition: 'left 0.06s linear, top 0.06s linear',
        }">
          <div style="filter:drop-shadow(0 4px 0 rgba(124,58,237,0.4))">
            <PixelAvatar :scale="3" v-bind="avatarProps" :shadow="true" :bobbing="true" />
          </div>
        </div>

        <!-- Zone prompt [E] -->
        <div v-if="activeZone" :style="{
          position: 'absolute',
          left: (activeZone.x + activeZone.w / 2) * TILE + 'px',
          top: activeZone.y * TILE - 4 + 'px',
          transform: 'translate(-50%, -100%)',
          zIndex: 6, pointerEvents: 'none',
        }">
          <div :style="{
            background: 'rgba(13,13,20,0.92)', border: '1px solid var(--accent)',
            padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: '8px',
            boxShadow: '0 4px 18px rgba(0,0,0,0.5), 0 0 24px rgba(251,191,36,0.25)',
            whiteSpace: 'nowrap',
          }">
            <span class="k-key">E</span>
            <span style="font-size:11px;color:var(--text);font-weight:500;letter-spacing:0.04em">{{ activeZone.action }}</span>
          </div>
        </div>
      </div>

      <!-- HUD top-left -->
      <div :style="{
        position: 'absolute', top: '16px', left: '16px',
        display: 'inline-flex', alignItems: 'center', gap: '10px',
        background: 'rgba(13,13,20,0.78)', border: '1px solid var(--border-strong)',
        backdropFilter: 'blur(10px)', padding: '8px 12px 8px 8px', zIndex: 10,
      }">
        <div style="width:36px;height:36px;background:var(--bg-3);display:grid;place-items:center;overflow:hidden">
          <PixelAvatar :scale="1.6" v-bind="avatarProps" :shadow="false" />
        </div>
        <div style="display:flex;flex-direction:column;line-height:1.1">
          <span style="font-size:13px;font-weight:600;letter-spacing:0.02em">{{ characterStore.name || 'Convidado' }}</span>
          <span style="font-size:10px;color:var(--text-3);font-family:var(--f-mono);letter-spacing:0.12em;text-transform:uppercase">
            ● online · {{ currentTheme.name }}
          </span>
        </div>
      </div>

      <!-- HUD top-right clock -->
      <div :style="{
        position: 'absolute', top: '16px', right: '16px',
        display: 'inline-flex', alignItems: 'center', gap: '10px',
        background: 'rgba(13,13,20,0.78)', border: '1px solid var(--border-strong)',
        backdropFilter: 'blur(10px)', padding: '8px 12px',
        fontFamily: 'var(--f-mono)', fontSize: '12px', letterSpacing: '0.08em', zIndex: 10,
      }">
        <span style="color:var(--accent);font-weight:600">{{ clockTime }}</span>
        <span style="color:var(--text-4)">·</span>
        <span style="color:var(--text-3)">foco: {{ focusTime }}</span>
      </div>

      <!-- HUD bottom controls -->
      <div :style="{
        position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
        display: 'inline-flex', alignItems: 'center', gap: '14px',
        background: 'rgba(13,13,20,0.78)', border: '1px solid var(--border-strong)',
        backdropFilter: 'blur(10px)', padding: '8px 14px',
        fontSize: '11px', color: 'var(--text-2)', letterSpacing: '0.06em', zIndex: 10,
      }">
        <span style="display:inline-flex;gap:6px;align-items:center">
          <span class="k-key">W</span><span class="k-key">A</span><span class="k-key">S</span><span class="k-key">D</span>
          <span style="color:var(--text-3)">mover</span>
        </span>
        <span style="color:var(--text-4)">·</span>
        <span style="display:inline-flex;gap:6px;align-items:center">
          <span class="k-key">E</span><span style="color:var(--text-3)">interagir</span>
        </span>
      </div>

      <!-- Modal de zona (E) -->
      <div
        v-if="gameStore.isModalOpen && activeModal"
        :style="{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(6px)',
          display: 'grid', placeItems: 'center', zIndex: 50, padding: '24px',
        }"
        @click="gameStore.isModalOpen = false"
      >
        <div
          class="k-card"
          :style="{ padding: '28px', width: 'min(560px, 100%)', display: 'flex', flexDirection: 'column', gap: '16px' }"
          @click.stop
        >
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span class="k-chip">interação</span>
            <button class="k-btn k-btn-ghost" style="padding:6px 10px" @click="gameStore.isModalOpen = false">esc ✕</button>
          </div>
          <div>
            <h2 style="margin:0 0 6px;font-size:24px;font-weight:600;letter-spacing:-0.02em">{{ activeModal.name }}</h2>
            <p style="margin:0;color:var(--text-3);font-size:14px">{{ activeModal.action }}</p>
          </div>

          <!-- desk -->
          <div v-if="activeModal.id === 'desk'" :style="{ background: 'var(--bg-1)', padding: '14px', fontFamily: 'var(--f-mono)', fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.6 }">
            <div style="color:var(--accent)">tarefas de hoje · 3</div>
            <div>☐ Revisar PR do front (Quasar)</div>
            <div>☐ Subir build do agente IA</div>
            <div>☐ Reunião 15:00 — design review</div>
          </div>

          <!-- servers / NPC -->
          <div v-else-if="activeModal.id === 'servers'" style="display:flex;flex-direction:column;gap:8px">
            <div :style="{ background: 'var(--bg-1)', padding: '14px', fontSize: '13px', color: 'var(--text-2)' }">
              <strong style="color:var(--primary-hi)">Hesíodo · agente IA</strong>
              <p style="margin:6px 0 0">Olá, {{ characterStore.name || 'viajante' }}. Tenho 3 sugestões pra otimizar seu dia. Quer ouvir?</p>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <span class="k-chip">resumir e-mails</span>
              <span class="k-chip">organizar tasks</span>
              <span class="k-chip">agendar foco</span>
            </div>
          </div>

          <!-- board -->
          <div v-else-if="activeModal.id === 'board'" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
            <div
              v-for="(c, i) in ['#fbbf24','#34d399','#22d3ee','#f87171','#a78bfa','#fb923c']"
              :key="i"
              :style="{ background: c, color: '#0a0a10', padding: '10px', fontSize: '12px', fontWeight: 600, minHeight: '70px' }"
            >
              note #{{ i + 1 }}
            </div>
          </div>

          <!-- jukebox -->
          <div v-else-if="activeModal.id === 'jukebox'" style="display:flex;flex-direction:column;gap:6px;font-size:13px">
            <div
              v-for="(n, i) in ['lo-fi · synthwave coding','deep focus · ambient','greek strings · classic','8bit chip · retro']"
              :key="i"
              :style="{
                background: i === 0 ? 'rgba(124,58,237,0.14)' : 'var(--bg-1)',
                border: '1px solid var(--border)', padding: '10px',
                display: 'flex', justifyContent: 'space-between',
              }"
            >
              <span style="color:var(--text-2)">{{ n }}</span>
              <span :style="{ color: i === 0 ? 'var(--accent)' : 'var(--text-4)', fontFamily: 'var(--f-mono)', fontSize: '11px' }">{{ i === 0 ? '▶ tocando' : 'play' }}</span>
            </div>
          </div>

          <!-- shelf -->
          <div v-else-if="activeModal.id === 'shelf'" style="display:flex;flex-direction:column;gap:6px;font-size:13px">
            <div
              v-for="n in ['📓 Diário de hoje','📕 Ideias para Kairos','📗 Snippets de código','📘 Livros de cabeceira']"
              :key="n"
              :style="{ background: 'var(--bg-1)', border: '1px solid var(--border)', padding: '10px', color: 'var(--text-2)' }"
            >
              {{ n }}
            </div>
          </div>

          <div style="display:flex;gap:10px;justify-content:flex-end">
            <button class="k-btn k-btn-ghost" @click="gameStore.isModalOpen = false">Fechar</button>
            <button class="k-btn k-btn-primary" @click="gameStore.isModalOpen = false">Continuar →</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/useGameStore'
import { useCharacterStore } from '@/stores/useCharacterStore'
import { MAP_THEMES, MAP_ZONES, MAP_W, MAP_H, TILE, type MapZone } from '@/game/constants'
import { useAvatarController } from '@/game/useAvatarController'
import {
  connectPresence,
  disconnectPresence,
  emitMove,
  switchMap,
  remotePlayers,
} from '@/services/presence'
import PixelAvatar from '@/components/pixel/PixelAvatar.vue'
import PixelK from '@/components/pixel/PixelK.vue'
import Logo from '@/components/logos/Logo.vue'

const router = useRouter()
const gameStore = useGameStore()
const characterStore = useCharacterStore()

const stageRef = ref<HTMLElement | null>(null)
const scale = ref(1)
const activeModal = ref<MapZone | null>(null)

const { x: avatarX, y: avatarY, activeZone } = useAvatarController(
  gameStore.playerX,
  gameStore.playerY,
)

const avatarProps = computed(() => ({
  hairStyle: characterStore.hairStyle,
  hairColor: characterStore.hairColor,
  skin: characterStore.skin,
  topColor: characterStore.topColor,
  pantsColor: characterStore.pantsColor,
}))

const currentTheme = computed(() => MAP_THEMES[gameStore.activeMap] ?? MAP_THEMES.studio)

// Presença multiusuário — outros avatares no mesmo mapa, em tempo real
const playerName = computed(() => characterStore.name || 'Convidado')

onMounted(() => {
  connectPresence({
    name: playerName.value,
    avatar: avatarProps.value,
    map: gameStore.activeMap,
    x: avatarX.value,
    y: avatarY.value,
  })
})
onUnmounted(() => disconnectPresence())

// Emite a própria posição ao mover (throttle no serviço)
watch([avatarX, avatarY], ([x, y]) => emitMove(x, y))

// Troca de mundo = troca de sala
watch(() => gameStore.activeMap, (map) => switchMap(map))

const allTiles = computed(() =>
  Array.from({ length: MAP_H }, (_, y) =>
    Array.from({ length: MAP_W }, (_, x) => ({
      x, y, isWall: x === 0 || x === MAP_W - 1 || y === 0 || y === MAP_H - 1,
    }))
  ).flat()
)

// Clock
const clockTime = ref('')
const focusStart = Date.now()
const focusTime = ref('0h 0m')

function updateClock() {
  const now = new Date()
  clockTime.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const elapsed = Math.floor((Date.now() - focusStart) / 60000)
  focusTime.value = `${Math.floor(elapsed / 60)}h ${elapsed % 60}m`
}
updateClock()
const clockInterval = setInterval(updateClock, 30000)
onUnmounted(() => clearInterval(clockInterval))

// Scale to fit stage
function computeScale() {
  const el = stageRef.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const sx = (r.width - 32) / (MAP_W * TILE)
  const sy = (r.height - 32) / (MAP_H * TILE)
  scale.value = Math.min(sx, sy, 1.4)
}
onMounted(() => {
  computeScale()
  const ro = new ResizeObserver(computeScale)
  if (stageRef.value) ro.observe(stageRef.value)
  onUnmounted(() => ro.disconnect())
})

// Watch sidebar to recompute scale
watch(() => gameStore.sidebarOpen, () => setTimeout(computeScale, 300))

// E key → open modal
function onKeyDown(e: KeyboardEvent) {
  if (e.key.toLowerCase() === 'e' && activeZone.value && !gameStore.isModalOpen) {
    activeModal.value = activeZone.value
    gameStore.isModalOpen = true
  }
  if (e.key === 'Escape') {
    gameStore.isModalOpen = false
  }
}
window.addEventListener('keydown', onKeyDown)
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
</script>
