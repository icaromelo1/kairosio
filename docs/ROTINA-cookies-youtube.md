# Rotina — cookies do YouTube sempre frescos (100% no servidor)

> Origem: o cookie exportado manualmente (extensão "Get cookies.txt") expirava
> periodicamente e travava todo download novo no jukebox com "YouTube bloqueou
> o download deste servidor (anti-bot)". Primeira versão rodava no Mac do
> Icaro (launchd) — **descartada a pedido dele**: não queria depender da
> própria máquina. Versão atual roda inteiramente na VM Oracle, usando uma
> conta dedicada (`ica121jogador@gmail.com`). Status: ✅ **implementado
> 02/07/2026**.

## Arquitetura

- **Chromium instalado direto na VM** (`snap install chromium` — não há
  pacote `chromium` nativo pra Ubuntu 24.04 arm64, só via snap).
- **Perfil persistente** em `/home/ubuntu/projects/kairos-api/chrome-profile`
  — contém a sessão logada da conta `ica121jogador@gmail.com` (login feito
  **uma única vez**, manualmente, via VNC — ver seção abaixo).
- **`scripts/server/refresh-youtube-cookies.sh`** (cópia de referência neste
  repo; o arquivo que roda de verdade fica em
  `/home/ubuntu/projects/kairos-api/refresh-youtube-cookies.sh` na VM):
  1. Mata qualquer Chromium travado de execução anterior.
  2. Abre o Chromium **headless** com o perfil salvo e visita
     `youtube.com` — mantém a sessão "viva" e deixa o Google rotacionar
     cookies de sessão (`SIDCC` etc), não só ler os existentes.
  3. `yt-dlp --cookies-from-browser chromium:<profile>` lê o cookie jar
     (SQLite do Chromium) e escreve no formato Netscape.
  4. Filtra só os domínios `youtube.com`/`google.com` antes de gravar.
  5. Escreve **direto** em `/home/ubuntu/projects/kairos-api/cookies/youtube.txt`
     — sem scp, está tudo na mesma máquina. Esse caminho já é bind-mount pro
     `COOKIES_FILE` do container `kairos-api`
     (`docker-compose.yml` do projeto, path `/app/cookies/youtube.txt`), então
     o cookie novo vale imediatamente, sem reiniciar nada.
- **Agendado via cron da VM** (não launchd, não depende de nenhuma máquina
  externa): `0 */12 * * * /home/ubuntu/projects/kairos-api/refresh-youtube-cookies.sh`.
- Log de cada execução em `/home/ubuntu/projects/kairos-api/cookie-refresh.log`.

## Detalhe não-óbvio: por que o script ignora o exit code do yt-dlp

O `yt-dlp` instalado no **host** da VM (via `pipx`) não tem runtime JS
(deno/node) pra resolver a assinatura de vídeo do YouTube — isso só existe
**dentro do container** `kairos-api`. Então a chamada de extração no host
quase sempre retorna erro ("Requested format is not available"), mas o
arquivo de cookies **já foi escrito antes disso**, como efeito colateral da
extração do cookie jar. Por isso o script valida pelo **conteúdo do arquivo**
(`[ -s "$TMP_RAW" ]`), não pelo exit code do comando.

## Login inicial (feito uma vez, 02/07/2026)

Não precisa repetir isso a não ser que a sessão da conta expire de vez
(ex: senha trocada, logout forçado pelo Google, 2FA renovado). Se precisar
refazer:

1. Na VM, sobe Xvfb + Chromium (apontado pro perfil persistente) + x11vnc +
   noVNC, só localhost (nunca exposto à internet):
   ```bash
   Xvfb :99 -screen 0 1280x800x24 &
   export DISPLAY=:99
   chromium --no-sandbox --disable-gpu \
     --user-data-dir=/home/ubuntu/projects/kairos-api/chrome-profile \
     --window-size=1280,800 \
     "https://accounts.google.com/signin/v2/identifier?service=youtube" &
   x11vnc -display :99 -nopw -forever -shared -rfbport 5900 &
   websockify --web=/usr/share/novnc 6080 localhost:5900 &
   ```
2. No Mac (ou onde for), abre um túnel SSH: `ssh -L 6080:localhost:6080 ubuntu@<vm> -N`
3. Abre `http://localhost:6080/vnc.html` no navegador, conecta, loga
   manualmente na conta `ica121jogador@gmail.com`.
4. Depois do login confirmado, mata tudo: `pkill -9 -f x11vnc; pkill -9 -f websockify; pkill -9 -f 'Xvfb :99'; pkill -9 -f chrome-profile`
   (o perfil com a sessão fica salvo, só os processos de VNC morrem).

## Requisitos na VM

- `chromium` (snap), `yt-dlp` (`pipx install yt-dlp`, fica em
  `~/.local/bin/yt-dlp`).
- Conta `ica121jogador@gmail.com` logada e saudável (sem 2FA pendente,
  sem flag de segurança do Google).

## Verificar se está rodando

```bash
ssh ubuntu@<vm> "crontab -l | grep refresh-youtube-cookies"
ssh ubuntu@<vm> "tail -10 /home/ubuntu/projects/kairos-api/cookie-refresh.log"
```
