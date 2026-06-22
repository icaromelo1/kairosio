# Roadmap do Kairos

Estado real do projeto. Visão em `KAIROS.md`; **o que falta em `docs/PENDENTE.md`**;
specs detalhados em `docs/PLANO-*.md`.

> Atualizado: 2026-06-22.

---

## 🔜 O QUE FALTA → `docs/PENDENTE.md`

Resumo (detalhe + ordem no PENDENTE.md):
0. **🐞 Bugs + UX/movimento (novo, prioridade)** — botão focado/Enter, selecionar mundo atual,
   rotação 2.5D ruim, scroll em telas de height fixo, perfil no A/D, boost no Shift. — `PLANO-bugs-ux-movimento.md`
1. **Arte 2.5D** — y-sort+sombras+customização ✅; falta objetos com volume "real" + spritesheets do avatar. — `PLANO-arte-2.5d.md`
2. **Editor**: undo/redo + validações; poltrona sentável.
3. **Estações funcionais**: ligar lousa/jukebox/mesa/estante a ferramentas reais.
4. **Voz/vídeo**: vídeo por proximidade + indicador de "quem fala".
5. **OAuth Google/GitHub**: código pronto, falta o Icaro criar os apps + creds.
6. **Polimento**: performance/culling, hardening XSS completo.
7. **Backlog (não agendado):** NPCs-LLM. **Recusado:** economia/dinheiro.

---

## ✅ JÁ FEITO (na `main`, no ar)

**Núcleo / Gather**
- Presença multiusuário em tempo real (socket.io), colisão de mapa + entre personagens (anti-stuck).
- Avatar animado no PixiJS (andar/parar/dançar/acenar/sentar), pose/direção **sincronizadas na rede**.
- Chat por sala, **lista de online**, emotes, **indicador de proximidade**.
- **Voz por proximidade (WebRTC áudio)** opt-in, mic com rótulo claro + reconectar.

**Mundos / editor**
- Motor de mapa no PixiJS (render por dados, câmera que segue, **zoom + rotação 90°**, billboards na rotação).
- Mapas no banco (`GameMap`), 3 mundos-base como **templates**.
- **Editor completo**: criar/editar/apagar mundo, paleta, colocar/remover, redimensionar, spawn,
  ghost preview, rotacionar objetos, **criador de objeto pixel**, toggle de colisão.

**Identidade / multi-tenancy**
- Auth real (login/registro/convidado, guarda de rota); **OAuth Google/GitHub** pronto (env-gated, falta creds).
- **Multi-tenancy**: organizações/times, escopo de mapas por org, **salas isoladas por org** (auth no socket),
  onboarding (criar/entrar org via convite), **painel `/admin`** (membros/mundos/config).
- Persistência: personagem + último mundo/posição no banco (retoma ao logar); nome não vaza entre contas.

**Produto / outros**
- Branding **Kairos** (renomeado de "Kairos IO") + favicon; **landing** reescrita (o que é/como usar/pra que serve).
- Canal de **feedback** com gate de email, status + **data de resolução** (relativo + absoluto).
- **Contador de online por mundo**; controles touch (mobile); presença robusta (ping/beforeunload).
- Segurança: authz por dono no map, authz admin no feedback-status, validação DTO, rate limiting.
- Suite **E2E Playwright** (smoke). Avatar com cara mais fofa (1ª passada).

---

## 🧭 Decisões registradas

- **Posicionamento:** rede social (espaço virtual), **aberto a todos**; talvez B2B no futuro.
- **Login real** é o caminho; **convidado não cria mundos**.
- **Mundos só no banco** — nada de mundo novo por seed; tudo pelo editor.
- **Multi-tenancy + administração = um épico só** (entregue junto). ✅
- **Direção de arte: 2.5D** (billboards/Stardew), não 2D plano (Terraria).
- **Economia/dinheiro: recusado.** **NPCs-LLM: backlog**, não agendado.

---

## 📂 Specs (`docs/`)
`PENDENTE.md` · `PLANO-arte-2.5d.md` · `PLANO-editor-melhorias.md` · `PLANO-interacoes-objetos.md`
· `PLANO-camera-e-estilo.md` · `PLANO-feedback-status.md` · `PLANO-hardening-e-login.md`
· `PLANO-landing-page.md` · `PLANO-multi-tenancy.md` · `PLANO-admin-panel.md`

---

## 💡 Backlog — ideias futuras (NÃO agendado)
- **NPCs com LLM** — estações que conversam (microserviço de IA). Só visão, fora das waves.
