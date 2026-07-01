# Plano — Responsividade (telas pequenas / zoom do navegador)

> Origem: feedback do Icaro — em zoom alto do navegador ou telas menores, layouts
> ficavam comprimidos demais ou elementos se sobrepunham. Status: ✅ **implementado
> 01/07/2026**.

## Diagnóstico

Só existiam 4 media queries em todo o app antes deste trabalho (`CharacterPage`,
`FeedbackPage`, `OnboardingPage`, e uma no `GamePage` só pra detectar touch). Quase
tudo era layout fixo em pixels — zoom do navegador reduz os mesmos "px de CSS"
disponíveis que uma tela menor, então o efeito é idêntico e escancarava:

- **`GamePage.vue`**: sidebar de 256px fixa no grid, deixando quase nada pro palco em
  telas estreitas; HUD todo em `position:absolute` com offsets fixos, sem consciência
  de colisão entre si (card do jogador, lista de online, chat, botão de voz, dica de
  teclas, controles touch podiam se sobrepor).
- **`EditorPage.vue`**: mesmo problema, sidebar de 240px fixa sem nenhum breakpoint.
- **`JukeboxPanel.vue`**: linhas de botões com `no-wrap` (Quasar) que não cabiam lado
  a lado em telas muito estreitas.
- **`MapSelectPage.vue`**: padding fixo de 32px + grid `minmax(280px,...)` causava
  overflow horizontal em telas menores que ~344px.
- **`CharacterPage.vue`**: já tinha um breakpoint em 820px empilhando as colunas, mas
  `name-input` (260px fixo) e o padding do `stage-col` ainda apertavam em telas muito
  estreitas dentro desse layout empilhado.

## Implementado

### `GamePage.vue`
- Sidebar aberta vira **overlay flutuante** (`position: fixed`) abaixo de 768px, em
  vez de expandir a coluna do grid — o palco sempre ocupa o resto da tela.
- Abaixo de 768px: esconde a lista de nomes online (mantém só a contagem), esconde
  rótulos auxiliares do botão de voz (dica/reconectar), aproxima os offsets do chat/voz
  das bordas (16px→12px).
- Abaixo de 480px: esconde a dica de teclas (WASD/B/G) — redundante com os controles
  touch que já aparecem em dispositivos sem mouse.
- `.gp-chat` passa de `width: 280px` fixo pra `width: min(280px, calc(100vw - 32px))`.

### `EditorPage.vue`
- Sidebar de 240px vira **overlay escondido por padrão** abaixo de 768px (estado novo
  `sidebarOpen`, default `false` só importa nesse breakpoint) — o canvas do editor
  ocupa a tela inteira; botão flutuante `☰`/`✕` (só visível `<768px`) abre/fecha por
  cima do canvas.

### `JukeboxPanel.vue`
- Abaixo de 420px: as linhas `row no-wrap` (link+add, biblioteca+sync,
  aleatória+tocar todas) passam a quebrar linha normalmente; padding do overlay e do
  card reduzido.

### `MapSelectPage.vue`
- Abaixo de 480px: padding do root cai de 32px pra 16px, título reduz de 36px pra
  26px, grid de cards força 1 coluna (evita depender do `auto-fit` respeitar o
  `minmax(280px,...)` numa tela menor que isso).

### `CharacterPage.vue`
- `name-input`: `width: 260px` fixo → `width: min(260px, 100%)`.
- Abaixo de 400px (dentro do layout já empilhado por `@media (max-width: 820px)`):
  padding do `stage-col` cai de 32px pra 16px.

## Padrão adotado daqui pra frente

- Breakpoint principal: **768px** (empilha sidebars/grids de duas colunas).
- Breakpoint secundário pra ajustes finos de telas muito pequenas: **400-480px**.
- Qualquer largura fixa em `px` num elemento que pode ficar maior que a tela deve
  usar `min(Npx, 100%)` (ou equivalente) em vez de um valor fixo cru.
- HUDs sobrepostos (`position: absolute/fixed`) precisam ser revisados quanto a
  colisão mútua sempre que ganharem um elemento novo — não é automático.
