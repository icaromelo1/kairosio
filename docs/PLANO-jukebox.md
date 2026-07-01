# Plano — Jukebox (música compartilhada via YouTube)

> Origem: feedback do Icaro — "rádio/jukebox" tocando playlist dinâmica, tipo bot de
> Discord, com fila por busca/link do YouTube. Status: ✅ **implementado 30/06/2026**
> (v1 — link colado, sem busca por texto ainda).

> Nota: a tabela `playlists`/`playlist_tracks` da seção 2 não entrou na v1 — a fila
> é só estado em memória por sala (room_state no gateway), como já estava desenhado;
> não havia necessidade de playlists nomeadas/salváveis pro escopo pedido. `tracks` é
> a única entidade persistida (dedup + storage permanente).

> ⚠️ **Bloqueado em você:** o YouTube bloqueia download a partir do IP da VM Oracle
> ("Sign in to confirm you're not a bot" — comum em IPs de datacenter). Testado com
> vários `--extractor-args player_client` (tv/ios/mweb/web_embedded/web_creator/web_safari),
> nenhum contorna. Único fix real: autenticar com cookies de uma sessão logada.
> 1. Instale a extensão **"Get cookies.txt LOCALLY"** no Chrome, logado na sua conta YouTube.
> 2. Exporte o cookies.txt do youtube.com.
> 3. Envie pro servidor: `scp cookies.txt ubuntu@147.15.78.182:/home/ubuntu/projects/kairos-api/cookies/youtube.txt`
> 4. Pronto — o `YtDlpService` já detecta o arquivo (não-vazio) e passa `--cookies` sozinho,
>    sem precisar de novo deploy. Mount + env var (`COOKIES_FILE`) já estão configurados.
>
> **Teste local (30/06):** baixado com sucesso da máquina local (IP residencial, sem
> cookies) o mesmo link que falhou na VM — confirma que o bloqueio é específico do IP
> de datacenter da Oracle, não uma exigência geral de autenticação. Avaliada alternativa
> de proxy residencial pro `yt-dlp` da VM; descartada por custo recorrente e complexidade
> extra desnecessária pra esse caso de uso pessoal. **Decisão: seguir só com cookies.txt.**
>
> **Atualização (01/07):** cookies.txt exportado (conta `ica121jogador@gmail.com`, via
> `yt-dlp --cookies-from-browser chrome`, sem precisar de extensão) e enviado pro servidor.
> Resolveu a busca de metadado, mas o download real de áudio continuou bloqueado — o
> YouTube passou a exigir também um **PO Token** (proof-of-origin) junto com o cookie.
> Fix: subido o sidecar `bgutil-ytdlp-pot-provider` (container `bgutil-provider`, porta
> 4416 interna) + plugin `bgutil-ytdlp-pot-provider` (pip) no `yt-dlp` da imagem +
> `POT_PROVIDER_URL` no `YtDlpService`. Mount do cookies.txt trocado de `:ro` pra
> leitura-escrita (o `yt-dlp` regrava o cookie jar sozinho quando os tokens rotacionam).
> Ainda faltava fixar `--extractor-args youtube:player_client=web` junto do PO token —
> sem isso o `yt-dlp` usa client `tv`/`android_vr` por padrão, que gera PO token
> incompatível com a URL assinada do stream (dava 403 no download do segmento mesmo
> passando o anti-bot). Com os dois combinados no mesmo `--extractor-args`
> (`youtube:player_client=web;youtubepot-bgutilhttp:base_url=...`), download completo
> testado com sucesso na VM (mp3 de 1.5MB baixado). **Status: ✅ resolvido de vez.**

---

## 1. Decisões já tomadas (não reabrir sem motivo novo)

- **Fonte de áudio**: download do áudio via `yt-dlp` a partir de link/busca do YouTube
  (não streaming ao vivo, não Spotify — Spotify exige Premium individual por ouvinte,
  inviável pro modelo de "rádio compartilhada").
- **Storage durável**: **Google Drive**, reaproveitando o remote `rclone` (`gdrive:`,
  escopo `drive.file`) que já roda em produção nos backups do Minecraft
  (`/home/ubuntu/projects/backup/backup-minecraft.sh`). Pasta nova: `gdrive:kairos-music/`.
  Acesso via `child_process` chamando `rclone copy/copyto/lsf/deletefile`, sem precisar
  implementar OAuth/Service Account novo no NestJS.
- **Metadado**: Postgres — só dados leves (título, ids, playlists), nunca o binário.
- **Cache local**: disco da VM, **sempre fica quente desde o primeiro download**
  (não espera o primeiro play) — assim que baixa e sobe pro Drive, a cópia local fica
  servindo direto. TTL/LRU só evita acúmulo: expira o que não toca há N dias e
  re-busca do Drive sob demanda se precisar de novo.
- **Sincronização entre ouvintes**: servidor guarda `startedAt` (timestamp) da faixa
  atual por sala; cada cliente calcula `currentTime = (Date.now() - startedAt) / 1000`
  ao entrar/sincronizar — quem chega no meio entra no ponto certo.
- **Modo de escuta — toggle por sala**: `proximity` (raio + decaimento de volume por
  distância até o objeto jukebox, igual ao voice chat) ou `room` (toca pra todo mundo
  no mapa/org, sem checar distância). Flag salva no estado da sala.
