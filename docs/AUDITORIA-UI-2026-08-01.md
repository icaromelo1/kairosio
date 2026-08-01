# Auditoria de UI — página renderizada — 01/08/2026

Medição com harness próprio (`docs/audit/measure.js`) injetado na build de produção,
sessão autenticada (Arroz / `voce@email.com`), viewport 1470×835.

Limiares: fonte mínima 10px · alvo mínimo 24×24 (WCAG 2.2 AA) · alvo recomendado
44×44 · contraste 4.5:1 (3.0:1 para texto grande).

## Medições válidas

| Superfície | Fontes <10px | Alvos <24 | Alvos <44 | Falhas de contraste |
|---|---|---|---|---|
| `/game` base | 6 | 3 | 15 | 9 |
| painel personagem | 12 | 3 | 36 | 22 |
| painel amigos | 7 | 3 | 23 | 9 |
| painel admin | 7 | 3 | 23 | 13 |
| painel feedback | 9 | 3 | 21 | 9 |
| editor de mundo | 0 | 2 | 33 | 3 |
| `/login` | 2 | 6 | 2 | 11 |
| `/register` | 0 | 1 | 0 | 9 |

A sidebar contribui um piso constante de ~6 fontes miúdas e ~9 falhas de contraste
em todo estado do jogo — corrigir nela derruba o número em todas as telas de uma vez.

## Achados por severidade

### Crítico

1. **Deep link de painel só funciona em carga fria.** `?abrir=<painel>` é lido apenas
   na montagem do `GamePage`, não é observado. Navegação interna muda a URL e não abre
   nada. Isso quebra os redirects legados do router (`/character`, `/admin`,
   `/feedback`, `/onboarding` → `gameWithPanel`) quando disparados de dentro do app.
   Verificado: carga completa abre o painel e consome a query; `router.push` da mesma
   query não abre.

2. **`span.ss-me-hint` ("editar avatar") falha duas vezes** — 7px E contraste 2.25:1.
   Presente em todo estado do jogo.

3. **6 alvos abaixo do mínimo 24×24 no `/login`** — `input.k-checkbox` 16×16,
   `a.forgot-link` 102×20, "Criar conta →" 79×16, "termos" 38×17, "privacidade" 62×17.

### Maior

4. **Links do rodapé do login em 2.29:1** (termos · privacidade · discord) — menos da
   metade do exigido.
5. **"ou continue com" em 2.11:1**; `ss-world-count-zero` e `ss-person-you` ("você")
   também em 2.11:1.
6. **`gp-hud-sep` ("·") em 2.26:1** — 3 ocorrências no HUD inferior.
7. **`button.ss-world-caret` 20×24** — 3 ocorrências, abaixo do mínimo.
8. **Painel personagem com 22 falhas de contraste e 36 alvos abaixo de 44** — o pior
   de todas as superfícies medidas.

### Menor

9. `div.ss-label` ("Mundos", "Ações") em 4.34:1 — perto do limite, falha por pouco.
10. Rótulos do `/register` em 4.34:1 — mesmo caso, afeta 9 elementos.

## Contraste sobre o canvas (medido analiticamente)

A leitura de pixel do canvas **falhou**: o contexto WebGL do Pixi não tem
`preserveDrawingBuffer`, então `drawImage` devolveu o buffer limpo (`[13,13,20]`
chapado) em vez da cena. Screenshot confirma que o mapa tem conteúdo — a medição
por pixel foi descartada.

Caminho alternativo: extraí a paleta do mapa do código-fonte (49 cores em
`src/game/`) e calculei o pior caso analiticamente.

As 10 cores de nome do chat, contra as cores mais claras do mapa
(`0xffffff`, `0xf4f4f8`, `0xe8e8f0`):

| Cor | Contraste vs branco |
|---|---|
| `#fca5a5` | 1.90:1 |
| `#c4b5fd` | 1.85:1 |
| `#f9a8d4` | 1.81:1 |
| `#f0abfc` | 1.76:1 |
| `#7dd3fc` | 1.67:1 |
| demais | 1.40–1.69:1 |

**As 10 falham.** O chat não tem fundo nenhum (`rgba(0,0,0,0)`), então o texto fica
direto sobre o mapa.

Ressalva honesta: `0xffffff` estar na paleta não prova que exista superfície branca
grande o bastante para o texto do chat cair em cima. O mapa visível é
predominantemente escuro, mas há objetos claros (o screenshot mostra um no canto
superior direito). O risco é real e condicional à posição do jogador.

Correção que resolve independente da posição: dar um fundo semitransparente escuro
ao `.gp-chat`, ou contorno/sombra no texto. Isso torna o contraste independente do
mapa — e é o que qualquer jogo com HUD sobre cenário faz.

## O que NÃO foi medido

- **Landing deslogada** — `/` redireciona para `/game` com sessão ativa.
- **Varredura responsiva** — `resize_window` não alterou a viewport (seguiu
  1470×835); qualquer número de 320/375px seria falso.
- **6 painéis** — DM, jukebox, sala de voz, tarefas, notas, lousa.
- **AccessLint** — plugin instalado nesta sessão; skills só registram na próxima.
- **Ordem de tab e visibilidade de foco** — o harness coleta os focáveis, mas
  validar a ordem exige interação real, não medição estática.

## Correções já aplicadas nesta rodada

- Escala de espaçamento em token (`--sp-2` … `--sp-32`) em `tokens.css` — não existia
  nenhuma, era a raiz da inconsistência de margin/padding.
- 16 valores fora de grade normalizados em 8 arquivos (3px, 5px, 7px, 9px, 30px).
