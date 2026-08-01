<template>
  <div class="lp">
    <div class="lp-edge"><MeanderBorder :height="12" :opacity="0.55" /></div>

    <main class="lp-main">
      <section class="lp-pitch">
        <Logo id="monogram" size="lg" primary="var(--primary-hi)" accent="var(--accent)" />
        <h1>O espaço da sua galera,<br />em pixel art.</h1>
        <p class="lp-sub">
          Um mundo 2D onde vocês aparecem juntos: cada um com seu avatar, andando pelo
          mapa e conversando por <strong>texto e voz com quem está perto</strong>.
        </p>

        <div class="lp-cta">
          <button class="k-btn k-btn-primary lp-enter" @click="entrar">Entrar no Kairos →</button>
          <span class="lp-note">Grátis. Crie uma conta ou entre como convidado.</span>
        </div>

        <ul class="lp-facts">
          <li v-for="f in facts" :key="f.icon">
            <span class="lp-fact-icon"><PixelIcon :name="f.icon" size="0.875rem" /></span>
            <span>{{ f.text }}</span>
          </li>
        </ul>
      </section>

      <section class="lp-scene" aria-label="Amostra de um mundo do Kairos">
        <svg class="pixelated lp-scene-map" viewBox="0 0 160 100" preserveAspectRatio="none">
          <rect x="0" y="0" width="160" height="100" fill="var(--bg-2)" />
          <rect
            v-for="t in floorTiles" :key="`${t.x}-${t.y}`"
            :x="t.x * 10" :y="t.y * 10" width="10" height="10" fill="var(--bg-3)"
          />
          <rect x="0" y="0" width="160" height="16" fill="var(--bg-4)" />
          <rect x="0" y="16" width="160" height="2" fill="var(--primary-lo)" />
          <rect x="18" y="3" width="28" height="11" fill="var(--bg-1)" />
          <rect x="20" y="5" width="24" height="2" fill="var(--primary-hi)" />
          <rect x="20" y="9" width="16" height="2" fill="var(--primary-hi)" />
          <rect x="110" y="3" width="20" height="11" fill="var(--bg-1)" />
          <rect x="113" y="6" width="14" height="5" fill="var(--accent-lo)" />
          <rect x="46" y="52" width="68" height="34" fill="var(--primary-lo)" />
          <rect x="52" y="58" width="56" height="22" fill="var(--bg-2)" />
          <rect x="22" y="34" width="34" height="14" fill="var(--accent-lo)" />
          <rect x="22" y="34" width="34" height="4" fill="var(--accent)" />
          <rect x="26" y="48" width="4" height="8" fill="var(--accent-lo)" />
          <rect x="48" y="48" width="4" height="8" fill="var(--accent-lo)" />
          <rect x="126" y="36" width="12" height="12" fill="var(--ok)" />
          <rect x="130" y="48" width="4" height="8" fill="var(--accent-lo)" />
        </svg>

        <span class="lp-who lp-who-a"><PixelAvatar :scale="1.9" hair-style="curly" /></span>
        <span class="lp-who lp-who-b"><PixelAvatar :scale="1.9" hair-style="ponytail" /></span>
        <span class="lp-who lp-who-c"><PixelAvatar :scale="1.9" hair-style="mohawk" /></span>

        <span class="lp-bubble">olá!</span>
      </section>
    </main>

    <footer class="lp-foot">© Kairos 2026</footer>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import Logo from '@/components/logos/Logo.vue'
import MeanderBorder from '@/components/pixel/MeanderBorder.vue'
import PixelAvatar from '@/components/pixel/PixelAvatar.vue'
import PixelIcon from '@/components/PixelIcon.vue'

const router = useRouter()
function entrar() { router.push('/login') }

const facts = [
  { icon: 'users', text: 'Todo mundo no mesmo mapa, ao vivo' },
  { icon: 'mic', text: 'Voz e chat por proximidade' },
  { icon: 'pen-square', text: 'Editor pra criar seus mundos' },
]

const floorTiles = Array.from({ length: 9 }, (_, row) =>
  Array.from({ length: 16 }, (_, col) => ({ x: col, y: row + 1 })),
)
  .flat()
  .filter((t) => (t.x + t.y) % 2 === 0)
</script>

<style scoped>
.lp {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(ellipse at 50% -10%, var(--primary-glow), transparent 55%),
    var(--bg-0);
  color: var(--text);
}

.lp-edge { flex: none; }

.lp-main {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, auto);
  align-items: center;
  justify-content: center;
  gap: 3rem;
  width: min(64rem, 100%);
  margin: 0 auto;
  padding: 2.5rem 1.5rem;
}

.lp-pitch {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.125rem;
  max-width: 32rem;
}

.lp-pitch h1 {
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  line-height: 1.15;
  letter-spacing: -0.03em;
  margin: 0.25rem 0 0;
}

.lp-sub {
  color: var(--text-2);
  font-size: 1rem;
  line-height: 1.6;
  margin: 0;
}

.lp-cta {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  margin-top: 0.25rem;
}

.lp-enter {
  font-size: 0.8125rem;
  padding: 1rem 1.5rem;
}

.lp-note {
  font-size: 0.75rem;
  color: var(--text-3);
}

.lp-facts {
  list-style: none;
  margin: 0.25rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.lp-facts li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--text-3);
}

.lp-fact-icon {
  display: inline-flex;
  color: var(--accent);
}

.lp-scene {
  position: relative;
  width: min(26rem, 100%);
  aspect-ratio: 8 / 5;
  border: var(--ui-border-style);
  border-color: var(--primary-hi);
  box-shadow: var(--ui-shadow);
}

.lp-scene-map {
  display: block;
  width: 100%;
  height: 100%;
}

.lp-who {
  position: absolute;
  transform: translate(-50%, -100%);
}

.lp-who-a { left: 30%; top: 62%; animation: lpBob 1.8s steps(1, end) infinite; }
.lp-who-b { left: 52%; top: 84%; }
.lp-who-c { left: 74%; top: 58%; animation: lpBob 2.4s steps(1, end) infinite 0.6s; }

@keyframes lpBob {
  0%, 100% { transform: translate(-50%, -100%); }
  50% { transform: translate(-50%, calc(-100% - 0.125rem)); }
}

@media (prefers-reduced-motion: reduce) {
  .lp-who { animation: none; }
}

.lp-bubble {
  position: absolute;
  left: 56%;
  top: 60%;
  padding: 0.25rem 0.5rem;
  background: var(--bg-1);
  border: 0.125rem solid var(--primary-hi);
  color: var(--text-2);
  font-family: var(--f-pixel);
  font-size: 0.5rem;
  white-space: nowrap;
}

.lp-foot {
  flex: none;
  text-align: center;
  color: var(--text-4);
  font-size: 0.6875rem;
  padding: 1rem;
}

@media (max-width: 56rem) {
  .lp-main {
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
    gap: 2rem;
    text-align: center;
  }
  .lp-pitch { align-items: center; }
  .lp-facts { align-items: flex-start; }
}
</style>
