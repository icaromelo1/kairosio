# Plano — Melhorias do editor de mapa

> Origem: feedback do usuário ("mais opções de criação de mundo… paleta de cores pra criar
> meu próprio objeto, dizer se é colisão ou não, e rotacionar objetos").
> Base: editor já existe em `/editor/:id` (`EditorPage.vue`), schema em `game/maps.ts`,
> render em `game/pixi/scene.ts`. Status: planejado.

---

## 1. Toggle de colisão por objeto — **quick-win**
- No editor, ao selecionar um item da paleta (ou um objeto já colocado), um checkbox
  **"sólido (colisão)"**. Hoje cada item da paleta tem `solid` fixo no `PALETTE` do
  `EditorPage`; passar a permitir override por objeto.
- Schema já tem `MapObject.solid` — é só expor no editor e gravar.
- Tarefa: estado `solidSelecionado` + aplicar ao colocar; ao clicar num objeto existente,
  poder alternar.

## 2. Mais objetos na paleta — **quick-win**
- Adicionar kinds que faltam ao `PALETTE` (já existem no `ObjectKind`/render): `grass`,
  `panel`, variações. Revisar `drawDetail` no `scene.ts` pra cada um ter visual decente.

## 3. Rotacionar objetos — **médio**
- Adicionar `rotation?: 0|90|180|270` ao `MapObject` (schema).
- `scene.ts`: aplicar rotação ao desenhar (girar o `Graphics`/container do objeto).
- Editor: tecla **R** (ou botão) rotaciona o objeto selecionado / o "pincel" atual.
- Colisão: a hitbox por enquanto continua sendo o bounding box (retângulo) — rotação é
  visual; documentar que colisão fina por rotação fica pra depois.

## 4. Criador de objeto próprio (pixel + paleta) — **grande**
- Um mini-editor de pixel art (grid pequeno, ex: 8×8 ou 16×16) com **paleta de cores**.
- O usuário desenha → vira um objeto custom com:
  - a "arte" (matriz de cores) salva no objeto/num catálogo,
  - flag de **colisão**,
  - tamanho em tiles.
- Modelo de dados: ou (a) `MapObject` ganha um `pixels?: string[][]` (matriz de cores) que o
  `scene.ts` renderiza célula a célula; ou (b) um catálogo `CustomObject` por org/usuário
  (entidade nova) reutilizável em vários mundos. **Recomendado:** começar por (a) embutido no
  objeto (mais simples), evoluir pra (b) catálogo quando quiser reuso.
- `scene.ts`: novo branch de render que desenha a matriz `pixels`.
- Editor: aba "Criar objeto" com o canvas de pixel + paleta + salvar no "pincel".
- Considerar limites (tamanho da matriz) pra não explodir o payload do mundo.

---

## Ordem sugerida
`1 (colisão toggle)` → `2 (mais objetos)` → `3 (rotação)` → `4 (criador de objeto)`.
Os 3 primeiros são rápidos/médios e já atendem boa parte do feedback; o criador de objeto é
um épico próprio.

## Critérios de aceite
- Dá pra marcar/desmarcar colisão de um objeto e isso reflete no jogo.
- Dá pra rotacionar um objeto no editor e ele aparece girado no mundo.
- (criador) dá pra desenhar um objeto simples, marcar colisão e usá-lo no mundo.
