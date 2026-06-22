# Plano — Bugs, UX e movimento (mapeado 22/06)

> Itens trazidos pelo Icaro direto (não pelo canal `/feedback`). Cada um com diagnóstico
> + abordagem proposta. Status: mapeado (a implementar).

---

## 🐞 Bugs

### B1. Botões ficam "clicados" (focados) → Enter reaciona
- **Sintoma:** ao clicar num botão, ele fica **com foco**; depois, apertar **Enter** dispara
  o botão focado de novo (ação repetida sem querer).
- **Causa:** comportamento nativo — `:focus` permanece no botão após o clique; Enter ativa o
  elemento focado.
- **Abordagem:** **blur** após o clique. Opções (escolher 1):
  - Global: handler em `mouseup`/`pointerup` que faz `document.activeElement?.blur()` quando o
    alvo é `<button>` (um plugin/diretiva pequeno, aplica em todas as telas).
  - CSS `:focus:not(:focus-visible)` pra não mostrar o anel em clique de mouse (não resolve o
    Enter sozinho — precisa do blur também).
- **Aceite:** clicar num botão e apertar Enter **não** repete a ação.

### B2. Selecionar o mundo em que já estou cria outra sessão → fico sozinho
- **Sintoma:** abrir o seletor e escolher o **mesmo mundo** atual recria a sessão/sala;
  se havia gente comigo, eu "sumo" e preciso de **F5** pra voltar.
- **Causa:** o handler de seleção chama o fluxo de troca/conexão sem checar se é o mundo atual
  (re-join na sala recria o estado).
- **Abordagem:** no GamePage (handler do map-select / `switchMap`), **guard**: se
  `id === currentId.value`, apenas fechar o seletor (no-op) — não reconectar nem re-join.
- **Aceite:** escolher o mundo atual não derruba ninguém nem reseta a sala.

### B3. Câmera — remover rotação, centralizar no zoom e adicionar pan (decidido 22/06)
> **Decisão do Icaro:** **tirar a rotação** de tela; em vez disso, (1) manter o personagem
> **sempre centralizado** no zoom in/out e (2) permitir **arrastar a câmera** com **Espaço + clique
> esquerdo** (pan estilo "clicar e arrastar").

- **B3.1 — Remover a rotação:** apagar o botão ↻ e toda a lógica de `rotation`/contra-rotação
  no `scene.ts` (e o remap de movimento no `GamePage`). Mantém billbords/sombras/y-sort.
  - *Cuidado:* os objetos "em pé" e avatares hoje contra-giram em função da rotação — ao remover,
    simplificar (rotação some, billboards ficam fixos em pé).
- **B3.2 — Zoom centralizado no personagem:** hoje o zoom **não** mantém o avatar centralizado
  (o `follow` clampa nas bordas do mapa, então perto da borda o boneco "desce" pro canto).
  - **Abordagem:** ao dar zoom, **centralizar no avatar** (zoom "pivota" no personagem). Relaxar/
    remover o clamp de borda quando o foco é o jogador, ou ancorar a escala no avatar.
  - **Aceite:** dar zoom in/out mantém o personagem no centro da tela.
- **B3.3 — Pan com Espaço + clique esquerdo (arrastar a câmera):** segurar **Espaço** e
  **arrastar com o botão esquerdo** desloca a câmera livremente (offset de pan), pra olhar outra
  parte do mundo sem mover o personagem.
  - **Abordagem:** estado `panOffset {x,y}` somado à posição da câmera no `follow`; ativa com
    `keydown Space` + `pointerdown/move` (acumula o delta do mouse); **ao soltar o Espaço, a câmera
    volta a seguir/centralizar o personagem** (zera o offset). Cursor vira "grab" enquanto ativo.
  - *Atenção:* enquanto o pan está ativo, **não** mover o personagem com as teclas de movimento
    (ou manter, mas a câmera fica solta) — definir: Espaço pressionado = modo "olhar".
  - **Aceite:** Espaço+arrastar move a vista; soltar Espaço recentra no personagem.
- Liga em `docs/PLANO-arte-2.5d.md` e `docs/PLANO-camera-e-estilo.md`.

### B4. Falta scroll — telas com `height` fixo cortam conteúdo
- **Sintoma:** na página inicial (e outras) o conteúdo **sai da tela** e fica inacessível por
  não ter scroll. Recorrente.
- **Abordagem:** **auditar todas as telas** e trocar `height` fixo / `100vh` sem overflow por
  layout **scrollável** (`min-height` + `overflow-y: auto`; evitar travar a altura).
  - Telas a revisar: **Landing**, Login, Register, **Character**, Onboarding, Admin, Feedback
    (lista já tem scroll), **MapSelect**, e os modais/HUD do Game.
- **Aceite:** em qualquer tela, conteúdo que ultrapassa a viewport fica acessível por scroll.

---

## ✨ Melhorias — movimento / avatar

### M1. Virar de lado no A/D (não só de costas no W)
- **Hoje:** W (cima) mostra a **nuca** (de costas); A/D só **espelham** a vista de frente
  (ainda mostram o rosto).
- **Quer:** ao andar pra **esquerda/direita**, o boneco aparecer **de lado** (perfil), coerente
  com a ideia de direções — ou ao menos uma **animação/visual** de lado.
- **Abordagem:** pose/arte de **perfil** pro `facing left/right` (esconder um olho, silhueta de
  lado), além do espelhamento que já existe. Mexe no `avatar.ts` (`setFacing` + desenho do rosto/cabeça).
- **Aceite:** andar de lado mostra o personagem de perfil (não de frente espelhado).

### M2. Boost de velocidade no Shift (estilo "carrinho" do Gather)
- **Quer:** segurar **Shift** → **acelerar**. Pode spawnar um **carrinho embaixo** do personagem
  (igual o Gather) simulando andar de carrinho.
- **Abordagem:**
  - Movimento: enquanto `Shift` pressionado, `sp *= ~1.8` (no loop do GamePage).
  - Visual (opcional): renderizar um **carrinho** sob o avatar enquanto acelera (sprite simples
    no `avatar.ts` ou um overlay no scene), some ao soltar.
  - Sincronizar na rede (os outros veem você "de carrinho") — pose/flag extra.
- **Aceite:** Shift acelera de forma perceptível; (se feito) carrinho aparece sob o boneco e os
  outros veem.

---

## Prioridade sugerida
B1 (rápido, incomoda) · B2 (rápido, bug chato de multiplayer) · B4 (auditoria de scroll, médio) →
M2 (boost, divertido) · M1 (perfil de lado) · B3 (rever rotação — precisa decisão).
