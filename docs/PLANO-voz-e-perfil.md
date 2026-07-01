# Plano — Voz (modo sala/mute) + nomes flutuantes + foto de perfil

> Origem: pedido do Icaro por um chat de voz "tipo Discord" com mute individual,
> modo sala/proximidade configurável por sala, nomes flutuantes sobre quem está
> perto e uma tela de perfil com foto substituindo o avatar pixel. Status: ✅
> **implementado 01/07/2026**.

## 1. Nomes flutuantes

- `AvatarPuppet` (`kairos-ui/src/game/pixi/avatar.ts`) ganhou um `Text` (`nameLabel`)
  ancorado acima da cabeça, escondido por padrão.
- `setName(name)` define o texto; `setNameVisible(bool)` mostra/esconde.
- `GamePage.vue` chama `setName` na criação do puppet remoto e `setNameVisible`
  a cada frame usando o mesmo raio `d <= 4` já usado pra conectar a voz por
  proximidade — um só cálculo de distância, dois usos.
- Ao virar de lado (`setFacing`), o nome recebe um contra-espelhamento
  (`nameLabel.scale.x = root.scale.x`) pra não ficar de trás pra frente junto
  com o boneco.

## 2. Voz: modo sala vs proximidade

- Backend (`presence.gateway.ts`): novo `Map<string, VoiceMode>` por sala
  (`org:map`), mesmo padrão do `jukebox.mode`. Evento `voiceSetMode` (qualquer
  membro pode alternar, vale pra sala toda) e `voiceState` emitido no
  join/switchMap/mudança de modo.
- Frontend (`presence.ts`): `voiceMode` reativo + `emitVoiceSetMode(mode)`.
- `GamePage.vue`: no loop de proximidade, se `voiceMode === 'room'` a lista de
  IDs pra `voice.sync()` passa a ser todo mundo da sala (não só quem está a
  `d <= 4`) — o raio continua regulando só os nomes flutuantes.

## 3. Mute individual (mic e peers)

- `VoiceChat` (`webrtc.ts`) ganhou:
  - `muteMic()`/`unmuteMic()` — desliga só o **envio** (`track.enabled = false`),
    sem fechar a conexão nem renegociar.
  - `muteRemote(peerId)`/`unmuteRemote(peerId)` — silencia localmente o áudio
    de UM peer (`audio.muted`), sem afetar os outros nem a conexão dele.
  - Estado de mute sobrevive a reconexões (`mutedPeers` é consultado em
    `playRemote` ao recriar o elemento `<audio>`).

## 4. Sidebar estilo Discord

- Novo componente `VoicePanel.vue`, encaixado na sidebar existente do jogo
  (mesma área de "Mundos"/"Você"), com:
  - Botão de alternar modo (📍 perto / 📢 sala).
  - Botão de entrar/sair da chamada.
  - Lista de membros: você (mic mute) + peers da sala (mute individual, só
    clicável quando conectado via voz).

## 5. Foto de perfil

- **Storage**: reaproveita o padrão rclone do jukebox
  (`kairos-api/src/character/avatar-photo-storage.service.ts`), remote
  separado (`AVATAR_DRIVE_REMOTE`, default `gdrive:kairos-avatars`) e cache
  local próprio (`AVATAR_CACHE_DIR`).
- `Character.photoFile` (nullable) guarda o nome do arquivo.
- Endpoints (`character.controller.ts`):
  - `POST /character/photo` (multipart, `FileInterceptor` do
    `@nestjs/platform-express` — sem dependência nova, multer já vem
    transitivo) — valida mimetype (jpeg/png/webp) e tamanho (5MB).
  - `DELETE /character/photo` — remove do Drive + cache + zera o campo.
  - `GET /character/photo/:fileName` — **pública** (sem guard, como o
    `/jukebox/stream/:id`), baixa do Drive pro cache se faltar. Valida o
    formato do nome do arquivo antes de tocar no filesystem (evita path
    traversal).
- **Comportamento confirmado com o Icaro**: se a foto está configurada, ela
  **substitui o avatar pixel no jogo** (não só em telas de perfil); sem foto,
  continua o sprite normal — mesma regra pra você e pra quem vê os outros.
- `AvatarPuppet.setPhoto(url)`: esconde as partes do boneco pixel e mostra um
  círculo com a textura (Pixi `Sprite` + máscara circular); `setPhoto(null)`
  reverte. Carregamento assíncrono via `Assets.load` — se falhar, volta pro
  sprite.
- A foto viaja dentro do próprio payload de `avatar` (campo `photoUrl`) que já
  é broadcast no join/presença — nenhuma mudança de schema no backend do
  gateway foi necessária, ele só repassa o objeto que o cliente manda.
- Tela de perfil: nova aba "Foto" em `CharacterPage.vue` (upload + preview
  circular + remover), só disponível logado.

## Fora do escopo desta v1

- Fotos não são recomprimidas/redimensionadas no servidor (sem lib de imagem
  instalada) — o preview circular no cliente já corta pra quadrado via
  `object-fit: cover`, mas o arquivo original fica no tamanho enviado.
- Peer que troca de foto/avatar **no meio da sessão** não atualiza pros outros
  já conectados (só pega o avatar novo em quem entrar depois) — mesma
  limitação que já existia pra cor de cabelo/roupa antes desta feature.
- Boost (carrinho) + foto configurada não foi testado junto — o carrinho
  desenha por cima das pernas/tronco, que ficam escondidos quando há foto;
  visualmente o carrinho pode ficar "vazio" nesse caso.
