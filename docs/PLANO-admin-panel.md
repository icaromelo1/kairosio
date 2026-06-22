# Plano — Painel de administrador da organização

> **Parte do épico de multi-tenancy** (entregue JUNTO, não depois) — administrar a org é
> intrínseco à ideia de organização. Ver `PLANO-multi-tenancy.md` e o "Plano de execução"
> (waves) no `ROADMAP.md`: tasks **T9 (guard), T10 (endpoints admin), T11 (painel /admin)**.
> Status: planejado. Prioridade: ALTA.

---

## 1. Acesso

- Rota `/admin` no front. Visível só pra quem tem `orgRole == 'admin'` na org atual.
- Guarda de rota: `requiresAuth` + checagem de admin (redireciona se não for).
- Backend: endpoints protegidos por um guard `OrgAdminGuard` (JWT + `orgRole == admin`).

> Importante: este é o admin **da org** (papel no banco), diferente da allowlist global de
> email usada hoje pra mudar status de feedback. São coisas separadas.

---

## 2. Funcionalidades

### Membros
- Listar membros da org (nome, email, papel, entrou em).
- **Convidar**: gerar/copiar código ou link de convite (`POST /org/invite`).
- **Promover/rebaixar** admin (`PUT /org/member/:id/role`).
- **Remover** membro (`DELETE /org/member/:id`) — ele volta a "sem org".

### Mundos da org
- Listar mundos da org (nome, dono, tamanho, online agora).
- **Apagar** qualquer mundo da org (admin tem poder além do dono).
- **Transferir dono** (opcional/futuro).

### Configurações da org
- Editar nome / slug.
- (futuro) logo, cores, domínio de email pra auto-join.

---

## 3. Endpoints (reusa/estende o módulo `org`)

| método | rota | nota |
|---|---|---|
| GET | `/org/me` | já traz membros se admin |
| GET | `/org/maps` | mundos da org (ou reusar GET /map já escopado) |
| POST | `/org/invite` | gerar convite |
| PUT | `/org/member/:id/role` | papel |
| DELETE | `/org/member/:id` | remover |
| PUT | `/org` | editar nome/slug |
| DELETE | `/map/:id` | já existe; admin da org também pode (estender a checagem) |

---

## 4. UI (rota `/admin`)

- Abas: **Membros** · **Mundos** · **Configurações**.
- Membros: tabela + botão "Convidar" (mostra código/link) + ações por linha.
- Mundos: tabela + ação apagar.
- Configurações: form simples.

---

## 5. Tarefas

1. `OrgAdminGuard` (backend).
2. Endpoints de membros/convite/config no módulo `org`.
3. Estender `DELETE /map/:id` pra permitir admin da org.
4. Front: rota `/admin` + guarda + as 3 abas.

## 6. Critérios de aceite

- Não-admin não acessa `/admin` (redireciona) nem os endpoints (403).
- Admin convida, promove, remove membro e apaga mundo da org.
