# Sala social do Kairos — mídia, tela compartilhada, chat e ícones

> Design aprovado em 30/07/2026 (sessão de brainstorming).
> Substitui a malha WebRTC P2P por LiveKit, reconstrói o painel de voz/vídeo no
> modelo do Discord, ajusta o chat de texto e troca os emojis por uma lib de ícones.

---

## Por que

O painel de voz/vídeo de hoje vive espremido na sidebar de 250px, não tem
compartilhamento de tela, e a camada de mídia é uma malha P2P que não sobrevive a
uma reunião de time inteiro. O Kairos vai receber uma organização real, com dois
padrões de uso: daily de squad (3–6 pessoas) e reunião geral (10–20).

Três problemas concretos motivam a mudança:

1. **A malha não escala.** Cada pessoa abre uma conexão direta com cada outra.
   Tela em 720p60 custa ~3 Mbps *por destinatário*: numa sala de 8, quem
   compartilha precisaria de 21 Mbps de upload.
2. **Falta TURN.** Só existe STUN (`stun.l.google.com`). Quem está atrás de CGNAT
   — comum em internet brasileira, sobretudo móvel — ou de firewall corporativo
   simplesmente não conecta. Isso já produziu o feedback *"tive problemas pra me
   comunicar pelo microfone; alguns colegas tiveram que desconectar e reconectar"*,
   que sempre foi tratado como bug de UI e é, na verdade, negociação de mídia sem rota.
3. **A UI não comporta vídeo.** Renderizar tela compartilhada dentro de uma
   sidebar estreita é inútil.

---

## Decisões tomadas

| Decisão | Escolha | Por quê |
|---|---|---|
| Camada de mídia | **LiveKit self-hosted** na VM Oracle | Cobre squad e time inteiro; TURN embutido; simulcast nativo; subscrição seletiva feita para "aplicações espaciais" |
| Layout | Janela **sobreposta** ao mapa, com tela cheia | Mapa segue jogável embaixo; tela cheia atende quem quer só assistir |
| Grade | Modelo **Discord**: tile por pessoa + tile extra por transmissão | Referência trazida pelo Icaro; permite escolher qual transmissão assistir |
| Assistir | **Opt-in** (clicar no tile assina o vídeo) | Corta o custo de banda pela raiz: upload proporcional a quem assiste, não ao tamanho da sala |
| Alcance da tela | Segue o **modo da sala** (proximidade \| sala), como voz e jukebox, **+ notificação para todos** | Reusa conceito que o produto já tem em vez de criar regra nova; a notificação resolve descoberta para quem está longe |
| Qualidade | 720p, com o usuário escolhendo **nitidez** ou **fluidez** | Atende tanto "mostrar código" quanto "mostrar jogo" |
| Chat | Caixa semitransparente com scroll, 255 caracteres, cooldown 0,5s | Pedido direto; limites no servidor porque no front seriam contornáveis |
| Ícones | **pixelarticons** (MIT, 879 SVGs, grid 24×24) | Coerente com a identidade pixel art do jogo |
| SFU vs malha | SFU agora, não depois | Remendar a malha para 15 pessoas custaria mais que adotar o SFU |

---

## Parte 1 — Stack de mídia

### Servidor

Container `livekit/livekit-server` na VM Oracle. **Arquitetura verificada:** a VM é
`aarch64` com 4 vCPU e ~12 GB livres; a imagem publica `linux/arm64` oficialmente.

Portas:

| Porta | Uso |
|---|---|
| 7880 | HTTP/WebSocket (API e sinalização) — atrás do Traefik, com TLS |
| 7881 | TCP para RTC quando UDP está bloqueado |
| 50000–60000/udp | Mídia |
| 5349 | TURN sobre TLS (embutido no LiveKit) |

Dois pontos de atenção na Oracle, ambos causa comum de "conecta mas não tem som":

