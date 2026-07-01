# Plano — Multi-tenant (múltiplas organizações por login)

> Origem: feedback do Icaro — um usuário deveria poder pertencer a mais de uma
> organização e escolher qual usar em cada sessão, em vez do modelo 1 usuário = 1 org
> fixa que existia antes. Status: ✅ **implementado 01/07/2026**.

## Antes

`User.organizationId` era a única fonte de verdade — 1 usuário só podia estar em
**uma** org por vez. Criar ou entrar numa org nova exigia sair da anterior (ou dava
erro `ConflictException`). Sem tabela de membership, sem endpoint pra listar "minhas
orgs", sem forma de trocar de org sem passar por convite de novo.

## Depois

- **`OrgMembership`** (`kairos-api/src/org/org-membership.entity.ts`): tabela nova
  `org_memberships` (`userId`, `organizationId`, `role`, `joinedAt`) — relação N:N real
  entre usuário e organização.
- **`User.organizationId` vira só "org ATIVA no momento"** — cache de conveniência
  usado pelo presence gateway (isolamento de salas) e por queries existentes; a fonte
  de verdade de "de quais orgs sou membro" é a tabela `org_memberships`.
- **Backfill automático** (`OrgService.onModuleInit`): toda subida do servidor,
  usuários com `organizationId` preenchido (schema antigo) que ainda não têm
  membership correspondente ganham uma linha — migração idempotente, sem precisar de
  script manual (projeto usa `synchronize: true`, sem migrations do TypeORM).
- **`create()`**: não bloqueia mais se o usuário já tem uma org — cria a nova, salva a
  membership como admin, e ativa ela na hora.
- **`join()`**: não bloqueia mais se o usuário já tem uma org ativa — adiciona uma
  membership nova; só ativa automaticamente se o usuário **não tinha nenhuma org
  ativa** antes (evita trocar a ativa às cegas ao aceitar um convite).
- **`removeMember()`**: remove a membership; se a org removida era a ativa do membro,
  cai automaticamente pra outra membership existente (ou fica sem org ativa).

### Endpoints novos

- `GET /org/mine` — lista todas as orgs de que o usuário é membro (nome, papel, se é a
  ativa). Usado pela tela de escolha no login.
- `POST /org/switch/:orgId` — troca qual org fica ativa nesta sessão (valida
  membership antes).

### Frontend

- `LoginPage.vue` — `postAuthDest()` agora chama `getMyOrgs()` em vez de `getMyOrg()`:
  **exatamente 1 org** → vai direto pro jogo (`/character`); **0 ou 2+ orgs** → cai em
  `/onboarding`.
- `OnboardingPage.vue` — ganhou uma seção **"Suas organizações"** no topo, listada só
  quando `myOrgs.length > 0`: cada org aparece com papel (admin/membro) e indicador de
  qual está ativa; clicar chama `switchOrg()` e vai pro jogo. As seções de
  criar/entrar com convite continuam abaixo, sempre visíveis.

## O que não mudou

- Presence gateway (`presence.gateway.ts`) — nenhuma alteração; já deriva a sala
  (`org:map`) a partir de `User.organizationId`, que continua existindo como "ativa".
- JWT — continua sem carregar a org (só `sub`/`email`); a org é sempre relida do banco
  a cada request via `JwtStrategy`, então trocar de org ativa não exige logout/login
  nem reemissão de token.

## Fora do escopo desta v1

- UI de "sair de uma org" sem ser removido por um admin (hoje só existe
  `removeMember`, chamado por admin de outro membro — sair da própria conta ainda não
  tem botão dedicado).
- Convite já vindo endereçado a uma org específica quando o usuário aceita duas vezes
  o mesmo link (hoje dá `ConflictException`, tratado no frontend como erro simples).
