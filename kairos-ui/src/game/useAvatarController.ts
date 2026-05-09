import { ref, onMounted, onUnmounted } from 'vue'
import { MAP_W, MAP_H, MAP_ZONES, type MapZone } from './constants'

export function useAvatarController(initialX = 15, initialY = 12) {
  const x = ref(initialX)
  const y = ref(initialY)
  const activeZone = ref<MapZone | null>(null)

  const keys = new Set<string>()
  let rafId = 0

  function onKeyDown(e: KeyboardEvent) {
    const k = e.key.toLowerCase()
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'e', 'escape'].includes(k)) {
      e.preventDefault()
    }
    keys.add(k)
  }

  function onKeyUp(e: KeyboardEvent) {
    keys.delete(e.key.toLowerCase())
  }

  function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v))
  }

  function detectZone() {
    let nearest: MapZone | null = null
    let bestD = 3.5
    for (const z of MAP_ZONES) {
      const cx = z.x + z.w / 2
      const cy = z.y + z.h / 2
      const d = Math.hypot(cx - x.value, cy - y.value)
      if (d < bestD) { bestD = d; nearest = z }
    }
    activeZone.value = nearest
  }

  function tick() {
    const speed = 0.12
    let dx = 0, dy = 0
    if (keys.has('w') || keys.has('arrowup')) dy -= speed
    if (keys.has('s') || keys.has('arrowdown')) dy += speed
    if (keys.has('a') || keys.has('arrowleft')) dx -= speed
    if (keys.has('d') || keys.has('arrowright')) dx += speed
    if (dx || dy) {
      x.value = clamp(x.value + dx, 1, MAP_W - 2)
      y.value = clamp(y.value + dy, 1, MAP_H - 2)
      detectZone()
    }
    rafId = requestAnimationFrame(tick)
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    rafId = requestAnimationFrame(tick)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    cancelAnimationFrame(rafId)
  })

  return { x, y, activeZone, keys }
}
