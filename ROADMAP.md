# Roadmap do Kairos

Mapa de tudo que falta pra levar o Kairos de protótipo a um Gather.town pixel art
de verdade. Organizado em **etapas** com dependências. Ver visão em `KAIROS.md`.

> Atualizado: 2026-06-21.

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

## Etapa 4 — Editor de mapa in-game *(a visão "o usuário cria o mundo dele")*

> Backend já pronto: `PUT /map/:id` salva, `GameMap.ownerId` separa mundos por dono.

- [ ] Modo edição: colocar/mover/remover objetos no grid (snap).
- [ ] Paleta de objetos (mesa, árvore, parede, cerca, água, etc.).
- [ ] Redimensionar o mundo (width/height) e trocar a paleta de cores.
- [ ] Salvar via `PUT /map/:id`; **criar** mundos novos (`POST /map`, falta endpoint).
- [ ] Permissões: só o dono (ou admin) edita; mundos oficiais protegidos.
- [ ] Undo/redo, validações (spawn válido, sem sobreposição inválida).

## Etapa 5 — Conteúdo e arte *(paralela, contínua)*

- [ ] **Arte real dos objetos** (hoje são caixas com contorno — sprites de verdade).
- [ ] **Mais customização do avatar** (cabelos, roupas, acessórios, tons de pele).
- [ ] **Melhorar a animação/“3D” do avatar** (8 direções, suavização, sombra que segue).
- [ ] Mais mundos/temas oficiais.

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

`Etapa 0` (agora) → `Etapa 1` (auth, fundação) → `Etapa 2` + `Etapa 3` (em paralelo) →
`Etapa 4` (editor) → `Etapa 6` (estações) → `Etapa 7` (WebRTC).
`Etapa 5` (arte/conteúdo) e a faixa de **Segurança** correm em paralelo o tempo todo.

---

## 💡 Backlog separado — Ideias futuras (NÃO agendado)

> Coisas que são **só ideia** por enquanto. Não entram no plano atual; só serão
> consideradas **depois** do app ajustado e maduro (núcleo social, editor e polimento prontos).

- **NPCs com LLM** — estações que conversam (system prompt por NPC), via microserviço de IA.
  É a última coisa a entrar, e ainda nem está decidida — fica aqui como visão, fora das waves.
