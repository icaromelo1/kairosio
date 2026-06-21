# Plano — Multi-tenancy (organizações / grupos / equipes)

> Objetivo: o Kairos vira um espaço **por organização**. Usuários de uma org só veem e
> entram nos mundos da sua org. "Grupo X só vê os mapas do grupo X."
> Status: **planejado** (não implementado). Prioridade: ALTA.

---

## 1. Modelo de dados

### Organization (novo)
| campo | tipo | nota |
|---|---|---|
| `id` | uuid PK | |
| `name` | varchar | nome exibido |
| `slug` | varchar unique | usado em URLs/convites |
| `ownerId` | uuid | usuário que criou (admin inicial) |
| `createdAt` | timestamp | |

### User (alterar)
| campo novo | tipo | nota |
|---|---|---|
| `organizationId` | uuid nullable | org atual do usuário (null = sem org) |
| `orgRole` | enum `admin\|member` default `member` | papel **dentro da org** |

> Decisão (modelo simples): **1 org por usuário**. Multi-org (pertencer a várias) fica como
> evolução futura via tabela de membership — anotado, não agora.

### GameMap (alterar)
| campo novo | tipo | nota |
|---|---|---|
| `organizationId` | uuid nullable | dono organizacional do mundo |
| `isTemplate` | bool default false | mundo oficial/global (visível a todos) |

> Os 3 mundos atuais (studio/athenaeum/jardim) viram **templates globais**
> (`organizationId = null`, `isTemplate = true`), visíveis a todos como ponto de partida.

### OrgInvite (novo) — convites
| campo | tipo | nota |
|---|---|---|
| `code` | varchar PK | código curto aleatório |
| `organizationId` | uuid | |
| `createdBy` | uuid | admin que gerou |
| `expiresAt` | timestamp nullable | |
| `maxUses` / `uses` | int | controle de uso |

---

## 2. Regras de visibilidade (o coração)

- **`GET /map`**: retorna mundos onde `organizationId == user.organizationId` **OU**
  `isTemplate == true`. Sem org → só templates.
- **Criar mundo** (`POST /map`): `organizationId = user.organizationId` (obrigatório ter org).
  Sem org → 403 "entre/crie uma organização primeiro". Guest → 403 (já é regra).
- **Editar/Apagar**: além de dono, validar que o mundo é da org do usuário (defesa extra).
- **Presença/salas isoladas por org:** a room do socket passa a ser
  **`${organizationId || 'public'}:${mapId}`** (não só `mapId`). Senão duas orgs no mesmo
  template "studio" cairiam na mesma sala. O `join` precisa enviar `organizationId`.
  `getCounts()` e `peersInMap` passam a chavear por essa room composta.

---

## 3. Endpoints novos (módulo `org`)

| método | rota | quem | o quê |
|---|---|---|---|
| POST | `/org` | logado sem org | cria org, vira admin (set `organizationId`+`orgRole=admin`) |
| GET | `/org/me` | logado | org atual + (se admin) lista de membros |
| POST | `/org/invite` | admin | gera `OrgInvite` (retorna code/link) |
| POST | `/org/join` | logado | entra na org pelo `code` (set `organizationId`, role member) |
| PUT | `/org/member/:userId/role` | admin | promove/rebaixa membro |
| DELETE | `/org/member/:userId` | admin | remove membro (volta a sem org) |

JWT passa a carregar `organizationId` + `orgRole` (re-emitir token ao entrar/sair de org,
ou os interceptors lerem do banco). **Decisão a confirmar:** colocar org no JWT (rápido,
mas exige re-login ao trocar de org) vs ler do banco por request (sempre fresco).

---

## 4. UI

- **Onboarding pós-login** (se `organizationId == null`): tela com 2 opções — **Criar
  organização** (nome) ou **Entrar com código** (input do convite). Bloqueia o resto até ter org.
- **map-select**: já fica escopado (GET /map filtrado). Mostrar nome da org no topo.
- **Presença**: `connectPresence` envia `organizationId`.
- **Convite**: admin vê o código/link em `/admin` (ver PLANO-admin-panel).

---

## 5. Migração dos dados existentes

1. Criar tabelas/colunas (TypeORM synchronize cuida em dev).
2. Marcar studio/athenaeum/jardim como `isTemplate=true`, `organizationId=null`.
3. Mundos de usuário já existentes (ex: "novo-mundo") → sem org ainda: ou (a) apagar os de
   teste, ou (b) atribuir à org do dono quando ele criar uma. **Recomendado:** apagar os de
   teste antes do go-live da feature.

---

## 6. Tarefas (ordem de implementação)

1. Entities: `Organization`, `OrgInvite`, colunas em `User` e `GameMap`. (backend)
2. Módulo `org`: service + controller (POST `/org`, GET `/org/me`, join, invite). (backend)
3. Escopar `GET /map` e `POST /map` por org + templates. (backend)
4. Presença: room composta `${org}:${map}`; `join` recebe `organizationId`; ajustar
   `getCounts`/`peersInMap`. (backend)
5. Front: tela de onboarding (criar/entrar org) + guarda (sem org → onboarding). (front)
6. Front: `connectPresence` envia org; map-select mostra a org. (front)
7. Migração + marcar templates. (ops)

---

## 7. Critérios de aceite

- Usuário da org A **não vê** mundo da org B no map-select nem na lista de online/presença.
- Admin cria org → gera convite → outro usuário entra → ambos veem os mesmos mundos e se
  encontram na mesma sala.
- Templates (studio/athenaeum/jardim) visíveis a todos.
- Guest e usuário sem org: só veem templates, não criam mundos.

## 8. Decisões a confirmar com o Icaro

- 1 org por usuário (vs multi-org)?
- `organizationId` no JWT (re-login ao trocar) vs lido do banco por request?
- Solo user: cria org pessoal automática no signup, ou só ao precisar?
- Templates podem ser **clonados** pra dentro da org (cópia editável)? (provável "sim" futuro)
