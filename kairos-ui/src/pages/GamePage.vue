<template>
  <div :style="{
    height: '100vh', display: 'grid',
    gridTemplateColumns: gameStore.sidebarOpen ? '256px 1fr' : '56px 1fr',
    background: 'var(--bg-0)', overflow: 'hidden', transition: 'grid-template-columns 0.25s ease',
  }">
    <!-- Sidebar -->
    <aside :style="{
      background: 'var(--bg-2)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', gap: '14px',
      padding: gameStore.sidebarOpen ? '16px' : '8px', overflow: 'hidden',
    }">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
        <Logo v-if="gameStore.sidebarOpen" :id="'monogram'" size="sm" primary="var(--primary-hi)" accent="var(--accent)" />
        <button @click="gameStore.sidebarOpen = !gameStore.sidebarOpen" :style="{
          appearance: 'none', background: 'transparent', border: '1px solid var(--border)',
          color: 'var(--text-2)', width: '28px', height: '28px', cursor: 'pointer',
          display: 'grid', placeItems: 'center', fontSize: '14px', flexShrink: 0,
        }">{{ gameStore.sidebarOpen ? '‹' : '›' }}</button>
      </div>

      <template v-if="gameStore.sidebarOpen">
        <!-- User card -->
        <div style="background:var(--bg-1);border:1px solid var(--border);padding:12px;display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;background:var(--bg-3);display:grid;place-items:center">
            <PixelAvatar :scale="1.6" v-bind="look" :shadow="false" />
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ playerName }}</div>
            <div style="font-size:10px;color:var(--ok);font-family:var(--f-mono);letter-spacing:0.1em;text-transform:uppercase">● online · {{ online }}</div>
          </div>
        </div>

        <!-- Mundos (vindos do banco) -->
        <div style="display:flex;flex-direction:column;gap:4px">
          <div style="font-size:10px;letter-spacing:0.18em;color:var(--text-3);text-transform:uppercase;font-weight:600;padding:4px 6px">Mundos</div>
          <button
            v-for="m in maps" :key="m.id" @click="selectMap(m.id)"
            :style="{
              appearance: 'none', textAlign: 'left',
              background: currentId === m.id ? 'rgba(124,58,237,0.12)' : 'transparent',
              border: currentId === m.id ? '1px solid rgba(124,58,237,0.32)' : '1px solid transparent',
              color: currentId === m.id ? 'var(--text)' : 'var(--text-2)',
              padding: '8px 10px', fontSize: '13px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'inherit',
            }">
            <span style="flex:1">{{ m.name }}</span>
            <span v-if="currentId === m.id" style="font-size:9px;color:var(--accent);letter-spacing:0.16em;text-transform:uppercase;font-weight:700">atual</span>
          </button>
        </div>

        <!-- Você -->
        <div style="display:flex;flex-direction:column;gap:4px">
          <div style="font-size:10px;letter-spacing:0.18em;color:var(--text-3);text-transform:uppercase;font-weight:600;padding:4px 6px">Você</div>
          <button class="k-btn k-btn-ghost" @click="router.push('/character')" style="width:100%;justify-content:flex-start">Editar avatar</button>
          <button class="k-btn k-btn-ghost" @click="router.push('/feedback')" style="width:100%;justify-content:flex-start">Feedback / Reportar bug</button>
          <button class="k-btn k-btn-ghost" @click="leave" style="width:100%;justify-content:flex-start">Sair</button>
        </div>
      </template>
    </aside>

    <!-- Stage (PixiJS) -->
    <div style="position:relative;overflow:hidden;background:var(--bg-0)">
      <div ref="host" style="position:absolute;inset:0"></div>

      <!-- HUD top-left -->
      <div style="position:absolute;top:16px;left:16px;display:inline-flex;align-items:center;gap:10px;background:rgba(13,13,20,0.78);border:1px solid var(--border-strong);backdrop-filter:blur(10px);padding:8px 12px 8px 8px;z-index:10">
        <div style="width:36px;height:36px;background:var(--bg-3);display:grid;place-items:center;overflow:hidden">
          <PixelAvatar :scale="1.6" v-bind="look" :shadow="false" />
        </div>
        <div style="display:flex;flex-direction:column;line-height:1.1">
          <span style="font-size:13px;font-weight:600">{{ playerName }}</span>
          <span style="font-size:10px;color:var(--text-3);font-family:var(--f-mono);letter-spacing:0.12em;text-transform:uppercase">● {{ currentMap?.name || '…' }}</span>
        </div>
      </div>

      <!-- HUD top-right -->
      <div style="position:absolute;top:16px;right:16px;display:inline-flex;align-items:center;gap:10px;background:rgba(13,13,20,0.78);border:1px solid var(--border-strong);backdrop-filter:blur(10px);padding:8px 12px;font-family:var(--f-mono);font-size:12px;letter-spacing:0.08em;z-index:10">
        <span style="color:var(--accent);font-weight:600">{{ online }} online</span>
      </div>

      <!-- HUD bottom -->
      <div style="position:absolute;bottom:16px;left:50%;transform:translateX(-50%);display:inline-flex;align-items:center;gap:14px;background:rgba(13,13,20,0.78);border:1px solid var(--border-strong);backdrop-filter:blur(10px);padding:8px 14px;font-size:11px;color:var(--text-2);letter-spacing:0.06em;z-index:10">
        <span style="display:inline-flex;gap:6px;align-items:center"><span class="k-key">W</span><span class="k-key">A</span><span class="k-key">S</span><span class="k-key">D</span><span style="color:var(--text-3)">mover</span></span>
        <span style="color:var(--text-4)">·</span>
        <span style="display:inline-flex;gap:6px;align-items:center"><span class="k-key">B</span><span style="color:var(--text-3)">dançar</span></span>
        <template v-if="activeZone">
          <span style="color:var(--text-4)">·</span>
          <span style="display:inline-flex;gap:6px;align-items:center"><span class="k-key">E</span><span style="color:var(--accent)">{{ activeZone.action }}</span></span>
        </template>
      </div>

      <!-- Modal de interação -->
      <div v-if="gameStore.isModalOpen && activeModal" style="position:absolute;inset:0;background:rgba(0,0,0,0.62);backdrop-filter:blur(6px);display:grid;place-items:center;z-index:50;padding:24px" @click="closeModal">
        <div class="k-card" style="padding:28px;width:min(520px,100%);display:flex;flex-direction:column;gap:14px" @click.stop>
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span class="k-chip">interação</span>
            <button class="k-btn k-btn-ghost" style="padding:6px 10px" @click="closeModal">esc ✕</button>
          </div>
          <div>
            <h2 style="margin:0 0 6px;font-size:24px;font-weight:600;letter-spacing:-0.02em">{{ activeModal.name }}</h2>
            <p style="margin:0;color:var(--text-3);font-size:14px">{{ activeModal.action }}</p>
          </div>
          <div style="background:var(--bg-1);border:1px solid var(--border);padding:16px;font-size:13px;color:var(--text-2);line-height:1.6">
            Em breve. Esta estação será conectada à sua ferramenta ({{ activeModal.kind }}).
          </div>
        </div>
      </div>

      <div v-if="error" style="position:absolute;top:60px;left:50%;transform:translateX(-50%);color:#f87171;font-size:13px;z-index:10">{{ error }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/useGameStore'
import { useCharacterStore } from '@/stores/useCharacterStore'
import { MapScene } from '@/game/pixi/scene'
import { AvatarPuppet, type AvatarLook, type Facing } from '@/game/pixi/avatar'
import { isSolid, interactableObjects, type MapDef, type MapObject } from '@/game/maps'
import { fetchMaps } from '@/services/maps.api'
import { connectPresence, disconnectPresence, emitMove, switchMap, remotePlayers } from '@/services/presence'
import PixelAvatar from '@/components/pixel/PixelAvatar.vue'
import Logo from '@/components/logos/Logo.vue'

const router = useRouter()
const gameStore = useGameStore()
const characterStore = useCharacterStore()

const host = ref<HTMLElement | null>(null)
const maps = ref<MapDef[]>([])
const currentId = ref('')
const error = ref('')
const activeZone = ref<MapObject | null>(null)
const activeModal = ref<MapObject | null>(null)

const look = computed<AvatarLook>(() => ({
  hairStyle: characterStore.hairStyle,
  hairColor: characterStore.hairColor,
  skin: characterStore.skin,
  topColor: characterStore.topColor,
  pantsColor: characterStore.pantsColor,
}))
const playerName = computed(() => characterStore.name || 'Convidado')
const online = computed(() => remotePlayers.size + 1)
const currentMap = computed(() => maps.value.find((m) => m.id === currentId.value))

let scene: MapScene | null = null
const pos = reactive({ x: 11, y: 9 })
let facing: Facing = 'down'
let dancing = false
const keys = new Set<string>()
const lastSent = { facing: 'down' as Facing, pose: 'idle' as 'idle' | 'walk' | 'dance' }
// ids dos avatares remotos presentes na cena
const peerIds = new Set<string>()

function onKeyDown(e: KeyboardEvent) {
  const k = e.key.toLowerCase()
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'e', 'b', 'escape'].includes(k)) e.preventDefault()
  if (k === 'e') { tryInteract(); return }
  if (k === 'b') { dancing = !dancing; return }
  if (k === 'escape') { closeModal(); return }
  keys.add(k)
}
function onKeyUp(e: KeyboardEvent) { keys.delete(e.key.toLowerCase()) }

