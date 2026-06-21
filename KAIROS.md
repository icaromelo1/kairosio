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

### ▶️ Fase atual — Presença multiusuário (MVP)
**Objetivo mínimo:** ver outros usuários se movendo em tempo real no mesmo mapa.
Sem chat, sem vídeo — só presença. É o salto que transforma Kairos em Gather.

- WebSocket gateway no `kairos-api` (NestJS) — entrar no mapa, broadcast de posição, sair.
- Cliente no `kairos-ui` — emitir a própria posição, renderizar os avatares remotos via PixiJS.
- Estado de "quem está na sala" (entrar/sair, lista de presentes).

### Próximas
1. **Interação por proximidade entre usuários** — eventos quando dois avatares se aproximam.
2. **Chat de texto por proximidade** — zona de conversa ao se aproximar.
3. **NPCs com LLM** — estações que conversam (system prompt por NPC).
4. **Voz/vídeo por proximidade (WebRTC)** — o ápice do modelo Gather.
5. **OAuth** (Google/GitHub) — completar o auth previsto no plano original.

---

## Histórico

- **Plano original** ("unified-pixel", produtividade individual):
  `~/.openclaw/migration/.../archive/plans/oq-vc-sabe-sobre-unified-pixel.md`.
- **Protótipo inicial** em React/JSX (09/05/2026): `~/Downloads/Kairos IO.zip`.
- A reescrita atual é em Vue/Quasar. A visão "imitar o Gather" (multiusuário) é a direção
  vigente — supera o enquadramento individual do plano antigo.
