<template>
  <div class="landing-root">
    <!-- background pixel city -->
    <svg class="city-bg pixelated" width="100%" height="100%" viewBox="0 0 200 100" preserveAspectRatio="xMidYMid slice">
      <rect x="0" y="62" width="200" height="1" fill="rgba(124, 58, 237, 0.4)" />
      <g fill="rgba(124, 58, 237, 0.22)">
        <rect x="10" y="50" width="6" height="12" /><rect x="18" y="44" width="8" height="18" />
        <rect x="34" y="40" width="10" height="22" /><rect x="54" y="42" width="12" height="20" />
        <rect x="76" y="38" width="8" height="24" /><rect x="94" y="42" width="14" height="20" />
        <rect x="118" y="44" width="10" height="18" /><rect x="138" y="40" width="12" height="22" />
        <rect x="160" y="44" width="10" height="18" /><rect x="182" y="42" width="12" height="20" />
      </g>
      <g fill="#fbbf24" opacity="0.5">
        <rect x="20" y="48" width="1" height="1" /><rect x="36" y="44" width="1" height="1" />
        <rect x="78" y="42" width="1" height="1" /><rect x="96" y="46" width="1" height="1" />
        <rect x="140" y="44" width="1" height="1" /><rect x="184" y="46" width="1" height="1" />
      </g>
    </svg>

    <!-- top bar -->
    <header class="lp-nav">
      <div class="lp-brand">
        <span class="lp-monogram">K</span>
        <span class="lp-brandname">KAIROS<span class="io">.IO</span></span>
      </div>
      <button class="k-btn k-btn-primary lp-nav-cta" @click="entrar">Entrar</button>
    </header>

    <!-- HERO -->
    <section class="lp-hero">
      <span class="k-chip">⚇ ambiente de trabalho gamificado</span>
      <h1 class="lp-title">Seu trabalho<br />vira um <span class="hl">mundo</span>.</h1>
      <p class="lp-sub">
        Kairos transforma sua produtividade num RPG top-down em pixel art: você habita um mapa,
        cumpre missões e trabalha lado a lado com <strong>agentes de IA</strong>.
      </p>
      <div class="lp-actions">
        <button class="k-btn k-btn-accent lp-big" @click="entrar">▶ Começar a jogar</button>
        <a class="k-btn k-btn-ghost lp-big" href="#como-features">Saber mais</a>
      </div>
    </section>

    <!-- mock screen -->
    <section class="lp-shot">
      <div class="lp-shot-frame k-card">
        <div class="lp-shot-bar"><span></span><span></span><span></span><em>kairos.io — mundo</em></div>
        <div class="lp-shot-body pixelated">
          <div class="mini-grid"></div>
          <div class="mini-player glow-purple"></div>
          <div class="mini-npc glow-gold" style="left:64%; top:38%"></div>
          <div class="mini-npc" style="left:30%; top:62%"></div>
          <span class="lp-shot-tag">screenshot do jogo · em breve</span>
        </div>
      </div>
    </section>

    <!-- FEATURES -->
    <section class="lp-block" id="como-features">
      <div class="lp-label">// por que kairos</div>
      <div class="lp-features">
        <div class="k-card lp-feat">
          <div class="lp-feat-ic">🗺</div>
          <h3>Mundo top-down</h3>
          <p>Um mapa pixel-art navegável onde cada área é um contexto de trabalho.</p>
        </div>
        <div class="k-card lp-feat">
          <div class="lp-feat-ic">🤖</div>
          <h3>Agentes de IA</h3>
          <p>NPCs inteligentes que ajudam em tarefas, dentro do próprio mundo.</p>
        </div>
        <div class="k-card lp-feat">
          <div class="lp-feat-ic">⚔</div>
          <h3>Missões & progresso</h3>
          <p>Transforme objetivos em quests com recompensa e sensação de avanço.</p>
        </div>
        <div class="k-card lp-feat">
          <div class="lp-feat-ic">✦</div>
          <h3>Pixel-art autoral</h3>
          <p>Estética retro de game, renderizada em tempo real com PixiJS.</p>
        </div>
      </div>
    </section>

    <!-- STACK -->
    <section class="lp-block">
      <div class="lp-label">// construído com</div>
      <div class="lp-stack">
        <span v-for="t in stack" :key="t" class="lp-badge">{{ t }}</span>
      </div>
    </section>

    <!-- CTA -->
    <section class="lp-cta">
      <h2>Pronto pra entrar no mundo?</h2>
      <button class="k-btn k-btn-primary lp-big" @click="entrar">Entrar agora</button>
    </section>

    <footer class="lp-foot">KAIROS.IO · um experimento de produtividade gamificada</footer>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()
const stack = ['Vue 3', 'Quasar', 'NestJS', 'TypeORM', 'PostgreSQL', 'PixiJS']
function entrar() { router.push('/login') }
</script>

<style scoped>
.landing-root {
  position: fixed;
  inset: 0;
  overflow-y: auto;
  background:
    radial-gradient(ellipse at 50% 0%, rgba(124, 58, 237, 0.18) 0%, transparent 55%),
    radial-gradient(ellipse at 85% 30%, rgba(251, 191, 36, 0.07) 0%, transparent 45%),
    var(--bg-0);
  color: var(--text);
}
.city-bg { position: fixed; inset: 0; opacity: 0.28; pointer-events: none; z-index: 0; }

