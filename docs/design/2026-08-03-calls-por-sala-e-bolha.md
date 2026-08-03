# Calls: sala fechada e bolha de proximidade

> Spec aprovado em 03/08/2026 via brainstorming. Estende
> `2026-08-03-audio-espacial-e-salas.md`, que entregou atenuação por distância e
> oclusão por parede/porta. Aqui o conceito de **call** passa a governar também
> vídeo e compartilhamento de tela.

## O que muda em relação ao que já existe

Hoje o áudio é espacial (curva contínua + oclusão), mas **vídeo e tela continuam
globais no mapa**: quem entra na voz recebe stream de todo mundo, esteja onde estiver.

A call resolve isso — e traz uma tensão que o spec precisa conciliar: o áudio atual é
**analógico** (mais alto/mais baixo), enquanto call é **binária** (pertence/não
pertence). A regra de convivência está em "Áudio" abaixo.

## Dois tipos de call

### Sala — fronteira fixa

Estar dentro de uma `area` coloca você na call daquela sala. A fronteira são as
paredes; não há raio.

Dentro, **todos em volume cheio**, independente da distância. É reunião: não faz
sentido a pessoa do outro lado da mesa sumir.

### Bolha — fronteira dinâmica

No mundo aberto, proximidade forma call automaticamente. Cada pessoa que entra
**aumenta o raio**, para que uma roda grande não expulse quem está na borda.

```
raio(n) = RAIO_BASE + INCREMENTO * (n - 1)     limitado a RAIO_MAX_BOLHA
```

| Constante | Valor |
|---|---|
| `RAIO_BASE` | 5 tiles |
| `INCREMENTO` | 1.5 tiles por pessoa extra |
| `RAIO_MAX_BOLHA` | 12 tiles |

**O cálculo é circular** — o raio depende de quantos estão na bolha, e quem está na
bolha depende do raio. Resolver por ponto fixo:

1. Ligar pares a até `RAIO_BASE` um do outro
2. Achar as componentes conexas desse grafo
3. Recalcular o raio de cada componente pelo seu tamanho
4. Repetir com o raio novo até a composição não mudar, ou 4 iterações

O limite de iterações evita oscilação em configurações patológicas; 4 basta para os
tamanhos de grupo realistas.

## Áudio

| Situação | Volume |
|---|---|
| Mesma sala | Cheio |
| Mesma bolha | Cheio |
| Fora da minha call | `curvaDistancia(d) × oclusão` — o que já existe |

Ou seja: **binário dentro, analógico fora**. Sair da bolha não corta o som — ele passa
a cair com a distância, exatamente como hoje. A oclusão de parede e o alívio da porta
continuam valendo para quem está fora da sala.

## Vídeo e tela

Binário — não existe "receber meio stream". Governado pela call, **com histerese**:

| Limiar | Valor |
|---|---|
| Entrar na call | 5 tiles (`RAIO_BASE`) |
| Sair da call | 8 tiles |

Sem histerese, duas pessoas conversando perto da fronteira causariam entra-e-sai
constante de stream — que no LiveKit é renegociação, não um ajuste de volume. Foi o
mesmo motivo pelo qual rejeitamos trocar de sala LiveKit ao cruzar a porta.

Para sala, a histerese não se aplica: a fronteira é a parede, e atravessá-la é um
ato deliberado.

## O que NÃO muda

**Avatares continuam visíveis** no mapa e no minimapa, de todo mundo, sempre. O que a
call escopa é a **mídia**, não o mundo.

Esconder avatares foi considerado e rejeitado: quebraria a navegação social (ver que
uma sala está cheia antes de entrar), esvaziaria o minimapa, e contradiria a decisão
de 02/08 de mostrar a planta inteira com contraste em vez de ocultação.

## Onde o cálculo mora

**No cliente**, como o áudio espacial já faz. Cada cliente tem as posições de todos
(`remotePlayers`) e a planta do mapa, então deriva a composição das calls localmente.

Consequência aceita: durante o instante em que as posições chegam dessincronizadas,
dois clientes podem discordar sobre quem está na bolha. Para áudio isso é
imperceptível; para vídeo significa que um lado pode assinar o stream um quadro antes
do outro. Autocorrige no quadro seguinte.

Alternativa rejeitada: cálculo autoritativo no servidor. Traria consistência, mas
exigiria o servidor conhecer a geometria do mapa (que hoje ele ignora por completo) e
recalcular componentes conexas a cada movimento.

## Impacto no código

| Arquivo | Mudança |
|---|---|
| `game/audio/calls.ts` *(novo)* | Componentes conexas, ponto fixo do raio, histerese |
| `game/audio/espacial.ts` | `ganhoDoPeer` passa a receber a call de cada lado |
| `pages/GamePage.vue` | Calcula as calls por quadro; decide assinatura de mídia |
| `services/media.livekit.ts` | Assinar/desassinar vídeo e tela por participante |

## Como testar

**Unitário** (matemática pura, via `npx tsx` — o front não tem runner):
- Duas pessoas a 4 tiles formam bolha; a 6, não
- Três pessoas em linha, espaçadas 6 tiles: a do meio conecta as pontas (o raio cresce)
- Ponto fixo converge e não oscila
- Histerese: entra a 5, continua dentro a 7, sai a 9

**Ponta a ponta** (dois clientes):
- Aproximar no aberto → vídeo aparece ao cruzar 5 tiles
- Afastar → vídeo só some depois de 8 tiles, sem piscar na borda
- Dentro da sala → volume cheio mesmo em cantos opostos
- Sair da sala → volume passa a cair com a distância

## Fora de escopo

- Call nomeada ou persistente (a bolha é efêmera, nasce e morre com a proximidade)
- Convidar alguém para uma call
- Limite de participantes por call
- Indicador visual da bolha no mapa (pode vir depois; o minimapa já mostra quem fala)
