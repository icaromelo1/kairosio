# Kairos — O que ainda falta

> Lista enxuta e organizada do que está **pendente** (a maior parte do roadmap já foi feita).
> Atualizado: 2026-06-22. Specs detalhados nos outros `docs/PLANO-*.md`.

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
- [ ] **Lousa** = whiteboard · **Jukebox** = música · **Mesa** = workspace/tarefas · **Estante** = notas. *médio cada*

## 🎙️ 4. Voz / vídeo (WebRTC) — *só áudio existe hoje*
- [ ] **Vídeo** por proximidade (além do áudio). *grande*
- [ ] **Indicador de "quem está falando"** (nível de áudio). *médio*
- [ ] Aprofundar confiabilidade do mic (já tem botão reconectar). *médio* — `docs/PLANO-hardening-e-login.md`

## 🔐 5. OAuth Google/GitHub — *código pronto, BLOQUEADO no Icaro*
- [ ] Criar os apps OAuth (Google Cloud + GitHub) e por as creds no `.env` do servidor
      (`GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`). Aí trocar os botões "em breve" por reais.

## 🧹 6. Polimento / débitos técnicos
- [ ] **Performance**: culling + throttle de rede (muitos jogadores). *médio*
- [ ] **Hardening XSS completo**: auditar render de conteúdo de usuário (garantir zero `v-html`). *quick-win*
- [ ] Decisões em aberto da multi-tenancy (1 org/usuário vs multi-org; clonar templates). *futuro*

## 💡 7. Backlog / não agendado
- **NPCs com LLM** — só ideia, fora do plano atual.
- **Economia / dinheiro** — ❌ recusado.

---

## Ordem sugerida (por impacto)
`Arte 2.5D (y-sort+sombras)` → `Estações funcionais` → `Vídeo + indicador de fala` →
`Editor undo/redo` → `Performance`. OAuth você destrava quando criar os apps.
