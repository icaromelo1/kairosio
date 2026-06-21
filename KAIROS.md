# Kairos IO

> Um **Gather.town pixel art**: um espaço virtual **compartilhado** onde vários usuários
> coexistem no mesmo mapa, se veem pelos avatares e interagem **por proximidade**.

Kairos **não** é um dashboard individual de produtividade — é um **espaço social**.
Os objetos do cenário (mesa, lousa, jukebox, NPCs) são **estações** dentro de um mundo
onde outras pessoas estão presentes ao vivo, ao estilo Gather.town.

---

## Visão de produto

- **Espaço compartilhado:** todos num mesmo mapa, vendo os avatares uns dos outros
  se moverem em tempo real.
- **Interação por proximidade:** chegar perto de uma estação (ou de outro usuário)
  ativa algo — um modal, um chat, uma ferramenta, um NPC.
- **Pixel art top-down:** avatar 2D customizável, mapa em grid, render via PixiJS.
- **Estações como ferramentas:** mesa, lousa, rádio/jukebox, sala de servidores,
  estante — e NPCs com system prompt (LLM) como "pessoas" do mundo.

A diferença de tudo isso pra um joguinho single-player é **a presença de outras pessoas**.
Esse é o coração do Kairos e o que define a prioridade técnica abaixo.

---

## Arquitetura

Monorepo (repo privado `icaroMelo1/kairosio`):

```
kairosio/
├── kairos-ui/        # Front — Quasar + Vue 3 + PixiJS + Pinia
├── kairos-api/       # Back  — NestJS + TypeORM + PostgreSQL + JWT
└── kairos-configs/   # Infra — Docker Compose
```

- **Front:** Vue 3 (Composition API) + Quasar + **PixiJS 8** + Pinia + vue-router.
  Game em `src/game/` (`useAvatarController.ts`, `constants.ts`, `shadeHelper.ts`),
  páginas em `src/pages/`, stores em `src/stores/`.
- **Back:** NestJS simples (Controller → Service → TypeORM direto, sem Clean Architecture).
  Módulos `auth`, `user`, `character`, `world`.
- **Deploy:** no ar em `icaromelodev.com.br/kairos` (Oracle), CI/CD via GitHub Actions → SSH
  (desde 10/06/2026).

---

## Estado atual

✅ **Pronto (single-player):**
- Auth — `POST /auth/login`, `/register`, `/guest`, `GET /auth/me` (JWT + `jwt.strategy`).
  > ⚠️ OAuth Google/GitHub previsto no plano, **ainda não implementado** (só login/guest).
- Customização do personagem — `CharacterPage.vue`, componentes em `components/pixel`.
- Mapa navegável com colisão — `GamePage.vue`, `useAvatarController.ts` (grid 30×20, tile 32).
- Temas de mapa — `studio` (default), `athenaeum` (greek), `agora` (outdoor); `MapSelectPage.vue`.
- Estações já modeladas no mapa — `desk`, `board`, `jukebox`, `servers`, `shelf`.
- Persistência — `GET/PUT /world/state`, `PUT /character` (entities `user`, `character`, `world-state`).
- Landing page + login.

⬜ **Falta pro "Gather":**
- **Presença multiusuário em tempo real** (ver outros avatares se movendo) — *o item nº1*.
- Interação por proximidade **entre usuários**.
- NPCs com LLM.
- Chat / vídeo por proximidade (WebRTC).

---

## Roadmap (reordenado pela visão Gather)

O multiplayer, que no plano original era a última fase, vira o **centro**.

### ✅ Presença multiusuário (MVP) — feito (branch `feat/presenca`)
Ver outros usuários se movendo em tempo real no mesmo mapa. socket.io: gateway no
`kairos-api` (rooms por mapa, estado em memória), `services/presence.ts` no front,
avatares remotos renderizados no `GamePage`. Testado em produção. *Falta mergear na main.*

### Decisões de arquitetura (jun/2026)
- **Render:** migrar de DOM/SVG para **PixiJS** (já instalado) — aguenta mapas grandes,
  câmera, muitos sprites e animação.
- **Mapas:** **formato de dados próprio** (JSON nosso), NÃO Tiled. Motivo: o objetivo é o
  usuário customizar o espaço (Gather) — ninguém vai usar o Tiled (app de desktop). Um
  **editor in-game no browser** (futuro) lê/escreve esse mesmo formato.
- **NPCs com LLM:** adiados conscientemente. Foco agora é a mecânica geral do jogo.

### 🏗️ Épico 1 — Motor de mapa (FUNDAÇÃO, destrava o resto)
- **1a** Schema do mapa (grid de tiles com tipo + flag de colisão, camada de objetos, spawn).
- **1b** Renderer em **PixiJS** desenhando o mapa a partir do schema (substitui o SVG/DOM).
- **1c** **Câmera que segue o jogador** (viewport rolante) — destrava mapas grandes.
- **1d** Migrar os 3 mundos atuais (studio/athenaeum/ágora) pro novo formato.
- **1e** *(marco futuro)* Editor de mapa no browser pro usuário.

### 🚶 Épico 2 — Personagem & movimento (depende do 1)
- Colisão do avatar com tiles/objetos sólidos (não só a borda).
- Hitbox (caixa de colisão de personagem e objetos).
- Direção (pra onde olha) + animação de caminhada — e **sincronizar na rede**.

### 💬 Épico 3 — Social / multiplayer (depende do 2)
- Interação por proximidade entre usuários ("bolha" de quem está perto).
- Chat de texto (global e/ou por proximidade), reações/emotes.

### 🎨 Épico 4 — Customização do personagem (paralelo)
- Mais opções (cabelos, roupas, cores, acessórios), preview ao vivo melhorado.

### 🧹 Polimentos (rápidos, encaixam cedo)
- Identidade real (persistir nome em vez de "Convidado" efêmero).
- Contador "online: X" no HUD usando `remotePlayers`.

### 🧊 Adiados
- NPCs com LLM · Voz/vídeo por proximidade (WebRTC) · Login/OAuth de verdade.

---

## Histórico

- **Plano original** ("unified-pixel", produtividade individual):
  `~/.openclaw/migration/.../archive/plans/oq-vc-sabe-sobre-unified-pixel.md`.
- **Protótipo inicial** em React/JSX (09/05/2026): `~/Downloads/Kairos IO.zip`.
- A reescrita atual é em Vue/Quasar. A visão "imitar o Gather" (multiusuário) é a direção
  vigente — supera o enquadramento individual do plano antigo.
