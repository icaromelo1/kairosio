# Plano — px→rem + redução de classes customizadas

> Origem: feedback do Icaro — "está usando muito px em vários locais, use rem
> (relativo ao tamanho de tela/fonte)" + "muitas classes personalizadas, reduzir
> ao máximo reaproveitando algo já existente". Status: ✅ **implementado
> 02/07/2026** (px→rem 100% do projeto; redução de classes feita nos arquivos
> de maior duplicação — ver notas de execução no final).

## Parte 1 — px → rem

### Diagnóstico
~715 valores de `px` em 20/26 arquivos de `kairos-ui/src`, 83% concentrado em:
`GamePage.vue` (130), `CharacterPage.vue` (90), `FeedbackPage.vue` (65),
`EditorPage.vue` (65), `tokens.css` (64), `AdminPage.vue` (62).

### O que NÃO converte (não é CSS de layout, é constante de renderização)
- `TILE_PX = 40` em `game/pixi/scene.ts` — tamanho de tile do jogo, matemática de
  coordenadas, não CSS.
- `viewBox`/`width`/`height` de `<svg>` em `PixelAvatar.vue`, `PixelColumn.vue`,
  `MeanderBorder.vue` — coordenadas de desenho, não layout de página.
- Ajustes de sub-pixel em `@keyframes` (ex: `translateY(-1px)` do avatarBob).

### Base de conversão
**Sem** sobrescrever `html { font-size }` — deixar herdar o padrão do
navegador/SO (que já é 16px, mas escala se a pessoa mudar as configurações de
acessibilidade). Se fixássemos em CSS, perderíamos exatamente o ganho de usar
rem. Conversão: `valor_px / 16 = valor_rem`.

### Ordem
1. `tokens.css` (variáveis: `--ui-border-style`, `--ui-shadow`, glows, scrollbar).
2. **P0**: `GamePage.vue`, `CharacterPage.vue`, `FeedbackPage.vue`,
   `EditorPage.vue`, `AdminPage.vue`.
3. **P1**: `LoginPage.vue`, `JukeboxPanel.vue`, `LandingPage.vue`,
   `OnboardingPage.vue`.
4. **P2/P3**: `MapSelectPage.vue`, `RegisterPage.vue`, `VoicePanel.vue`,
   `LabPage.vue`, logos.
5. Padrões `min(Npx, ...)` já usados pra responsividade — converter o `px` de
   dentro também (ex: `min(280px, 100%)` → `min(17.5rem, 100%)`).

## Parte 2 — reduzir classes customizadas

### Diagnóstico
~398 classes CSS `scoped` customizadas, concentradas nos mesmos arquivos do
P0/P1 acima. Padrões que se repetem quase idênticos em 3+ arquivos, cada um
reinventado com prefixo próprio:

| Padrão repetido | Onde aparece hoje | Novo utilitário em `tokens.css` |
|---|---|---|
| Botão pequeno/extra-pequeno | `.jb-btn-sm/xs`, `.photo-btn`, `.back-btn`, botões do editor | `.k-btn-sm`, `.k-btn-xs` |
| Badge de status | `.fb-status.*` (aberto/em_andamento/resolvido/recusado), `.ad-role.*`, `.jb-status` | `.k-badge` + `.k-badge-success/warning/error/info` |
| Texto secundário/hint | `.gp-hud-hint`, `.gp-voice-hint`, `.photo-hint`, `.fb-intro`, `.ms-muted` | `.k-hint-text` |
| Estado ativo/selecionado | `.tab-btn.active`, `.fb-kind.on`, `.ed-tool.on`, `.ed-obj.on`, `.ad-tab.on`, `.acc-btn.on`, `.jb-btn-active` (~6 lugares quase idênticos) | `.k-active` (modificador) |
| Swatch de cor | `.swatch-btn/inner/big` (CharacterPage), `.ed-swatch` (Editor) | `.k-swatch` (+ modificador de tamanho/ativo) |
| Variante de input | `.jb-input`, `.ed-input`/`.ed-num`, `.name-input` | `.k-input-xs`, `.k-input-sm` |

Só esses ~6 utilitários eliminam 60-80 classes duplicadas.

### Classificação do restante (~330 classes fora dos padrões acima)
- **~100-120** só fazem layout/espaçamento que Quasar já cobre (`row`,
  `q-gutter-*`, `q-pa-*`, `text-*`) — trocar direto, sem criar nada novo.
