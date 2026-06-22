# Plano — Câmera (zoom / rotação) e melhoria de estilo

> Origem: ideia do Icaro — câmera com **zoom in / zoom out** e **rotação**, algo mais
> parecido com **Don't Starve Together** ou **Stardew Valley**. Serve também à ideia de
> **melhorar o estilo/feel** do jogo (a câmera mais viva já muda muito a sensação).
> Status: planejado. Base: render no PixiJS (`game/pixi/scene.ts`), câmera = `world` container.

---

## 1. Zoom (in / out)
- A câmera já é o container `world` (escala 1 hoje). Zoom = alterar `world.scale`.
- **Controles:** scroll do mouse (wheel) e/ou botões + / − no HUD; pinch no mobile (futuro).
- **Limites:** `minZoom`/`maxZoom` (ex: 0.6 a 2.0) pra não perder o avatar nem pixelizar demais.
- **Foco:** zoom centrado no avatar (a câmera já segue o player no `follow`). Ajustar o
  `follow` pra considerar a escala atual ao centralizar.
- Persistir o zoom escolhido (localStorage) é um plus.

## 2. Rotação da câmera
- Girar o mundo (ex: 0/90/180/270 — ou livre) pra ver atrás de objetos altos, estilo DST.
- Pixi: rotacionar o container `world` (`world.rotation`) **ou** uma câmera com pivot no
  avatar. **Cuidado:** rotação livre complica (sprites/avatar precisam contra-rotacionar pra
  não ficar de cabeça pra baixo; colisão/tiles continuam no grid). Recomendado começar por
  **rotação em passos de 90°** (mais simples e suficiente pro caso de "ver atrás").
- Decisão a confirmar: **rotação em 90°** (simples) vs **livre** (mais imersivo, bem mais trabalho).
- A conversão tela→tile (movimento/editor) precisa considerar a rotação.

## 3. Relação com "melhoria de estilo"
- Câmera viva (zoom + leve rotação) já dá um ar mais "joguinho" (DST/Stardew).
- Outras melhorias de estilo a casar aqui (ver feedbacks): proporções (✅), cabeça mais fofa,
  sombras/iluminação, parallax leve no fundo, transições suaves.

## 4. Tarefas
1. **Zoom** com wheel + botões + limites + foco no avatar (scene + HUD). — *médio*
2. Persistir zoom (localStorage). — *quick-win*
3. **Rotação 90°** do mundo + ajuste do tela→tile (movimento e editor). — *médio/grande*
4. (futuro) pinch/zoom mobile; rotação livre.

## 5. Critérios de aceite
- Scroll/+/− dá zoom suave, centrado no avatar, dentro dos limites.
- Girar a câmera 90° mantém movimento e cliques (editor) corretos.

## 6. A confirmar
- Rotação: passos de 90° ou livre?
- Zoom: faixa de limites e se persiste por usuário.
