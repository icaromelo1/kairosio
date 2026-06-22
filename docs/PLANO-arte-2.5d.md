# Plano — Direção de arte 2.5D (perspectiva tipo Stardew / Don't Starve)

> Origem: Icaro — (1) avatar "mais fofo / mais pixelado", estilo **Stardew Valley**; (2) ao
> girar a câmera as **árvores ficam de cabeça pra baixo**. A causa raiz é a mesma:
> hoje o jogo é **2D totalmente plano** (objetos chapados no chão, estilo **Terraria**),
> e não um **"3D em 2D"** (perspectiva oblíqua, estilo Stardew/DST).
> Status: planejado (direção de arte/render). Impacto: alto (muda o "feel").

---

## 1. O problema (diagnóstico)

- **Hoje (2D plano):** piso, objetos e avatar são todos desenhados no mesmo plano do chão,
  vistos de cima. Não há noção de "altura" — uma árvore é uma mancha no grid.
- **Consequência da rotação:** girar a câmera gira TUDO junto → a árvore vira de ponta-cabeça
  (só o avatar contra-gira hoje). Fica estranho, tipo Terraria girado.
- **Stardew / Don't Starve ("3D em 2D"):** o **chão** é o plano que "gira"/tem perspectiva,
  mas **objetos e personagens são billboards** — têm uma **base** ancorada no tile e uma
  **altura** que sobe na tela, e ficam **sempre em pé virados pra câmera**.

## 2. Direção alvo

Migrar pra um look **2.5D oblíquo**:
- **Chão**: plano de tiles (pode ter leve perspectiva/profundidade).
- **Objetos = billboards**: base no tile + altura pra cima; **contra-giram** com a câmera
  (igual o avatar já faz) → nunca ficam de cabeça pra baixo.
- **Avatar = billboard** (já é) — só refinar a arte.
- **Y-sort** (ordenação por profundidade): quem está "mais embaixo" desenha na frente
  (avatar atrás da árvore some atrás dela). Já temos `sortAvatars` por Y — estender pros objetos.
- **Sombras** elípticas na base de objetos/avatares dão o "pé no chão".

## 3. Sub-itens

### 3a. Fix imediato da rotação (quick-win, tira o de-cabeça-pra-baixo)
- Desenhar cada objeto num container e **contra-girar** pela rotação da câmera (como os avatares),
  mantendo a **base** ancorada no tile. → some o efeito "Terraria girado".
- Objetos "de chão" (tapete, água, caminho, grama) NÃO contra-giram (são parte do piso);
  só os "em pé" (árvore, mesa, estante, fonte, poste, planta, cadeira...) viram billboard.
- Marca no schema: `MapObject` ganha `upright?: boolean` (ou derivar por `kind`).

### 3b. Avatar "mais fofo / mais pixelado" (estilo Stardew)
- Redesenhar a arte do avatar com **pixels maiores/chunky** e proporção mais fofa (cabeça
  um pouco maior, corpo compacto), paleta com contornos suaves.
- Decisão: continuar com o **boneco modular procedural** (refinar as partes/pixels) OU migrar
  pra **spritesheets** desenhadas (4 direções, walk frames) — mais fiel ao Stardew, mas exige
  arte. Recomendado: **refinar o procedural primeiro** (rápido), avaliar spritesheets depois.
- Itens concretos: pixels maiores, contorno mais suave, sombreamento simples, talvez 4 frames
  de caminhada por direção.

### 3c. Objetos com "altura" (billboard real)
- Render dos objetos "em pé" com **base** (elipse de sombra no tile) + **corpo** subindo na
  tela (ex: árvore = tronco na base + copa acima; mesa = tampo + pernas; etc.).
- Reaproveitar/expandir o `drawDetail` do `scene.ts` com essa lógica base+altura.

### 3d. Profundidade
- Y-sort de objetos + avatares juntos (um só `entityLayer` ordenado por Y da base).
- Sombras na base.

## 4. Tarefas (ordem)
1. **3a** billboard/contra-rotação dos objetos "em pé" + `upright` no schema. — *médio* (resolve o bug da rotação)
2. **3d** y-sort objetos+avatares + sombras. — *médio*
3. **3b** refinar arte do avatar (pixels maiores, fofo). — *médio*
4. **3c** objetos com base+altura no render. — *médio/grande*
5. (futuro) avaliar spritesheets desenhadas pro avatar.

## 5. Critérios de aceite
- Girar a câmera mantém árvores/objetos **em pé** (nunca de cabeça pra baixo).
- Avatar com cara mais "fofa/pixelada", coerente com o estilo Stardew.
- Avatar passa corretamente atrás/na frente dos objetos (y-sort).

## 6. A confirmar
- Avatar: refinar o boneco procedural ou partir pra spritesheets desenhadas?
- Quanto de "perspectiva" no chão (puramente top-down com billboards já resolve, ou inclinar o piso)?
