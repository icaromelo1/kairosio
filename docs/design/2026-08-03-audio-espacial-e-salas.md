# Áudio espacial, salas trancáveis e escopo do jukebox

> Spec aprovado em 03/08/2026 via brainstorming. Substitui o modelo atual de voz
> (`proximidade | sala inteira`) por atenuação espacial contínua, e promove `area`
> de retângulo decorativo a entidade com estado compartilhado.

## Contexto — o que existe hoje

`VoiceMode` tem os valores `'proximity' | 'room'`, mas **proximidade nunca foi
implementada**. O gateway guarda a string por sala e reemite; no cliente, o LiveKit
expõe um único controle de volume, `setVolume(muted ? 0 : 1)`, binário, usado só para
silenciar alguém. Não há cálculo de distância em `media.ts`, `media.livekit.ts` nem
`media.state.ts`.

Na prática: **todo mundo do mapa escuta todo mundo em volume cheio**, nos dois modos.

`area` foi criada em 02/08 apenas para a máscara de iluminação: `{ kind, x, y, w, h }`,
sem id, nome ou estado.

## Decisão de arquitetura

**Uma sala LiveKit por mapa (como hoje), com o ganho calculado no cliente.**

Cada cliente já tem a posição de todos (`remotePlayers`) e a planta do mapa. Logo,
**em qual sala cada um está é calculável localmente** — nenhum dado novo trafega para
o áudio funcionar. O cliente percorre os peers a cada quadro e aplica
`setVolume(ganho)` por participante.

Alternativa rejeitada: trocar de sala LiveKit ao cruzar a porta. Causaria renegociação
a cada passo perto da soleira, corte audível e complexidade no servidor. Com ganho no
cliente, atravessar a porta é uma curva contínua.

## Fórmula

```
ganho = curvaDistância(d) × oclusão
```

### Distância

| Constante | Valor | Efeito |
|---|---|---|
| `RAIO_CHEIO` | 2 tiles | Volume 1.0 dentro desse raio |
| `RAIO_MAX` | 10 tiles | Volume 0 a partir daí |

Entre os dois, queda suave: `g = (1 - t)²`, com `t = (d - RAIO_CHEIO) / (RAIO_MAX - RAIO_CHEIO)`.
O quadrado evita que o volume caia rápido demais logo ao sair do raio íntimo.

### Oclusão

"Em que sala está" é resolvido localmente: o ponto cai dentro do retângulo de alguma
`area`, ou está no mundo aberto. **Separados** = a sala do falante difere a do ouvinte
(incluindo o caso de um estar em sala e o outro no aberto).

| Situação | Fator |
|---|---|
| Mesma sala, ou ambos no mundo aberto | `1.0` |
| Separados | `0.25` |
| Separados, mas o ouvinte a até `RAIO_PORTA` (2 tiles) de uma porta **da sala do falante** | `0.7` |
| Sala do falante trancada | `0.0` |

A distância sempre manda; a porta só alivia o abafamento. Isso combina o modelo
contínuo (a) com a soleira privilegiada (c) sem que um anule o outro.

## Sala como entidade

**No dado do mapa** (`MapObject` de `kind: 'area'`), dois campos novos:

- `id: string` — estável, referenciado pelo estado de runtime
- `name: string` — exibido ao entrar e no minimapa

**Em runtime** (gateway, `Map` por sala, mesmo padrão já usado por jukebox e
`voiceMode`):

- `trancada: boolean`

Quem está dentro pode trancar. A mudança propaga por socket para todos do mapa.
Não há dono de sala nem hierarquia interna.

### O que "trancada" faz

1. A porta vira sólida para quem está fora — quem já está dentro permanece
2. O vazamento de áudio zera (oclusão `0.0`)

Não persiste entre sessões: é estado de momento, descartado quando a sala esvazia.

## Jukebox

- Só funciona com o jogador **dentro de uma sala**; toca apenas para os ocupantes dela
- O controle `alcance: proximidade | sala inteira` **é removido** — a sala virou o alcance
- Alcance global (música ou voz para o mundo inteiro) fica atrás da `SudoGuard`

## Minimapa

Os pontos de peers já existem (roxo para os outros, dourado para você). Somar:

- **Indicador de quem está falando** — `RoomEvent.ActiveSpeakersChanged` já está ligado
  em `media.livekit.ts` (handler `onActiveSpeakers`); falta só expor no minimapa
- **Realce de sala trancada**

## Fora de escopo

- Áudio direcional (estéreo por posição no mundo)
- Sala com formato não-retangular
- Persistir `trancada` entre sessões
- Convite ou permissão nominal para entrar em sala trancada
- Áudio espacial para a transmissão de tela — segue como está

## Impacto no código

| Arquivo | Mudança |
|---|---|
| `game/maps.ts` | `id` e `name` em objetos `area` |
| `game/audio/espacial.ts` *(novo)* | Curva de distância, oclusão, sala de um ponto |
| `services/media.livekit.ts` | `setVolume` fracionário por peer, chamado a cada quadro |
| `services/presence.ts` | Estado `trancada` por sala, evento de sincronia |
| `presence.gateway.ts` | `Map` de estado de sala; remove `voiceSetMode` e o `mode` do jukebox |
| `pages/GamePage.vue` | Chama o cálculo no tick; UI de trancar ao entrar |
| `components/JukeboxPanel.vue` | Remove seletor de alcance; exige estar em sala |
| `game/pixi/minimap.ts` | Indicador de fala e de sala trancada |

## Como testar

- **Distância** — dois clientes no mundo aberto, afastar e conferir queda de volume
- **Parede** — um dentro, um fora colado à parede: audível e abafado
- **Porta** — o de fora anda até a soleira: fica nitidamente mais claro
- **Trancada** — trancar por dentro: o de fora para de escutar e não consegue entrar
- **Jukebox** — fora de sala não toca; dentro toca só para os de dentro
- **Sudo** — alcance global aparece só para `isSudo`

Unitário cobre a matemática (`curvaDistância`, `oclusão`, `salaDoPonto`), que é pura.
O resto depende de dois clientes e fica em verificação manual.

## Consequência a aceitar

Com proximidade real, o mapa 120×120 fica **silencioso**: duas pessoas em cantos
opostos não se escutam. É o comportamento correto, mas é uma mudança grande em relação
a hoje, onde todos escutam todos em volume cheio.