- `rtc.use_external_ip: true` na config — sem isso o servidor anuncia o IP privado
  da VM nos candidatos ICE e a mídia nunca chega.
- Liberar as portas em **dois lugares**: a *security list* da VCN **e** o
  `iptables` da instância. A imagem Ubuntu da Oracle vem com iptables restritivo
  por padrão, e esquecer o segundo é a pegadinha clássica.

### Autenticação

Novo endpoint no `kairos-api`:

```
POST /media/token  →  { token, url }
```

Emite o access token do LiveKit (assinado com a API secret, nunca exposta ao
cliente), com `identity` = id do usuário, `name` = nome de exibição e a sala
concedida. **A sala é `${organizationId}:${mapId}`** — o mesmo esquema de
isolamento que o `PresenceGateway` já usa, então a regra de "não entro na sala de
outra organização" continua valendo sem código novo. O endpoint recusa emitir
token para mundo que o usuário não pode acessar, reaproveitando a checagem do
`MapService`.

### Cliente

Nasce `kairos-ui/src/services/media.ts`, encapsulando o `Room` do LiveKit atrás de
uma interface pequena: conectar, publicar microfone, publicar câmera, publicar
tela, assinar/desassinar participante, consultar estatísticas. **O `webrtc.ts`
atual (≈350 linhas de gestão manual de `RTCPeerConnection`, ICE, renegociação e
cleanup) é removido.**

O `presence.ts` e o `PresenceGateway` **continuam existindo e não mudam de
responsabilidade**: seguem cuidando de posição, pose, chat, lousa, jukebox e
contagem de online. Apenas a mídia sai deles. Isto não é uma substituição do
socket.io — é uma separação de responsabilidade.

### Proximidade

Conectar com `autoSubscribe: false`. A distância entre avatares — já calculada a
cada frame no ticker do `GamePage` — passa a controlar `publication.setSubscribed()`
por participante, em vez de abrir e fechar conexões.

Mantém a **histerese já implementada**: assina a ≤4 tiles, só desassina acima de 5.
Sem isso, andar na borda do raio gera um ciclo de assina/desassina.

No modo "sala", todos ficam assinados independente da distância.

### Qualidade da tela

Captura via `createScreenTracks({ audio: true })` — o LiveKit suporta publicar o
áudio da aba junto, o que serve para assistir vídeo em grupo. Vale documentar na
UI que a captura de áudio só funciona ao escolher **aba do navegador**, não tela
inteira, e apenas em alguns navegadores.

Dois modos, expostos como um botão no momento de compartilhar:

| Modo | contentHint | Prioriza | Uso |
|---|---|---|---|
| Nitidez | `detail` | resolução | código, slides, documento |
| Fluidez | `motion` | framerate | jogo, vídeo, animação |

