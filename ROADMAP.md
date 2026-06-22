# Roadmap do Kairos

Mapa de tudo que falta pra levar o Kairos de protótipo a um Gather.town pixel art
de verdade. Organizado em **etapas** com dependências. Ver visão em `KAIROS.md`.

> Atualizado: 2026-06-21.

## ✅ STATUS: etapas 1–8 + multi-tenancy + backlog de 19 tasks implementados e na `main`

> **Backlog do plan-analyzer (19 tasks/6 waves) FEITO (22/06):** branding (Kairos+favicon),
> landing reescrita, feedback com status+data (relativo+absoluto), zoom+rotação de câmera,
> editor (ghost, rotação, +objetos, toggle colisão, **criador de objeto pixel**), sentar em
> cadeira/sofá, água lenta, mic claro + reconectar, nome não vaza no logout. Tudo na main.
> Feedbacks atualizados (7 resolvido, 1 em_andamento, 1 recusado). Câmera-rotação (C3) e
> criador-de-objeto (E5) precisam da **validação visual do Icaro**.

## ✅ STATUS: etapas 1–8 implementadas e na `main`

Etapas 1–8 implementadas e publicadas. OAuth pronto e env-gated (falta só criar os apps
e por as creds no `.env`). Perf adequada. NPCs com LLM no backlog (não agendado).

**Pós-lançamento (21/06) também já feito:** fix do multiplayer (corpo vazio em
/world/state e /character quebrava a entrada na sala), **colisão entre personagens**,
entradas pra **editar mundo próprio**, scroll do map-select, limite no nome do personagem,
**convidado não cria mundo** (UI + 403), e **contador de online por mundo** no map-select.

---

## 🆕 NOVA DIREÇÃO (decidida 21/06) — produto vira multi-tenant (times/orgs)

> Mudança grande de escopo: o Kairos passa a ser um espaço **por organização/equipe**,
> não um mundo único compartilhado por todos. Isto reordena as prioridades.

### 📂 Specs detalhados (prontos pra implementar) — em `docs/`
- **`docs/PLANO-multi-tenancy.md`** — modelo de dados, regras de visibilidade, endpoints, presença por org, migração, tarefas e critérios de aceite.
- **`docs/PLANO-admin-panel.md`** — painel do admin da org (membros, convites, mundos, config).
- **`docs/PLANO-editor-melhorias.md`** — colisão por objeto, mais objetos, rotação, criador de objeto (pixel+paleta). *(do feedback dos usuários)*
- **`docs/PLANO-hardening-e-login.md`** — auditoria dos campos de texto + nome cacheando + restantes do login real/OAuth.

### Decisões tomadas (21/06)
- **Login real é o caminho** (autoria/identidade fixa entre sessões). ✅ feito: convidado
  NÃO cria mundos (UI escondida + 403 no backend). A seguir: ao logar, carregar o
  personagem do usuário (DB) e **não vazar** o nome em cache local entre contas.

### 🏢 Etapa 9 — Multi-tenancy + administração de orgs/times — ✅ **FEITO (21/06)**
> "Pessoas do grupo X só veem os mapas do grupo X." **Implementado e na main** — 11 tasks/5
> waves, validado por HTTP+socket (org A não vê org B; convite/join; salas isoladas; painel
> admin). Specs: `docs/PLANO-multi-tenancy.md` + `docs/PLANO-admin-panel.md`.

**Tenancy (base):**
- [ ] Modelo: **Organization** (tenant) → membros (`User.organizationId` + `orgRole` admin/membro).
      Mundos ganham `organizationId` + `isTemplate` (`GameMap`).
- [ ] **Escopo de visibilidade:** `GET /map` = mundos da org do usuário + templates.
- [ ] Entrar numa org: criar org ou **convite** (código/link).
- [ ] **Presença/salas isoladas por org** (auth no socket; não ver/entrar em mundo de outra org).
- [ ] Migração: marcar oficiais como template; limpar mundos de teste.

**Administração (intrínseca, mesma entrega):**
- [ ] Rota `/admin` (só admin **da org**, papel no banco — não a allowlist global do feedback).
- [ ] Gerenciar **membros** (convidar / remover / promover a admin).
- [ ] Gerenciar **mundos** da org (listar, apagar).
- [ ] Configurações da org (nome, slug).