function tryInteract() {
  if (activeZone.value && !gameStore.isModalOpen) {
    activeModal.value = activeZone.value
    gameStore.isModalOpen = true
  }
}
function closeModal() {
  gameStore.isModalOpen = false
  activeModal.value = null
}

function selectMap(id: string) {
  const map = maps.value.find((m) => m.id === id)
  if (!scene || !map) return
  currentId.value = id
  gameStore.activeMap = id
  scene.setMap(map)
  pos.x = map.spawn.x
  pos.y = map.spawn.y
  switchMap(id)
}

function detectZone(map: MapDef) {
  let nearest: MapObject | null = null
  let best = 2.6
  for (const o of interactableObjects(map)) {
    const cx = o.x + o.w / 2
    const cy = o.y + o.h / 2
    const d = Math.hypot(cx - pos.x, cy - pos.y)
    if (d < best) { best = d; nearest = o }
  }
  activeZone.value = nearest
}

onMounted(async () => {
  scene = new MapScene()
  await scene.init(host.value!)
  scene.addAvatar('me', new AvatarPuppet(look.value))

  try {
    maps.value = await fetchMaps()
    const first = maps.value.find((m) => m.id === gameStore.activeMap) || maps.value[0]
    if (!first) { error.value = 'Nenhum mundo disponível'; return }
    selectMap(first.id)
    connectPresence({ name: playerName.value, avatar: look.value, map: first.id, x: pos.x, y: pos.y })
  } catch (e) {
    error.value = (e as Error).message
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  scene.app.ticker.add((ticker) => {
    if (!scene) return
    const map = currentMap.value
    if (!map) return
    const dt = Math.min(ticker.deltaMS / 1000, 0.05)

    // ---- movimento local (com colisão) ----
    let dx = 0, dy = 0
    if (!gameStore.isModalOpen) {
      const sp = 5 * dt
      if (keys.has('w') || keys.has('arrowup')) dy -= sp
      if (keys.has('s') || keys.has('arrowdown')) dy += sp
      if (keys.has('a') || keys.has('arrowleft')) dx -= sp
      if (keys.has('d') || keys.has('arrowright')) dx += sp
    }
    const moving = dx !== 0 || dy !== 0
    if (moving) {
      if (!isSolid(map, Math.floor(pos.x + dx), Math.floor(pos.y))) pos.x += dx
      if (!isSolid(map, Math.floor(pos.x), Math.floor(pos.y + dy))) pos.y += dy
      facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down')
    }
    const pose: 'idle' | 'walk' | 'dance' = dancing ? 'dance' : moving ? 'walk' : 'idle'
    // emite estado quando se move ou quando pose/direção mudam (dança parado conta)
    if (moving || pose !== lastSent.pose || facing !== lastSent.facing) {
      emitMove(pos.x, pos.y, facing, pose)
      lastSent.pose = pose
      lastSent.facing = facing
    }
    detectZone(map)

    const me = scene.avatar('me')
    if (me) {
      me.setFacing(facing)
      me.setPose(pose)
      me.update(dt)
    }
    scene.placeAvatar('me', pos.x, pos.y)
    scene.follow(pos.x, pos.y)

    // ---- avatares remotos ----
    syncRemotes(dt, map)
    scene.sortAvatars()
  })
})

function syncRemotes(dt: number, map: MapDef) {
  if (!scene) return
  const seen = new Set<string>()
  for (const peer of remotePlayers.values()) {
    if (peer.map && peer.map !== map.id) continue
    seen.add(peer.id)
    let p = scene.avatar(peer.id)
    if (!p) {
      p = new AvatarPuppet(peer.avatar as AvatarLook)
      scene.addAvatar(peer.id, p)
      peerIds.add(peer.id)
    }
    // pose e direção agora vêm sincronizadas da rede
    p.setFacing(peer.facing || 'down')
    p.setPose(peer.pose || 'idle')
    p.update(dt)
    scene.placeAvatar(peer.id, peer.x, peer.y)
  }
  // remove quem saiu / mudou de mapa
  for (const id of [...peerIds]) {
    if (!seen.has(id)) { scene.removeAvatar(id); peerIds.delete(id) }
  }
}

function leave() {
  disconnectPresence()
  router.push('/login')
}

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  disconnectPresence()
  scene?.destroy()
  scene = null
})
</script>
