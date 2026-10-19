# Kairos — O que ainda falta

> **Refactor em andamento (branch `main-refactor`, desde 19/10/2026):** o motor PixiJS está
> sendo trocado por Babylon.js. Estado e próximo passo em `docs/CONTINUAR-REFACTOR.md`;
> plano completo em `kairos-ui/public/docs/refactor/index.html`.

> Lista enxuta do que está **pendente**. O grosso do roadmap já foi entregue.
> Atualizado: 2026-07-30. Specs detalhados nos outros `docs/PLANO-*.md`.

---

## 🎨 1. Arte, mapa e personagem
- [ ] Substituídos pelo refactor para Babylon.js (branch `main-refactor`). O avatar
      modular com roupas e cores é o ponto 5 de `docs/CONTINUAR-REFACTOR.md`.

## 🔐 2. OAuth Google/GitHub — *código pronto, BLOQUEADO no Icaro*
- [ ] Criar os apps OAuth (Google Cloud + GitHub) e pôr as creds no `.env` do servidor
      (`GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`). Aí trocar os botões
      "em breve" por reais. O backend já registra as strategies quando as envs existem.

## 🔑 3. Sudo (admin geral) — decisões tomadas em 02/08/2026
- Sudo é a coluna `users.isSudo`. Substituiu a allowlist de e-mail (`ADMIN_EMAILS`),
  que ficava chumbada no código.
- **Promoção só por banco, de propósito.** Sudo tem acesso a todos os servidores e
  controle total — não deve haver endpoint nem botão que conceda isso. Um
  `UPDATE kairos.users SET "isSudo" = true WHERE email = '...'` é o caminho, e o
  atrito é intencional. Não criar rota de gestão de sudo.
- [ ] **2FA** — a considerar, especialmente para contas sudo. Nada decidido ainda.

## 🧹 4. Débitos técnicos conhecidos
- [x] **`synchronize: true`** saiu na `main-refactor`: o schema passa a ser só por
      migrations (`npm run migration:generate|run|revert` no `kairos-api`).
- [ ] **Estado do jogo em memória no gateway** (presença, fila do jukebox, lousas).
      Reiniciar a API zera lousas e filas; e não escala pra 2+ instâncias. Só vale
      resolver (Redis adapter) se houver mais de uma instância.
- [ ] **Code-split por rota.** O `livekit-client` já sai do bundle inicial (carga
      sob demanda, −38%), mas as 11 páginas ainda são importadas estaticamente no
      router. Trocar por `component: () => import(...)` tiraria também o PixiJS
      (~250 KB) da landing, login e feedback — telas que não renderizam mapa.
      ~6 linhas, sem risco. *quick-win*
- [ ] Decisões em aberto da multi-tenancy (1 org/usuário vs multi-org; clonar
      templates ao entrar numa org). *futuro*

## 💡 4. Backlog / não agendado
- **NPCs com LLM** — só ideia, fora do plano atual.
- **Kanban integrado** — futuro distante. Não entra em plano nem documento; só volta quando o Icaro pedir para lembrar.
- **Economia / dinheiro** — ❌ recusado.

---

## ✅ Concluído desde a última revisão (jul/2026)

- **Estações funcionais**: jukebox (fila via YouTube + Drive), lousa colaborativa,
  mesa (tarefas), estante (notas) — todas ligadas ao `[E]` no GamePage.
- **Voz/vídeo**: vídeo por proximidade opt-in + indicador de quem está falando.
- **Editor**: undo/redo, validação de spawn/overlap, flag `sittable` genérica.
- **Performance**: culling de avatares fora do viewport.
- **Hardening XSS**: auditado (02/07) — zero `v-html`/`innerHTML` no front.
- **Code review geral (30/07)** — ver `docs/REVIEW-2026-07-30.md`:
  gate de typecheck consertado, mass assignment fechado, socket exige token,
  autoria do feedback pelo JWT, PII mascarada, sentar não trava mais o personagem,
  leaks de Pixi/AudioContext/timers corrigidos.