#### Plano de execução (waves) — 11 tasks · 5 waves
- **Wave 1:** T1 entidades+colunas (Organization, OrgInvite, User.org, GameMap.org/template).
- **Wave 2:** T2 org-context (injeta org/role no request) · T6 migração+templates.
- **Wave 3:** T3 módulo `org` (criar/entrar/convite) · T4 escopo dos mapas · T5 **auth no socket + salas por org** (peça central) · T9 `OrgAdminGuard`.
- **Wave 4:** T7 front onboarding (criar/entrar org)+guarda · T10 endpoints admin (membros/config/del mundo).
- **Wave 5:** T8 front presença por org + map-select mostra org · T11 front painel `/admin`.
- Caminho crítico: `T1 → T2 → T5 → T8`. (2 tasks simples via dispatch+review: T6, T9.)

### 📨 Feedbacks dos usuários (canal `/feedback`)

> O canal está funcionando (feedbacks reais chegando).

**✅ Já resolvidos (batch 22/06):**
- Personagem do tamanho de árvore → **proporção ajustada** (avatar menor).
- Olhar pra cima ficava estranho (sem cabelo atrás) → **mostra a nuca** agora.
- Travava dentro de outro personagem → **colisão anti-stuck** (sempre dá pra escapar).
- Faltava excluir mundo → **botão "Apagar mundo"** no editor (+ órfãos de convidado já limpos).
- Marcar colisão por objeto → **toggle "sólido"** no editor.
- Sem scroll na tela de feedback → **scroll na lista**.

**🗺️ Mapeados (a fazer):**
- [ ] **Interações por objeto** (sentar em cadeira/sofá/poltrona; água com efeito/bloqueio).
      → `docs/PLANO-interacoes-objetos.md`. *épico*
- [ ] **Ghost/preview transparente** do objeto antes de soltar no editor. — *médio* (PLANO-editor)
- [ ] **Criador de objeto próprio** (pixel + paleta + colisão). — *grande* (PLANO-editor)
- [ ] **Rotacionar objetos** no editor. — *médio* (PLANO-editor)
- [ ] **Mais objetos** na paleta. — *quick-win* (PLANO-editor)
- [ ] **Voz (mic)**: instabilidade (às vezes precisa desconectar/reconectar) + deixar o
      controle do microfone **muito mais claro/visível**. → `docs/PLANO-hardening-e-login.md` (seção voz).
- [ ] Cabeça do boneco "mais fofa" (ajuste visual). — *pequeno/subjetivo*

**❌ Recusado:** "Quero ter dinheiro" (economia/gamificação — fora de escopo).

### 🎥 Câmera (zoom/rotação) + melhoria de estilo — zoom/rotação FEITOS
- [x] Zoom + rotação 90° da câmera. → `docs/PLANO-camera-e-estilo.md`.
- ⚠️ Rotação revelou: o jogo é **2D plano** (objetos chapados), então girar deixa as árvores
  de cabeça pra baixo. O certo é **2.5D oblíquo** (billboards), ver abaixo.

### 🎨 Direção de arte 2.5D (estilo Stardew/DST) — planejado — **prioridade pós-feedback**
> Avatar "mais fofo/pixelado" (Stardew) + objetos como **billboards** que ficam em pé na
> rotação (em vez de virar de cabeça pra baixo). Causa raiz comum: hoje é 2D plano (Terraria),
> alvo é "3D em 2D". → `docs/PLANO-arte-2.5d.md`.
- [x] **Fix da rotação: objetos "em pé" viram billboard + contra-giram** (tira o de-cabeça-pra-baixo) — FEITO 22/06.
- [x] **Avatar mais fofo** (1ª passada: olhos maiores com brilho + bochechas) — FEITO 22/06; arte completa estilo Stardew segue como evolução.
- [ ] Y-sort objetos+avatares + sombras (profundidade).
- [ ] Objetos com base+altura no render (billboard "com volume").
- [ ] (futuro) Arte do avatar em spritesheets desenhadas (4 direções) pro look Stardew completo.

### 🏷️ Branding & posicionamento — planejado
> **Posicionamento (22/06):** o Kairos é uma **rede social** (espaço virtual), e **talvez vire
> B2B no futuro** — por enquanto **aberto a todos**. A landing/copy deve refletir isso.
- [ ] **Renomear "Kairos IO" → "Kairos"** em tudo (title da aba, textos `Kairos.IO` nos
      componentes — sidebar do jogo, login, etc.).