**Restrição verificada:** os `ScreenSharePresets` do SDK vão até
**h720fps30** — não existe preset de 60fps ([issue #1822](https://github.com/livekit/client-sdk-js/issues/1822)).
Os 60fps pedidos são atingíveis configurando `maxFramerate: 60` e um
`maxBitrate` maior (o preset de 30fps usa 2 Mbps; 60fps pede algo entre 3 e 4 Mbps),
mas isso é caminho manual e **precisa ser medido na implementação** com
`getStats()`, não assumido.

O badge no tile mostra resolução e fps **reais medidos**, não os configurados —
como no Discord. Se a rede degradar e o simulcast cair para uma camada menor, o
badge conta a verdade.

---

## Parte 2 — Sala social (UI)

### MediaStage

Componente novo: janela flutuante sobre o canvas do Pixi, arrastável,
redimensionável, com botões de minimizar e tela cheia. O mapa continua jogável
embaixo — WASD, colisão e proximidade seguem funcionando com a janela aberta.

Minimizada, vira uma tira compacta mostrando só quem está falando.

### Tiles

- **Um tile por participante** na conversa: mostra a câmera, ou o avatar pixel do
  personagem quando a câmera está desligada (aproveita o `PixelAvatar` que já existe).
- **Um tile adicional por transmissão**, exatamente como no Discord: quem
  compartilha aparece duas vezes, uma como pessoa e outra como tela.
- Quem está falando ganha **borda destacada** — o detector de fala já existe
  (`audio-level.ts`), só passa a alimentar o tile.
- Tile de transmissão traz o badge de qualidade e o rótulo **AO VIVO**.
- **Clicar no tile é o que assina o vídeo.** Com `autoSubscribe: false` nenhum
  byte de vídeo chega antes disso — não existe preview automático. O tile não
  assinado mostra o nome de quem transmite, o avatar e um botão **Assistir**.
  É isso que mantém o custo de banda proporcional ao interesse real.
- Em modo proximidade, quem está longe vê o tile **esmaecido** com a instrução de
  se aproximar, em vez de um tile quebrado sem explicação.

As duas regras são camadas distintas e independentes: o **modo da sala** decide
quem *pode* assinar (na proximidade, só os vizinhos); o **clique** decide se
aquela pessoa *de fato* assina. Estar perto não faz o vídeo baixar sozinho.

### Barra de controles

Fixa na base da janela, no modelo do print de referência: microfone, câmera,
compartilhar tela, sair. Cada botão com estado ligado/desligado inequívoco — o
estado "desligado" usa a barra diagonal sobre o ícone, como o Discord faz.

Isso **remove a duplicação atual**: hoje existem dois botões de "Entrar na voz",
um no `VoicePanel` da sidebar e outro flutuando no HUD, com rótulos diferentes.
Passa a existir um só lugar de controle.

### Notificação de transmissão

Quando alguém começa a compartilhar, **todos na sala** recebem um aviso
("Fulano começou a compartilhar a tela"), independente do modo e da distância.
Escuta o evento `RoomEvent.TrackPublished`. O aviso some sozinho e não rouba o
foco do teclado — o jogo continua respondendo a WASD enquanto ele está na tela.

### Chat de texto

- Caixa **semitransparente** com scroll próprio e barra de rolagem estilizada.
- **Auto-scroll para a última mensagem, com trava:** se o usuário rolou para cima
  para ler algo, mensagem nova não puxa a visão de volta; aparece um indicador de
  "novas mensagens" para voltar ao fim quando quiser.
- **255 caracteres** (hoje são 300) e **cooldown de 0,5s** entre mensagens.
  Ambos aplicados **no servidor** (`handleChat` do gateway) e refletidos no
  front — validar só no cliente seria contornável por qualquer um com o devtools
  aberto.

---

## Parte 3 — Sistema de ícones

Hoje a UI usa **38 emojis distintos em 84 ocorrências, espalhados por 12
arquivos**. Cada sistema operacional desenha do seu jeito.

Entra o `pixelarticons` (npm, MIT, 879 SVGs em grid 24×24), coerente com a
identidade pixel art do jogo. Um componente `<PixelIcon name="mic" />` injeta o
SVG inline e herda `currentColor`, então o ícone acompanha a cor do contexto e
entra no bundle por tree-shaking.

**Lacunas verificadas no set gratuito** (conferidas baixando o pacote, não
assumidas): não existem `video-off`, `volume-x` nem um ícone dedicado de
compartilhar tela. Resolução:

- Compartilhar tela → `monitor` combinado com `share`, ambos presentes.
- Estados "desligado" → o `PixelIcon` aceita a prop `off` e desenha a **barra
  diagonal** sobre o ícone via CSS. Isso cobre todas as variantes ausentes de uma
  vez e é exatamente a convenção visual do Discord.

Confirmados presentes: `mic`, `mic-off`, `volume`, `headphone`, `video`,
`camera`, `monitor`, `share`, `expand`, `close`, `users`, `message`, `play`,
`shuffle`, `repeat`, `music`, `undo`, `redo`, `menu`, `reload`, `check`, `bug`,
`sparkle`, `note`, `book-open`, `list-box`, `trash`, `plus`, `copy`, `link`.

A seta `→`, que responde por 17 das 84 ocorrências, é elemento tipográfico de
botão ("Criar →") e não vira ícone.

---

## Fora de escopo

- **SFU escalado / múltiplas instâncias de LiveKit.** Uma instância cobre o uso
  previsto. Gatilho para revisitar: sala real passando de ~25 pessoas simultâneas.
- **Gravação de sessão.** O LiveKit suporta (egress), mas ninguém pediu.
- **Chat persistente com histórico.** O chat segue efêmero por sala.
- **Chat por proximidade / DM.** Avaliado e descartado nesta rodada: o pedido foi
  sobre a caixa, não sobre o alcance.
- **Pathfinding para "ir até quem está compartilhando".** Exigiria A* no motor de
  mapa; a notificação e o modo sala já resolvem o caso real.
- **Ícones pixel art pagos.** O set gratuito cobre o necessário.

---

## Riscos

| Risco | Mitigação |
|---|---|
| 60fps não é preset do SDK | Configurar `maxFramerate`/`maxBitrate` manualmente e **medir com `getStats()`**; se não sustentar, entregar 720p30 no modo nitidez e reservar 60fps ao modo fluidez |
| Portas UDP bloqueadas na Oracle | Liberar na security list **e** no iptables da instância; validar forçando ICE via relay antes de considerar pronto |
| LiveKit fora do ar derruba a voz | O mundo degrada com elegância: movimento, chat, lousa e jukebox seguem no socket.io; só mídia fica indisponível, com aviso explícito |
| ~~Egress da VM~~ **resolvido** | Verificado em 30/07 na API de preços da Oracle (SKU `B93455`, zona América do Sul) e na conta real: **10.240 GB/mês grátis**, uso atual de **26,95 GB (0,26%)**. Mesmo com a sala aberta 8h por dia útil, o consumo bate ~4.981 GB — **49% da franquia, custo zero**. Só passaria a custar acima de 10 TB/mês, a R$ 0,13/GB |
| Regressão na voz durante a migração | A troca é atômica por natureza (a malha sai, o LiveKit entra); validar com 3 clientes reais antes do merge |
| Sala de mídia vazando entre orgs | O token é emitido pelo backend com a sala fixa em `${orgId}:${mapId}`; o cliente não escolhe sala |

---

## Como validar

0. **Orçamento (antes de liberar):** criar um alerta de budget na Oracle em ~7 TB
   de egress mensal. A franquia é de 10 TB e a projeção de uso intenso fica em
   metade disso, mas um alerta transforma "não deve custar" em "não vai custar
   sem eu saber".
1. **Conexão:** três navegadores em redes diferentes (incluindo um em 4G, que é o
   caso que hoje falha) entram na mesma sala e se ouvem.
2. **TURN:** forçar `iceTransportPolicy: 'relay'` e confirmar que a chamada ainda
   completa — prova que o TURN embutido está de pé.
3. **Proximidade:** afastar dois avatares e confirmar, via evento de subscrição,
   que a track é desassinada acima de 5 tiles e reassinada abaixo de 4.
4. **Tela:** compartilhar nos dois modos e ler resolução/fps reais no `getStats()`,
   comparando com o badge exibido.
5. **Múltiplas telas:** duas pessoas compartilhando ao mesmo tempo, com uma
   terceira alternando entre as duas transmissões.
6. **Isolamento:** usuário de outra organização não consegue token para a sala.
7. **Chat:** mensagem de 256 caracteres é recusada pelo servidor; duas mensagens
   em menos de 0,5s idem, mesmo chamando o socket direto pelo console.
8. **Ícones:** varredura confirmando zero emoji remanescente como ícone na UI.
