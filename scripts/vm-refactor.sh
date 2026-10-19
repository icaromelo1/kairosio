#!/usr/bin/env bash
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
DESTINO="projects/kairos-refactor"

rsync -az --delete \
  --exclude node_modules --exclude dist --exclude .git --exclude .env \
  --exclude 'kairos-api/music-cache' --exclude 'kairos-api/avatar-cache' \
  --exclude 'e2e/test-results' --exclude 'e2e/playwright-report' \
  "$RAIZ/" "oracle-vm:$DESTINO/"

ssh -o BatchMode=yes oracle-vm "bash -s" <<'REMOTO'
set -euo pipefail
cd ~/projects/kairos-refactor/kairos-api
npm ci --legacy-peer-deps --no-audit --no-fund >/dev/null
npx nest build
cd ../kairos-ui
npm ci --legacy-peer-deps --no-audit --no-fund >/dev/null
npx vite build >/dev/null
pm2 delete kairos-refactor-api kairos-refactor-ui >/dev/null 2>&1 || true
cd ~/projects/kairos-refactor/kairos-api
pm2 start dist/main.js --name kairos-refactor-api >/dev/null
cd ~/projects/kairos-refactor/kairos-ui
pm2 start npx --name kairos-refactor-ui -- vite preview --host 127.0.0.1 --port 4180 --strictPort >/dev/null
sleep 4
pm2 jlist | python3 -c "import sys,json; [print(p['name'], p['pm2_env']['status']) for p in json.load(sys.stdin) if p['name'].startswith('kairos-refactor')]"
REMOTO