- [ ] **Favicon/logo na aba** (hoje está o globo padrão): gerar um `favicon.svg` a partir do
      "K" pixel (`PixelK.vue`) e referenciar no `index.html`.

### 🛬 Landing page — explicar melhor o produto — planejado
- [ ] Reescrever a landing pra explicar **o que é, como usar, o que faz e pra que serve**
      (casos de uso) + CTA claro e visuais reais. → `docs/PLANO-landing-page.md`.

### 🗂️ Status + data do feedback — planejado (+ regra de processo)
- [ ] Coluna `resolvedAt` + UI com **timer relativo** ("atualizado há X") e **data absoluta**
      ("implementado/recusado dd/mm/yy hh:mm"). → `docs/PLANO-feedback-status.md`.
- Regra: **sempre atualizar o status do feedback** ao implementar/recusar (e a data).

### ❌ Economia / gamificação — RECUSADO (não será implementado)
> Moeda, loja, veículos, itens compráveis. Decisão (21/06): **fora de escopo.** Registrado
> aqui apenas pra constar — não entra no plano de execução.

### 🔒 Blindagem de campos de texto (transversal) — **revisar todos os inputs**
- [ ] Auditar TODOS os campos: `maxlength`, `trim`, sanitização anti-XSS, validação.
      Feitos: chat (maxlength 300), nome do personagem (maxlength 20 + trim), feedback (DTO).
      Faltam: nome do mundo no editor, e escapar/sanitizar o **chat** (hoje renderiza texto
      puro — ok no Vue por padrão, mas revisar), nome do mundo, etc.
- [ ] **Nome do personagem "cacheando":** hoje persiste em `localStorage` genérico → com
      login real, hidratar do usuário (DB) ao logar e **limpar o cache ao deslogar/trocar
      de conta** (senão vaza o nome entre contas no mesmo navegador).

---

## ✅ Já feito (até 21/06/2026)

- **Presença multiusuário** (socket.io): ver outros avatares em tempo real, rooms por mapa. *(na `main`)*
- **Avatar animado no PixiJS**: boneco modular por partes (andar/parado/dançar/direção), cores paramétricas.
- **Motor de mapa no PixiJS**: render por dados, câmera que segue, colisão por tile.
- **3 mundos distintos**: Studio (22×15), Athenaeum (46×30), Jardim (36×26).
- **Mapas no banco**: entidade `GameMap` (jsonb) + `GET/PUT /map`, seed; front busca da API.
- **Canal de feedback**: tabela `feedbacks` (status + autor), gate de email cadastrado.
- **`/game` migrado pro PixiJS**: mapas dinâmicos + avatares remotos da presença.

> Tudo na branch `feat/motor-mapa` (exceto a presença, já na `main`).

---

## Etapa 0 — Consolidar (imediato)

- [ ] Mergear `feat/motor-mapa` → `main` (publica no site oficial via CI).
- [ ] Decidir destino do `/lab` (manter como rota de dev ou remover do build de produção).
- [ ] Limpar dados de teste do banco (`tester@kairos.dev` + feedback de exemplo).

## Etapa 1 — Autenticação real *(destrava identidade, persistência e permissões)*

> Hoje o backend tem login/register/guest (JWT + bcrypt), mas o **login do front é fake**.

- [ ] Ligar o `LoginPage` ao `/auth` real (login, registro, convidado).
- [ ] `authStore` real: guardar JWT (localStorage), header `Authorization` nas chamadas.
- [ ] Guarda de rota: `/game` e `/character` exigem sessão.
- [ ] OAuth **Google/GitHub** (estava no plano original).
- [ ] Identidade conectada ao avatar/nome do jogador.
- **Efeito:** o gate do feedback passa a valer pra usuários reais.

## Etapa 2 — Persistência do jogador *(depende da 1)*

- [ ] Salvar customização do personagem no banco (`PUT /character` já existe — ligar no front).
- [ ] Salvar última posição + mundo (`/world/state`).
- [ ] Carregar estado ao logar (cair no mundo/posição onde parou).

## Etapa 3 — Social / núcleo Gather *(o coração)*

