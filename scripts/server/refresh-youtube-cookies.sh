#!/usr/bin/env bash
# Atualiza o cookies.txt do jukebox (COOKIES_FILE) direto no servidor, sem
# depender de nenhuma máquina do Icaro. Usa uma conta dedicada
# (ica121jogador@gmail.com) logada uma única vez (manualmente, via VNC) num
# perfil persistente do Chromium instalado neste host.
#
# Fluxo:
# 1. Abre o Chromium headless com o perfil salvo e visita o YouTube — isso
#    deixa a sessão "viva" e permite que cookies rotativos (SIDCC etc) sejam
#    renovados pelo próprio Google, não só lidos.
# 2. yt-dlp --cookies-from-browser lê o cookie jar do Chromium (SQLite) e
#    escreve no formato Netscape que o jukebox usa. O yt-dlp instalado no
#    HOST não tem runtime JS (deno/node) pra resolver a assinatura de vídeo
#    (isso só existe dentro do container kairos-api) — então o comando abaixo
#    quase sempre retorna erro de "formato não disponível", mas o arquivo de
#    cookies já foi escrito ANTES disso, como efeito colateral da extração.
#    Por isso validamos pelo CONTEÚDO do arquivo, não pelo exit code.
# 3. Escreve direto no COOKIES_FILE montado no container (sem scp — está tudo
#    na mesma máquina).
#
# Agendado via cron (ver crontab -l) rodando a cada 12h.

set -uo pipefail

PROFILE_DIR="/home/ubuntu/projects/kairos-api/chrome-profile"
COOKIES_OUT="/home/ubuntu/projects/kairos-api/cookies/youtube.txt"
YTDLP="/home/ubuntu/.local/bin/yt-dlp"
LOG_FILE="/home/ubuntu/projects/kairos-api/cookie-refresh.log"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"; }

# mata qualquer chromium travado de uma execução anterior (evita "profile in use")
pkill -9 -f "user-data-dir=$PROFILE_DIR" 2>/dev/null
sleep 1

# visita o YouTube pra manter a sessão ativa/rotacionar cookies — timeout de
# segurança (timeout 30) pra nunca travar o cron indefinidamente
timeout 30 chromium --headless=new --no-sandbox --disable-gpu \
     --user-data-dir="$PROFILE_DIR" --virtual-time-budget=8000 \
     --dump-dom https://www.youtube.com > /dev/null 2>>"$LOG_FILE"
if [ $? -ne 0 ]; then
  log "AVISO: chromium headless falhou/timeout ao visitar youtube.com (seguindo mesmo assim)"
fi

pkill -9 -f "user-data-dir=$PROFILE_DIR" 2>/dev/null
sleep 1

TMP_RAW=$(mktemp -u)
TMP_FILTERED=$(mktemp)
trap 'rm -f "$TMP_RAW" "$TMP_FILTERED"' EXIT

# ignora o exit code de propósito (ver comentário acima) — valida pelo conteúdo
"$YTDLP" --cookies-from-browser "chromium:$PROFILE_DIR" --cookies "$TMP_RAW" \
     -j "https://www.youtube.com/watch?v=dQw4w9WgXcQ" > /dev/null 2>>"$LOG_FILE"

if [ ! -s "$TMP_RAW" ]; then
  log "FALHA: extração não gerou nenhum cookie (ver log acima)"
  exit 1
fi

# mantém o cabeçalho ('#') + só domínios youtube/google (o perfil dedicado só
# loga nessa conta, mas filtra mesmo assim por consistência/segurança)
awk -F'\t' '/^#/ || $1 ~ /(^|\.)(youtube|google)\.com$/' "$TMP_RAW" > "$TMP_FILTERED"

if [ ! -s "$TMP_FILTERED" ]; then
  log "FALHA: arquivo filtrado ficou vazio — abortando"
  exit 1
fi

cp "$TMP_FILTERED" "$COOKIES_OUT"
log "OK — cookies atualizados ($(wc -l < "$TMP_FILTERED") linhas)"
