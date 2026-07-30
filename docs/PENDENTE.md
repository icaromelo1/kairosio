# Kairos — O que ainda falta

> Lista enxuta do que está **pendente**. O grosso do roadmap já foi entregue.
> Atualizado: 2026-07-30. Specs detalhados nos outros `docs/PLANO-*.md`.

---

## 🎨 1. Arte / visual 2.5D (estilo Stardew)
> Billboards, avatar fofo, y-sort, sombras, customização e objetos com volume já feitos.
> `docs/PLANO-arte-2.5d.md`.
- [ ] **Avatar art completa** — spritesheets desenhadas (4 direções, walk frames).
      *grande, precisa decisão + arte.* Destrava também o **virar de perfil no A/D**
      (tentado e revertido em 22/06: sem spritesheet real fica estranho).

## 🔐 2. OAuth Google/GitHub — *código pronto, BLOQUEADO no Icaro*
- [ ] Criar os apps OAuth (Google Cloud + GitHub) e pôr as creds no `.env` do servidor
      (`GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`). Aí trocar os botões
      "em breve" por reais. O backend já registra as strategies quando as envs existem.

## 🧹 3. Débitos técnicos conhecidos
- [ ] **`synchronize: true` em produção** (TypeORM). Funciona hoje, mas uma mudança
      de entity mal feita altera o schema sozinha. Trocar por migrations quando o
      schema estabilizar.
- [ ] **Estado do jogo em memória no gateway** (presença, fila do jukebox, lousas).
      Reiniciar a API zera lousas e filas; e não escala pra 2+ instâncias. Só vale
      resolver (Redis adapter) se houver mais de uma instância.
- [ ] **Bundle único grande** (aviso de chunk >500KB no build). Code-split por rota
      quando incomodar o carregamento.
- [ ] Decisões em aberto da multi-tenancy (1 org/usuário vs multi-org; clonar
      templates ao entrar numa org). *futuro*

## 💡 4. Backlog / não agendado
- **NPCs com LLM** — só ideia, fora do plano atual.
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
