# Rotina — cookies do YouTube sempre frescos

> Origem: o cookie exportado manualmente (extensão "Get cookies.txt") expirava
> periodicamente e travava todo download novo no jukebox com "YouTube bloqueou
> o download deste servidor (anti-bot)". Status: ✅ **implementado 02/07/2026**.

## Como funciona

`scripts/refresh-youtube-cookies.sh` (roda no Mac do Icaro, não na VM):

1. `yt-dlp --cookies-from-browser chrome` lê o cookie jar do Chrome local
   (decifra via Keychain, sem precisar de extensão nem exportar nada na mão).
2. Filtra só os domínios `youtube.com`/`google.com` antes de mandar pro
   servidor — o Chrome tem cookies de tudo quanto é site (Gmail, Drive,
   Wallet...) e não faz sentido nem é seguro levar isso tudo pra VM só pra
   autenticar o YouTube.
3. `scp` do resultado pra `/home/ubuntu/projects/kairos-api/cookies/youtube.txt`
   na VM Oracle (147.15.78.182), que é o path montado como `COOKIES_FILE`
   (`/app/cookies/youtube.txt`) dentro do container `kairos-api`.
4. **Não precisa reiniciar nada** — `YtDlpService.cookieArgs()` já checa o
   arquivo a cada chamada (`fs.statSync`), então o cookie novo vale na
   próxima música adicionada.

Log de cada execução em `~/.kairos-cookie-refresh.log` (sucesso/falha).

## Agendamento (launchd, macOS)

- Definição em `scripts/io.kairos.refresh-youtube-cookies.plist`, instalada em
  `~/Library/LaunchAgents/`.
- Roda a cada 12h (`StartInterval`) + uma vez ao carregar (`RunAtLoad`). Se o
  Mac estiver dormindo na hora, o launchd dispara ao acordar.
- **A cópia que o launchd de fato executa fica em
  `~/Library/Application Support/kairos/refresh-youtube-cookies.sh`**, não no
  repo (`/Volumes/icaro_ssd/...`) — o macOS (TCC) bloqueia LaunchAgents
  rodando scripts direto de volume externo ("Operation not permitted"), mesmo
  o Terminal tendo acesso normal. **Se editar o script no repo, precisa
  sincronizar a cópia também:**
  ```bash
  cp scripts/refresh-youtube-cookies.sh ~/Library/Application\ Support/kairos/
  ```

## Reinstalar do zero (troca de máquina, ou se o launchd "sumir")

```bash
mkdir -p ~/Library/Application\ Support/kairos
cp scripts/refresh-youtube-cookies.sh ~/Library/Application\ Support/kairos/
chmod +x ~/Library/Application\ Support/kairos/refresh-youtube-cookies.sh
cp scripts/io.kairos.refresh-youtube-cookies.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/io.kairos.refresh-youtube-cookies.plist
```

## Requisitos

- `yt-dlp` instalado (`brew install yt-dlp`), Chrome instalado e **logado**
  no YouTube com a conta que se quer usar pra autenticar os downloads.
- Chave SSH `~/.ssh/oracle_portfolio.key` com acesso a `ubuntu@147.15.78.182`.

## Verificar se está rodando

```bash
launchctl list | grep kairos          # 2ª coluna = último exit code (0 = ok)
tail -5 ~/.kairos-cookie-refresh.log
```
