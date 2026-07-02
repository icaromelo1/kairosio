#!/usr/bin/env bash
# Atualiza o cookies.txt do jukebox (COOKIES_FILE) na VM da Oracle direto do
# Chrome logado no Mac do Icaro — sem precisar exportar manualmente com
# extensão de novo toda vez que o YouTube derruba a sessão.
#
# Como funciona: yt-dlp --cookies-from-browser lê o cookie jar do Chrome
# (arquivo criptografado, decifra via Keychain) e escreve no formato Netscape
# que o próprio yt-dlp usa em produção. Filtramos só os domínios
# youtube.com/google.com antes de mandar pro servidor — o Chrome tem cookies
# de todo canto (Gmail, Drive, Wallet...) e não faz sentido nem é seguro
# levar isso tudo pra VM só pra autenticar o YouTube.
#
# Uso: ./scripts/refresh-youtube-cookies.sh
# Agendamento: ver scripts/io.kairos.refresh-youtube-cookies.plist (launchd)

set -euo pipefail

# launchd roda com PATH mínimo (sem /opt/homebrew/bin) — sem isso, "yt-dlp:
# command not found" quando disparado pelo agendamento (funciona ok no
# Terminal, que já tem o PATH do shell interativo).
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

SSH_KEY="$HOME/.ssh/oracle_portfolio.key"
SSH_HOST="ubuntu@147.15.78.182"
REMOTE_PATH="/home/ubuntu/projects/kairos-api/cookies/youtube.txt"
LOG_FILE="$HOME/.kairos-cookie-refresh.log"

TMP_RAW=$(mktemp -u)
TMP_FILTERED=$(mktemp)
trap 'rm -f "$TMP_RAW" "$TMP_FILTERED"' EXIT

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"; }

# extrai o cookie jar inteiro do Chrome (precisa do Chrome instalado; não
# precisa estar aberto, mas se estiver, o yt-dlp lida com o lock sozinho).
# -u (mktemp) só reserva o NOME, sem criar o arquivo — o --cookies do yt-dlp
# recusa um arquivo pré-existente vazio por não parecer formato Netscape.
if ! yt-dlp --cookies-from-browser chrome --cookies "$TMP_RAW" \
     -j "https://www.youtube.com/watch?v=dQw4w9WgXcQ" > /dev/null 2>>"$LOG_FILE"; then
  log "FALHA ao extrair cookies do Chrome — veja o log acima"
  exit 1
fi

# mantém o cabeçalho (linhas '#') + só os domínios youtube/google (exclui
# gmail, drive, wallet, calendar etc — não precisam ir pro servidor)
awk -F'\t' '/^#/ || $1 ~ /(^|\.)(youtube|google)\.com$/' "$TMP_RAW" > "$TMP_FILTERED"

if [ ! -s "$TMP_FILTERED" ]; then
  log "FALHA: arquivo filtrado ficou vazio — abortando upload"
  exit 1
fi

if ! scp -i "$SSH_KEY" -o ConnectTimeout=10 "$TMP_FILTERED" "$SSH_HOST:$REMOTE_PATH" >>"$LOG_FILE" 2>&1; then
  log "FALHA ao enviar cookies pra VM (scp)"
  exit 1
fi

log "OK — cookies atualizados e enviados pra VM ($(wc -l < "$TMP_FILTERED") linhas)"
