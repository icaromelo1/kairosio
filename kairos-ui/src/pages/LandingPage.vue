<template>
  <div class="lp">
    <!-- Hero -->
    <header class="lp-hero">
      <Logo id="monogram" size="lg" primary="var(--primary-hi)" accent="var(--accent)" />
      <h1>Seu espaço virtual em pixel art — junte a galera num mundo só.</h1>
      <p class="lp-sub">
        O Kairos é um espaço social estilo Gather.town em pixel art: cada um tem um avatar,
        anda pelos mundos e conversa por <strong>texto e voz por proximidade</strong>. E você
        pode <strong>criar os próprios mundos</strong>.
      </p>
      <div class="lp-cta">
        <button class="lp-btn" @click="entrar">Entrar / Criar conta →</button>
        <span class="lp-free">Aberto a todos — grátis.</span>
      </div>
    </header>

    <!-- O que é -->
    <section class="lp-sec">
      <h2>O que é</h2>
      <p>
        Um espaço virtual multiusuário <strong>por organização/equipe</strong>: você entra com
        seu avatar, vê as outras pessoas em tempo real e interage com quem está perto — como num
        escritório ou praça virtual, mas pixel art e do seu jeito.
      </p>
    </section>

    <!-- Como usar -->
    <section class="lp-sec">
      <h2>Como usar</h2>
      <ol class="lp-steps">
        <li><b>1.</b> Crie uma conta (ou entre como convidado pra experimentar).</li>
        <li><b>2.</b> Crie ou entre numa <b>organização</b> (sua equipe/grupo).</li>
        <li><b>3.</b> Monte seu <b>avatar</b>.</li>
        <li><b>4.</b> Escolha um <b>mundo</b> e entre.</li>
        <li><b>5.</b> <b>Ande</b> (WASD), <b>converse</b> (chat), <b>fale</b> (voz por proximidade), <b>acene/dance</b>.</li>
        <li><b>6.</b> <b>Crie seu próprio mundo</b> no editor.</li>
      </ol>
    </section>

    <!-- Recursos -->
    <section class="lp-sec">
      <h2>O que dá pra fazer</h2>
      <div class="lp-grid">
        <div v-for="f in features" :key="f.t" class="lp-card">
          <strong>{{ f.t }}</strong>
          <span>{{ f.d }}</span>
        </div>
      </div>
    </section>

    <!-- Casos de uso -->
    <section class="lp-sec">
      <h2>Pra que serve</h2>
      <div class="lp-grid">
        <div v-for="u in useCases" :key="u.t" class="lp-card">
          <strong>{{ u.t }}</strong>
          <span>{{ u.d }}</span>
        </div>
      </div>
    </section>

    <!-- CTA final -->
    <section class="lp-final">
      <h2>Crie sua organização e chame o time.</h2>
      <button class="lp-btn" @click="entrar">Começar agora →</button>
    </section>

    <footer class="lp-foot">© Kairos 2026</footer>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import Logo from '@/components/logos/Logo.vue'

const router = useRouter()
function entrar() { router.push('/login') }

const features = [
  { t: 'Mundos em tempo real', d: 'Veja os outros andando, com colisão e presença ao vivo.' },
  { t: 'Chat + voz por proximidade', d: 'Converse por texto e fale por voz com quem está perto.' },
  { t: 'Editor de mundos', d: 'Coloque objetos, redimensione e salve seu próprio espaço.' },
  { t: 'Organizações / times', d: 'Cada equipe só vê os próprios mundos — espaços isolados.' },
  { t: 'Avatar e emotes', d: 'Customize seu personagem; acene, dance e interaja.' },
  { t: 'Pixel art', d: 'Visual leve e gostoso, roda no navegador.' },
]
const useCases = [
  { t: 'Escritório virtual', d: 'Equipe remota "junta" num espaço, com presença e voz.' },
  { t: 'Eventos e encontros', d: 'Salas temáticas e conversas por proximidade.' },
  { t: 'Estudo / coworking', d: 'Foco compartilhado, salas de trabalho em grupo.' },
  { t: 'Socializar o time', d: 'Happy hour, dinâmicas, onboarding mais humano.' },
]
</script>

<style scoped>
.lp { min-height: 100vh; background: radial-gradient(ellipse at 50% -10%, rgba(124,58,237,0.18), transparent 55%), var(--bg-0); color: var(--text); font-family: system-ui; }
.lp-hero { max-width: 760px; margin: 0 auto; padding: 64px 24px 40px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 18px; }
.lp-hero h1 { font-size: 38px; line-height: 1.1; letter-spacing: -0.03em; margin: 8px 0 0; }
.lp-sub { color: var(--text-2); font-size: 17px; line-height: 1.6; margin: 0; max-width: 640px; }
.lp-cta { display: flex; flex-direction: column; align-items: center; gap: 8px; margin-top: 8px; }
.lp-btn { background: var(--primary); border: none; color: #fff; padding: 13px 26px; font-size: 16px; font-weight: 600; border-radius: 6px; cursor: pointer; }
.lp-free { font-size: 13px; color: var(--text-3); }
.lp-sec { max-width: 880px; margin: 0 auto; padding: 32px 24px; }
.lp-sec h2 { font-size: 22px; margin: 0 0 14px; letter-spacing: -0.02em; }
.lp-sec p { color: var(--text-2); font-size: 16px; line-height: 1.7; margin: 0; }
.lp-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; color: var(--text-2); font-size: 16px; line-height: 1.5; }
.lp-steps b { color: var(--accent); }
.lp-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
.lp-card { background: var(--bg-2); border: 1px solid var(--border); border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 6px; }
.lp-card strong { font-size: 15px; }
.lp-card span { color: var(--text-3); font-size: 14px; line-height: 1.5; }
.lp-final { max-width: 760px; margin: 24px auto; padding: 48px 24px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 18px; }
.lp-final h2 { font-size: 26px; margin: 0; letter-spacing: -0.02em; }
.lp-foot { text-align: center; color: var(--text-4); font-size: 12px; padding: 24px; }
</style>