- **~130-180** genuinamente únicas — HUD/overlay do jogo (`.gp-hud-*`,
  `.gp-modal-overlay`, `.gp-touch-ctl`), chat (`.gp-chat-*`), editor de pixel
  (`.ed-pixel-grid/cell`), grid de estilos de cabelo, cursores customizados,
  animações/glow. Ficam como estão.

### Ordem de execução (junto com a Parte 1, mesmo arquivo/mesmo passe)
Fazer px→rem e troca de classe **no mesmo arquivo, na mesma passada** — evita
reabrir o mesmo `<style scoped>` duas vezes:

1. `tokens.css` — converte variáveis pra rem **e** adiciona os 6 utilitários novos.
2. Por arquivo (mesma ordem P0→P1→P2/P3 da Parte 1): converte px→rem e troca
   classe local duplicada pelo `k-*`/Quasar equivalente, removendo a definição
   antiga do `<style scoped>`.
3. Build (`npm run build`) + checagem visual por arquivo antes de seguir pro
   próximo — mesmo padrão já usado nas sessões anteriores (browser automation
   pra confirmar visualmente, não só compilar).

## Status
- [x] Mapeamento de px (Explore agent)
- [x] Mapeamento de classes customizadas (Explore agent)
- [x] Fase 1: tokens.css — rem + `.k-btn-sm/xs`, `.k-badge*`, `.k-hint-text`, `.k-active`, `.k-swatch*`, `.k-input-xs/sm`
- [x] Fase 2 (P0): GamePage, CharacterPage, FeedbackPage, EditorPage, AdminPage
- [x] Fase 3 (P1): JukeboxPanel (consolidado); LoginPage/LandingPage/OnboardingPage (px convertido, classes revisadas)
- [x] Fase 4 (P2/P3): px convertido em 100% do projeto (MapSelectPage, RegisterPage, VoicePanel, LabPage, logos)

### Notas de execução
- **px→rem**: conversão automatizada (script local, `valor/16`) rodada em TODOS
  os `<style scoped>` do projeto + nos poucos casos de `:style` inline com string
  literal (`CharacterPage.vue` swatches, `LoginPage.vue` parágrafos, `LogoMonogram.vue`/
  `LogoTerminal.vue` que montam CSS a partir de props numéricas). Confirmado
  0 `px` restante fora dos casos documentados como exceção (TILE_PX, viewBox de
  SVG, `-1px` do keyframe do avatar, comentários).
- **Correção sobre o plano original**: `border-radius: 999px` (hack de "pílula")
  em elementos de largura=altura igual (`.vp-dot`, `.photo-preview`) virou `50%`
  em vez de rem — mais correto semanticamente que carregar um valor gigante em
  rem. Ficou só em `tokens.css`/scrollbar (onde é elemento não-quadrado, o hack
  em px genuinamente não precisa escalar).
- **Redução de classes**: aplicado `.k-active` (substituindo `.active`/`.on`
  locais) em `CharacterPage`, `FeedbackPage`, `EditorPage`, `AdminPage`,
  `GamePage`; `.k-badge` + variantes em `FeedbackPage`/`AdminPage`;
  `.k-hint-text`/`.k-btn-sm`/`.k-input-xs` em `CharacterPage`/`JukeboxPanel`.
  Padrões deixados como estão intencionalmente (não são duplicatas de verdade):
  `.gp-voice-btn-on` (verde de "conectado", semântica diferente de seleção),
  `.tab-btn.active`/`.acc-btn.on` (visual de segmented-tab/ring distinto),
  `.swatch-btn/inner` (arquitetura de 2 elementos + `:style` dinâmico, mudar pra
  `.k-swatch` exigiria refatorar a estrutura — risco maior que o ganho),
  `.ed-input`/`.gp-hud-hint` (paleta ou tamanho ligeiramente diferentes do
  utilitário genérico).
- **Verificação visual**: build (`npm run build`) limpo após cada arquivo. Não
  foi possível confirmar visualmente em browser nesta sessão (extensão do
  Claude in Chrome não conectada) — recomendo o Icaro dar uma conferida visual
  nas páginas principais (Character, Feedback, Editor, Admin, Game, Jukebox)
  antes de considerar 100% fechado.
