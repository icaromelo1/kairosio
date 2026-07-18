# Kairos — O que ainda falta

> Lista enxuta e organizada do que está **pendente** (a maior parte do roadmap já foi feita).
> Atualizado: 2026-06-22. Specs detalhados nos outros `docs/PLANO-*.md`.

---

## 🐞 0. Bugs + UX/movimento (novo, 22/06) — ✅ *lote concluído 22/06*
> Detalhe + abordagem: `docs/PLANO-bugs-ux-movimento.md`.
- [x] **B1** Botões ficam focados após clique → Enter reaciona. FEITO 22/06 (blur global em `main.ts`).
- [x] **B2** Selecionar o mundo atual cria outra sessão. FEITO 22/06 (guard `id === currentId` no `selectMap`).
- [x] **B3** Câmera: rotação removida + zoom centralizado no personagem + pan com Espaço+arrastar. FEITO 22/06.
- [x] **B4** Scroll — login e personagem responsivos/scrolláveis (MapSelect/Register já ok). FEITO 22/06.
- [~] **M1** Virar de **lado** (perfil) no A/D — tentado e **revertido** 22/06 (ficou estranho; A/D volta a espelhar o rosto de frente). *requer spritesheet real do avatar pra ficar bom*
- [x] **M2** **Boost no Shift** + carrinho sob o avatar (sincronizado na rede). FEITO 22/06.

---

## 🎨 1. Arte / visual 2.5D (estilo Stardew) — *quase tudo feito*
> Billboards, avatar fofo, y-sort, sombras e customização já feitos. `docs/PLANO-arte-2.5d.md`.
- [x] **Y-sort + sombras** — profundidade (avatar passa atrás/na frente; sombra na base). FEITO 22/06.
- [x] **Hint de volume** nos objetos em pé (topo claro/base escura). FEITO 22/06 (1ª passada).
- [x] **Mais customização** — acessório (óculos/chapéu) + +tons de pele e cores. FEITO 22/06.
- [ ] **Objetos com base+altura "real"** (árvore tronco+copa subindo, etc.) — redesenho por tipo. *grande, precisa iteração visual*
- [ ] **Avatar art completa** — spritesheets desenhadas (4 direções, walk frames). *grande, precisa decisão+arte*

## 🛠️ 2. Editor — refinos
> `docs/PLANO-editor-melhorias.md`.
- [ ] **Undo/redo** + validações (spawn válido, sem sobreposição). *médio*
- [ ] Alternar colisão de objeto já colocado já existe; falta **poltrona** como sentável. *quick-win*

## 🔌 3. Estações funcionais — *ligar objetos a ferramentas reais*
> Hoje abrem modal genérico "em breve".
- [x] **Jukebox** = música. FEITO 30/06 — fila dinâmica via link do YouTube (`yt-dlp`), storage
      permanente no Google Drive (`rclone`, remote `gdrive:kairos-music`, reaproveitado dos backups
      do Minecraft), cache local quente com limite de 10GB/LRU, toggle sala/proximidade, sincronizado
      por timestamp entre quem ouve. Detalhe: `docs/PLANO-jukebox.md`.
- [ ] **Lousa** = whiteboard · **Mesa** = workspace/tarefas · **Estante** = notas. *médio cada*

## 🎙️ 4. Voz / vídeo (WebRTC) — *só áudio existe hoje*
- [ ] **Vídeo** por proximidade (além do áudio). *grande*
- [ ] **Indicador de "quem está falando"** (nível de áudio). *médio*
- [ ] Aprofundar confiabilidade do mic (já tem botão reconectar). *médio* — `docs/PLANO-hardening-e-login.md`

## 🔐 5. OAuth Google/GitHub — *código pronto, BLOQUEADO no Icaro*
- [ ] Criar os apps OAuth (Google Cloud + GitHub) e por as creds no `.env` do servidor
      (`GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`). Aí trocar os botões "em breve" por reais.

## 🧹 6. Polimento / débitos técnicos
- [ ] **Performance**: culling + throttle de rede (muitos jogadores). *médio*
- [x] **Hardening XSS completo**: auditado (02/07/2026) — `grep -rn "v-html\|innerHTML" kairos-ui/src` retorna vazio; chat, nomes de jogadores e feedback já passam por interpolação Vue padrão (`{{ }}`), que escapa HTML automaticamente. Nenhuma remoção necessária.
- [ ] Decisões em aberto da multi-tenancy (1 org/usuário vs multi-org; clonar templates). *futuro*

## 💡 7. Backlog / não agendado
- **NPCs com LLM** — só ideia, fora do plano atual.
- **Economia / dinheiro** — ❌ recusado.

---

## Ordem sugerida
**Bugs/UX/movimento:** ✅ concluído (B1, B2, B4, B3, M2, M1 — 22/06).

**Agora (features):** `Estações funcionais` → `Vídeo + indicador de fala` → `Editor undo/redo`
→ `Objetos com volume real` → `Performance`. → `Spritesheets do avatar` quando decidir a arte.

**Bloqueado em você:** OAuth (criar apps + creds).
