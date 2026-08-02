# Auditoria do catálogo SVG de móveis — 02/08/2026

## Entregue

| Item | Estado |
|---|---|
| Contrato de arte | `docs/design/contrato-arte-svg.md` |
| Catálogo + `GraphicsContext` compartilhado + fallback | `game/furniture/catalog.ts` |
| Superfícies com `TilingSprite` | `game/furniture/surfaces.ts` |
| 15 móveis escritos à mão | `game/furniture/svg-mine/` |
| 15 móveis gerados via `agy` | `game/furniture/svg-agy/` |
| 6 superfícies de chão | `game/furniture/svg-surface/` |
| Gerador parametrizado | `scripts/gen-svg-agy.sh` |
| Mundo de comparação 120×120 | `comparativo-svg`, 393 objetos |

## Validação automática — 30/30 aprovados

Critérios verificados por script em cada arquivo: paleta fechada (12 cores),
teto de 24 formas, `viewBox` na proporção canônica do tipo, ausência de
`<defs>`/`<filter>`/`<mask>`/gradiente.

```
svg-agy:  15/15 arquivos, 0 com problema
svg-mine: 15/15 arquivos, 0 com problema
```

Observação honesta: os 15 do `agy` passaram de primeira porque o `--json-schema`
e o prompt impunham as regras. **Os meus tiveram 3 violações de paleta** (`#adbdcf`,
`#c4b8ff`) — escrevi à mão sem rodar o validador antes. Corrigido, mas o episódio
mostra que a restrição automatizada funcionou melhor que a disciplina manual.

## Verificado renderizado

Faixa `mine` (metade inferior esquerda), em produção: mesas, cadeiras, estantes,
mesa redonda, cercas-vivas, luminárias, rack de servidores, planta e jukebox
renderizando pelos SVGs. **O fallback funciona** — tipos sem SVG continuam no
desenho vetorial antigo, sem buraco.

## O defeito que o portão pegou

A primeira versão do contrato exigia `viewBox` quadrado **e** "ocupar de x=0 a
x=100". Contraditório para objeto não-quadrado: uma cadeira `1×2` esticada para
40×80px comprime 2× na horizontal — no piloto virou um poste.

Corrigido: `viewBox` reflete a proporção canônica (cadeira `0 0 50 100`, mesa
`0 0 200 100`, estante `0 0 33 100`, cerca `0 0 600 100`), o carregador lê o
viewBox real do arquivo e o gerador é parametrizado por ele.

O piloto de 3 existia exatamente para isso — o defeito apareceu em 3 SVGs, não em 30.

## NÃO verificado

- **Faixa `agy` renderizada.** O cliente reescreve `world_states` na conexão, então
  não consegui posicionar o avatar em `x>=60` por script. Os 15 arquivos passam na
  validação automática, mas o resultado visual não foi confirmado.
- **As 6 superfícies renderizadas.** Mesmo motivo — dependem de estar na metade
  inferior do mapa.
- **Comparação estética entre as duas fontes.** É julgamento do Icaro, não medição.

Para ver: entrar no mundo "Comparativo SVG" e andar até a metade de baixo —
esquerda são os escritos à mão, direita os gerados.