.lp-nav, .lp-hero, .lp-shot, .lp-block, .lp-cta, .lp-foot { position: relative; z-index: 1; }

/* NAV */
.lp-nav {
  display: flex; align-items: center; justify-content: space-between;
  max-width: 1080px; margin: 0 auto; padding: 22px 24px;
}
.lp-brand { display: flex; align-items: center; gap: 12px; }
.lp-monogram {
  width: 34px; height: 34px; display: grid; place-items: center;
  background: var(--primary); color: #fff; font-family: var(--f-pixel); font-size: 13px;
  border: 3px solid var(--primary-hi); box-shadow: 3px 3px 0 var(--primary-lo);
}
.lp-brandname { font-family: var(--f-pixel); font-size: 13px; letter-spacing: 0.06em; }
.lp-brandname .io { color: var(--primary-hi); }
.lp-nav-cta { font-size: 9px; padding: 9px 14px; }

/* HERO */
.lp-hero { max-width: 1080px; margin: 0 auto; padding: 48px 24px 12px; text-align: center; }
.lp-title {
  font-family: var(--f-pixel); font-size: clamp(26px, 5.5vw, 52px); line-height: 1.3;
  margin: 22px 0 0; letter-spacing: 0.02em; text-shadow: 4px 4px 0 rgba(0,0,0,0.5);
}
.lp-title .hl { color: var(--primary-hi); }
.lp-sub {
  max-width: 620px; margin: 24px auto 0; font-size: 17px; line-height: 1.65; color: var(--text-2);
}
.lp-sub strong { color: var(--accent-hi); }
.lp-actions { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; margin-top: 36px; }
.lp-big { font-size: 11px; padding: 15px 22px; }

/* SHOT */
.lp-shot { max-width: 880px; margin: 64px auto 0; padding: 0 24px; }
.lp-shot-frame { overflow: hidden; }
.lp-shot-bar {
  display: flex; align-items: center; gap: 7px; padding: 12px 14px;
  border-bottom: 3px solid var(--primary-hi); background: var(--bg-3);
  font-family: var(--f-mono); font-size: 11px; color: var(--text-3);
}
.lp-shot-bar span { width: 10px; height: 10px; background: var(--border-strong); }
.lp-shot-bar em { margin-left: 8px; font-style: normal; }
.lp-shot-body {
  position: relative; height: 340px; overflow: hidden;
  background:
    linear-gradient(rgba(124,58,237,0.05), transparent),
    var(--bg-0);
}
.mini-grid {
  position: absolute; inset: 0;
  background-image:
    repeating-linear-gradient(0deg, rgba(124,58,237,0.10) 0 1px, transparent 1px 24px),
    repeating-linear-gradient(90deg, rgba(124,58,237,0.10) 0 1px, transparent 1px 24px);
}
.mini-player {
  position: absolute; left: 47%; top: 50%; width: 18px; height: 18px;
  background: var(--primary-hi); border: 3px solid #fff;
}
.mini-npc { position: absolute; width: 16px; height: 16px; background: var(--accent); }
.lp-shot-tag {
  position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%);
  font-family: var(--f-mono); font-size: 12px; color: var(--text-3);
}

/* BLOCKS */
.lp-block { max-width: 1080px; margin: 80px auto 0; padding: 0 24px; }
.lp-label { font-family: var(--f-mono); font-size: 12px; color: var(--text-3); margin-bottom: 22px; }
.lp-features { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
.lp-feat { padding: 22px; }
.lp-feat-ic { font-size: 24px; margin-bottom: 14px; }
.lp-feat h3 { font-family: var(--f-pixel); font-size: 11px; line-height: 1.5; margin: 0 0 10px; color: var(--primary-hi); }
.lp-feat p { font-size: 13.5px; line-height: 1.55; color: var(--text-2); margin: 0; }

.lp-stack { display: flex; flex-wrap: wrap; gap: 10px; }
.lp-badge {
  font-family: var(--f-mono); font-size: 12px; color: var(--accent-hi);
  background: rgba(251,191,36,0.10); border: 2px solid rgba(251,191,36,0.28); padding: 6px 12px;
}

/* CTA */
.lp-cta { max-width: 1080px; margin: 96px auto 0; padding: 0 24px; text-align: center; }
.lp-cta h2 { font-family: var(--f-pixel); font-size: clamp(16px, 3vw, 24px); line-height: 1.5; margin: 0 0 28px; }

.lp-foot {
  max-width: 1080px; margin: 80px auto 0; padding: 28px 24px 48px;
  border-top: 3px solid var(--border); text-align: center;
  font-family: var(--f-mono); font-size: 12px; color: var(--text-4);
}

@media (max-width: 860px) { .lp-features { grid-template-columns: 1fr 1fr; } }
@media (max-width: 520px) { .lp-features { grid-template-columns: 1fr; } .lp-nav-cta { display: none; } }
</style>