- [ ] **Sincronizar pose/direção/emote na rede** (presença carregar `facing`+`pose`, não inferir).
- [ ] **Interação por proximidade entre usuários** (destaque/bolha de quem está perto).
- [ ] **Chat de texto** — global e/ou por proximidade.
- [ ] **Emotes/danças** visíveis pros outros.
- [ ] Lista de quem está online por sala (nomes).

## Etapa 4 — Editor de mapa in-game *(PRIORIDADE ELEVADA)*

> **Princípio (decidido 21/06):** mundos só existem no **banco**. O seed faz apenas o
> bootstrap dos 3 mundos-base; **nenhum mundo novo entra por seed** — todo mundo novo
> (oficial ou de usuário) nasce pelo **editor** (`POST /map`). Sem conteúdo descartável
> em código pra limpar depois. Por isso o editor sobe de prioridade: é o caminho certo
> pra criar/editar qualquer mundo.

> Backend já pronto: `PUT /map/:id` salva, `GameMap.ownerId` separa mundos por dono.

- [ ] `POST /map` (criar mundo) e `DELETE /map/:id` (remover) — **falta**.
- [ ] Modo edição: colocar/mover/remover objetos no grid (snap).
- [ ] Paleta de objetos (mesa, árvore, parede, cerca, água, etc.).
- [ ] Redimensionar o mundo (width/height) e trocar a paleta de cores.
- [ ] Salvar via `PUT /map/:id`.
- [ ] Permissões: só o dono (ou admin) edita; mundos oficiais protegidos.
- [ ] Undo/redo, validações (spawn válido, sem sobreposição inválida).

## Etapa 5 — Conteúdo e arte *(paralela, contínua)*

- [ ] **Arte real dos objetos** (hoje são caixas com contorno — sprites de verdade).
- [ ] **Mais customização do avatar** (cabelos, roupas, acessórios, tons de pele).
- [ ] **Melhorar a animação/“3D” do avatar** (8 direções, suavização, sombra que segue).
- [ ] Novos mundos oficiais → criados **pelo editor** (Etapa 4), nunca por seed.

## Etapa 6 — Estações funcionais *(ligar objetos a ferramentas)*

- [ ] Lousa = whiteboard, Jukebox = música, Mesa = workspace/tarefas, Estante = notas.

## Etapa 7 — Voz/vídeo por proximidade (WebRTC) *(ápice do Gather)*

- [ ] Áudio/vídeo que abre quando avatares se aproximam.
- [ ] Indicadores de quem está falando; mute/câmera.

## Etapa 8 — Polimento e produção *(contínua/final)*

- [ ] **Controles mobile/touch** (joystick), responsividade.
- [ ] **Performance**: culling, muitos jogadores, throttle de rede.
- [ ] Presença robusta: heartbeat/reconexão, limpar “fantasmas”.
- [ ] Testes E2E (Playwright), monitoramento/erros.

---

## 🔒 Transversal — Segurança e autorização *(atenção)*

> Hoje vários endpoints estão **sem autenticação/autorização** (ok pro protótipo, não pra produção):

- [ ] `PUT /map/:id` — qualquer um edita qualquer mapa (proteger por dono/admin — Etapa 1/4).
- [ ] `PUT /feedback/:id/status` — qualquer um muda status (restringir a admin).
- [ ] Validação de payloads (DTOs/class-validator) nos POST/PUT.
- [ ] Rate limiting no socket e nos POSTs (feedback, etc.).

---

## Ordem sugerida

`Etapa 0` (agora) → `Etapa 1` (auth, fundação) → **`Etapa 4` (editor — prioridade, p/ criar mundos do jeito certo)**
→ `Etapa 3` (social) → `Etapa 2` (persistência) → `Etapa 6` (estações) → `Etapa 7` (WebRTC).
`Etapa 5` (arte/conteúdo) e a faixa de **Segurança** correm em paralelo o tempo todo.

---

## 💡 Backlog separado — Ideias futuras (NÃO agendado)

> Coisas que são **só ideia** por enquanto. Não entram no plano atual; só serão
> consideradas **depois** do app ajustado e maduro (núcleo social, editor e polimento prontos).

- **NPCs com LLM** — estações que conversam (system prompt por NPC), via microserviço de IA.
  É a última coisa a entrar, e ainda nem está decidida — fica aqui como visão, fora das waves.