- **Risco assumido conscientemente**: baixar e guardar cópias de áudio do YouTube viola
  os Termos de Serviço (diferente de só embutir o player oficial). Uso é privado/pessoal,
  sem distribuição pra terceiros fora do grupo. Não reabrir essa discussão — already
  confirmado pelo Icaro.

---

## 2. Arquitetura

```
[Cliente] --busca/link--> [API] --yt-dlp--> [/tmp local]
                              |                  |
                              |             rclone copy
                              |                  v
                              |          gdrive:kairos-music/
                              |                  |
                              +--- mantém cópia quente em disco local (cache)
                              |
                         [Postgres] tracks / playlists / playlist_tracks / room_state
                              |
                    [Socket gateway] jukeboxAdd/Skip/SetMode/State (broadcast por sala)
                              |
                         [Cliente(s)] <audio> tocando, sincronizado por startedAt,
                                       volume por distância se mode=proximity
```

### Schema Postgres (novo módulo `kairos-api/src/jukebox/`)

- `tracks`: `id, youtubeId (unique), title, artist?, durationSec, driveFileId/drivePath, addedBy, createdAt`
- `playlists`: `id, name, mapId, orgId, createdBy, createdAt`
- `playlist_tracks`: `playlistId, trackId, order`
- `room_state` (em memória no gateway, igual ao `Player` map — não precisa de tabela):
  `{ mapId+orgId -> { mode: 'proximity'|'room', queue: trackId[], currentTrackId, startedAt } }`

### Cache local

- Diretório dedicado (ex: `/home/ubuntu/projects/kairos-api/music-cache/`).
- Nome de arquivo = `{youtubeId}.mp3` (dedup natural).
- Limite de **10GB** no diretório; ao estourar, job de limpeza (cron simples, igual aos
  crons do `infrastructure/scheduling/` que já existem em outros projetos CAST/DSG)
  apaga por **LRU** (mais antigo/menos tocado recentemente primeiro) até voltar abaixo
  do limite. Drive continua com a cópia permanente de tudo.

---

## 3. Tarefas

### Backend
1. `JukeboxModule` — entidades + migrations (`tracks`, `playlists`, `playlist_tracks`).
2. `DriveService` — wrapper fino sobre `rclone` via `child_process` (`copy`, `copyTo`,
   `lsf`, `deleteFile`), reaproveitando `/home/ubuntu/.config/rclone/rclone.conf` e a
   pasta nova `gdrive:kairos-music/`.
3. `YtDlpService` — download de áudio a partir de link/youtubeId (`yt-dlp -x --audio-format mp3`),
   checagem de dedup por `youtubeId` antes de baixar de novo.
4. Fluxo de "adicionar música": recebe link/youtubeId → se já existe em `tracks`, só
   enfileira; se não, baixa → sobe pro Drive → grava cache local quente → salva metadado
   → enfileira.
5. Estado de jukebox por sala — eventos no gateway (`presence.gateway.ts` ou módulo
   próprio): `jukeboxAdd`, `jukeboxSkip`, `jukeboxSetMode`, broadcast `jukeboxState`
   (faixa atual, fila, `startedAt`, `mode`) pra sala `org:map`.
6. Endpoint HTTP de streaming do áudio: serve do cache local; se não estiver no cache
   (expirou), baixa de novo do Drive (`rclone copyto`) antes de servir.
7. Job de limpeza do cache local por LRU ao estourar 10GB.

### Frontend
8. `tryInteract` em `GamePage.vue`: `else if (kind === 'jukebox')` → abre UI dedicada
   em vez do modal genérico "em breve".
9. Componente de player: campo pra colar link do YouTube, fila com quem adicionou,
   botão pular, toggle visual sala/proximidade.
10. Serviço de áudio: `HTMLAudioElement` sincronizado por `startedAt`; em modo
    `proximity`, recalcula volume por distância no mesmo ticker que já calcula
    proximidade de voz (`GamePage.vue`); em modo `room`, ignora distância.
11. Indicador visual no objeto jukebox do mapa (`scene.ts`) quando há música tocando
    (glow ativo, nota musical, etc.).

### v2 (não bloqueia v1)
- Busca por texto via YouTube Data API (v1 só aceita link/id colado).
- Votação pra pular faixa (em vez de qualquer um pular).

---

## 4. Critérios de aceite

- Colar um link do YouTube no jukebox baixa, armazena no Drive e começa a tocar pra
  quem está perto (modo proximidade) ou pra sala toda (modo room).
- Quem entra no raio durante a música já ouve sincronizado no ponto certo, não do início.
- Pedir a mesma música duas vezes não baixa de novo (dedup por `youtubeId`).
- Cache local expira sem perder a música (Drive é a cópia permanente).
- Toggle sala/proximidade muda o comportamento em tempo real pra quem está no mapa.

## 5. Decisões confirmadas (Icaro, 2026-06-30)

- **Modo sala/proximidade**: qualquer pessoa na sala pode trocar — sem restrição de
  permissão/dono.
- **Fila**: sem limite de tamanho nem de duração por faixa.
- **Cache local**: sem TTL por tempo — é por **espaço em disco**. Vai acumulando
  músicas baixadas livremente até bater **10GB** de uso no diretório de cache; ao
  estourar, limpa por **LRU** (apaga primeiro as mais antigas/menos tocadas
  recentemente) até voltar abaixo do limite. Drive continua com a cópia permanente
  de tudo, independente do que sobra no cache local.
