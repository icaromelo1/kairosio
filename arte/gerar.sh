#!/usr/bin/env bash
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
DESTINO="$RAIZ/kairos-ui/public/modelos"
GT="$RAIZ/kairos-ui/node_modules/.bin/gltf-transform"
TEMP="$(mktemp -d)"
trap 'rm -rf "$TEMP"' EXIT

export PINTAR="${PINTAR:-1}"
"$BLENDER" -b --factory-startup --python "$RAIZ/arte/verificar_personagem.py" -- "$TEMP/verificacao" > "$TEMP/verificacao.log" 2>&1
python3 "$RAIZ/arte/catraca_personagem.py" "$TEMP/verificacao/relatorio.json" "$RAIZ/arte/verificacao.base.json"
for nome in mobilia personagem; do
  "$BLENDER" -b --factory-startup --python "$RAIZ/arte/$nome.py" -- "$TEMP/$nome.glb" > "$TEMP/$nome.log" 2>&1
  grep -E 'TRIANGULOS|Error|Traceback' "$TEMP/$nome.log" || true
  "$GT" weld "$TEMP/$nome.glb" "$TEMP/$nome.1.glb" > /dev/null
  "$GT" dedup "$TEMP/$nome.1.glb" "$TEMP/$nome.2.glb" > /dev/null
  "$GT" quantize "$TEMP/$nome.2.glb" "$DESTINO/$nome.glb" > /dev/null
done
MINIATURAS="$RAIZ/kairos-ui/public/personagem/miniaturas"
"$BLENDER" -b --factory-startup --python "$RAIZ/arte/miniaturas.py" -- "$TEMP/miniaturas" > "$TEMP/miniaturas.log" 2>&1
grep -E 'MINIATURAS|Error|Traceback' "$TEMP/miniaturas.log" || true
mkdir -p "$MINIATURAS"
python3 -c "import os, sys
from PIL import Image
o, d = sys.argv[1:]
for f in os.listdir(o):
    Image.open(os.path.join(o, f)).save(os.path.join(d, f[:-4] + '.webp'), 'WEBP', quality=88, method=6)" "$TEMP/miniaturas" "$MINIATURAS"
ls -la "$DESTINO"
