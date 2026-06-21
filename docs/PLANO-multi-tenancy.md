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
4. **Auth no socket** (passar JWT no handshake, derivar `organizationId` do token — não
   confiar no payload do cliente) + room composta `${org}:${map}`; ajustar
   `getCounts`/`peersInMap` por org. (backend) — *ver §12 Segurança*
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

## 8. Decisões — recomendação (pra confirmar, mas já dá pra seguir)

| decisão | recomendação | porquê |
|---|---|---|
| 1 org por usuário vs várias | **1 org por usuário** (campo direto em User) | simples; multi-org é raro e dá pra evoluir com tabela de membership sem refazer |
| org no JWT vs lido do banco | **ler do banco por request** (um guard/interceptor injeta `organizationId`+`orgRole` no `req.user` a partir do `sub`) | sempre fresco; troca de org/papel reflete na hora, sem re-login. JWT continua só com `sub`/`email` |
| solo user (sem org) | **NÃO cria org automática** no signup; ao logar sem org → **onboarding** (criar ou entrar) | evita lixo de orgs vazias; deixa a escolha explícita |
| templates clonáveis | **sim, mas depois** (v2 do editor) — "Clonar pra minha org" copia o `objects`/paleta num mundo novo da org | reaproveita os mundos oficiais; não bloqueia o MVP |

---

## 9. Fluxos detalhados

### Onboarding (logou e não tem org)
1. Guarda de rota: se `requiresAuth` e `user.organizationId == null` → redireciona pra `/onboarding`.
2. `/onboarding`: duas ações —
   - **Criar organização**: input nome → `POST /org { name }` → vira admin → segue pro fluxo normal.
   - **Entrar com código**: input do convite → `POST /org/join { code }` → vira member → segue.
3. Depois disso o usuário tem org e o resto do app funciona normal.

### Criar mundo (já com org)
- `POST /map` → backend seta `organizationId = req.user.organizationId`. Sem org → 403.

### Entrar num mundo (presença)
- `connectPresence` envia `{ ...payload, organizationId }`.
- Gateway monta a room **`${organizationId || 'public'}:${mapId}`**. Templates (sem org do
  mapa) ainda são separados **por org do jogador** — duas orgs no mesmo template não se misturam.
- `getCounts()` agrega por `mapId` **dentro da org do requisitante** (o endpoint `/presence/counts`
  passa a receber/inferir a org e contar só as rooms daquela org).

### Sair / ser removido da org
- `DELETE /org/member/:id` → seta `organizationId=null`, `orgRole=member` no alvo.
- Na próxima navegação, o guard manda pro `/onboarding`. Mundos que ele criou **ficam na org**
  (não somem); dono continua sendo ele, mas só membros da org veem.

---

## 10. Query do `GET /map` (pseudo)

```sql
SELECT * FROM game_maps
WHERE is_template = true
   OR organization_id = :userOrgId   -- null-safe: se userOrgId for null, só templates
ORDER BY name;
```
No TypeORM: `where: [{ isTemplate: true }, { organizationId: userOrgId }]` (OR), tratando
`userOrgId == null` (aí só `{ isTemplate: true }`).

---

## 11. Convites (OrgInvite)

- `code`: 8 chars alfanuméricos (ex: `nanoid`), case-insensitive.
- `POST /org/invite` (admin): cria com `expiresAt` (ex: +7 dias) e `maxUses` (ex: 25, ou null=∞).
- `POST /org/join { code }`: valida (existe, não expirou, `uses < maxUses`) → seta org do
  usuário, incrementa `uses`. Erros: 404 (inválido), 410 (expirado/esgotado), 409 (já está em org).
- Link de convite no front: `…/kairos/onboarding?invite=CODE` (preenche o campo).

---

## 12. Segurança / casos de borda

- **Todo endpoint de mundo revalida a org**, não confia só no front: editar/apagar exige
  `map.organizationId == user.organizationId` (além de dono/admin).
- **Presença**: o gateway confia no `organizationId` que o cliente manda? Risco: um cliente
  malicioso manda org alheia e "entra" na sala de outra org. **Mitigação:** o socket deveria
  autenticar (passar o JWT no handshake) e o gateway derivar a org do token, não do payload.
  → Tarefa extra: **auth no socket** (passar token no `io(..., { auth: { token } })`, validar no
  `handleConnection`). Documentar como parte desta etapa.
- Usuário sem org não cria mundo nem entra em sala de org (só templates, escopo "public").

---

## 13. Decisões ainda abertas (menores)
- Nome de org único global (slug) vs só dentro de um espaço? → recomendo **slug único global**.
- Um admin pode deletar a própria org? (e o que acontece com os mundos?) → v2.
- Trocar de org (sair de uma, entrar em outra) já no MVP? → sim, é só `join` com outro código
  (o `join` sobrescreve a org atual) — documentar que isso "abandona" a anterior.
