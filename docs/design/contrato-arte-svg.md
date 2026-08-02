# Contrato de arte — SVG dos móveis

> Aprovado em 02/08/2026. Vale para as DUAS fontes (escrito à mão e gerado via `agy`).
> Quebrar qualquer regra aqui invalida a comparação — os dois lotes têm que sair
> sob as mesmas restrições, senão o que se compara é o prompt, não o resultado.

## Formato

- `viewBox="0 0 100 100"`, sempre. O carregador escala para `o.w × TILE` × `o.h × TILE`.
- O arquivo contém **apenas o conteúdo interno** do SVG — sem a tag `<svg>` externa,
  sem `<?xml?>`, sem `<!-- comentários -->`.
- Nada de `<defs>`, `<filter>`, `<mask>`, `<clipPath>` ou gradiente. O
  `GraphicsContext.svg()` do Pixi não garante suporte a esses, e o que ele ignora
  some sem erro.

## Projeção

O Kairos é 2.5D com billboards ancorados na base e profundidade por Y.

- Vista **frontal levemente elevada** (tipo Stardew Valley). Nunca top-down puro,
  nunca isométrico — isométrico encaixa errado no y-sort e não tem conserto no código.
- O objeto **apoia em `y=100`**. O que toca o chão (pés, base, rodas) fica nessa linha.
- Largura útil de `x=0` a `x=100`, sem margem sobrando dos lados.

## Luz

- **Uma** direção só: topo-esquerda.
- Face esquerda mais clara, direita mais escura, topo mais claro que a frente.
- Sombra de contato: elipse achatada em `y≈97`, escura, `opacity` entre 0.4 e 0.6.

## Paleta — enumerada, não livre

Usar **somente** estes valores. Cor fora da lista quebra o tema e impede a camada de
iluminação futura de tintar de forma previsível.

| Papel | Cor |
|---|---|
| Sombra/contorno | `#141024` |
| Escuro | `#1d1833` |
| Base | `#251f3d` |
| Médio | `#342b54` |
| Claro | `#483c73` |
| Destaque | `#5d4e94` |
| Luz | `#7362b3` |
| Brilho | `#8c7ae6` |
| Madeira escura | `#352b1a` |
| Madeira clara | `#5a4a32` |
| Metal escuro | `#2e3545` |
| Metal claro | `#7888a0` |

## Orçamento de detalhe — a regra mais importante

Um móvel renderiza entre **32px e 96px** na tela. Detalhe abaixo de ~2px vira ruído.

- **Máximo de 24 formas** por móvel.
- Sem `stroke` menor que 1 (no espaço do viewBox de 100). Preferir forma preenchida
  a contorno fino.
- Sem detalhe que dependa de ser lido isoladamente: costura, parafuso, textura de
  tecido, reflexo pequeno. Nada disso sobrevive a 32px.
- Silhueta acima de tudo: o objeto tem que ser reconhecível **pelo contorno**, porque
  é isso que se enxerga no tamanho real.

## Proporção

Os tipos aparecem em proporções bem diferentes no mesmo mundo (estante `2×6` e `3×2`,
cerca-viva `6×1` e `1×5`). O SVG é desenhado na proporção **canônica** de cada tipo
(ver `catalog.ts`) e o carregador estica. Consequência prática: evitar elemento cuja
deformação seja óbvia — círculo perfeito vira elipse ao esticar.

## Fora deste contrato

- `custom` — é pixel art desenhada pelo usuário no editor (`o.pixels`). Não recebe SVG.
- Grupo B (tapete, painel, grama, água, caminho, flor) — são superfícies de área
  variável, tratadas por tile que repete, não por sprite único. Contrato próprio.
