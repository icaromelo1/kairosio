#!/usr/bin/env bash
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
DESTINO="$RAIZ/kairos-ui/public/modelos"
GT="$RAIZ/kairos-ui/node_modules/.bin/gltf-transform"
TEMP="$(mktemp -d)"
trap 'rm -rf "$TEMP"' EXIT

export PINTAR="${PINTAR:-1}"
for nome in mobilia personagem; do
  "$BLENDER" -b --factory-startup --python "$RAIZ/arte/$nome.py" -- "$TEMP/$nome.glb" > "$TEMP/$nome.log" 2>&1
  grep -E 'TRIANGULOS|Error|Traceback' "$TEMP/$nome.log" || true
  "$GT" weld "$TEMP/$nome.glb" "$TEMP/$nome.1.glb" > /dev/null
  "$GT" dedup "$TEMP/$nome.1.glb" "$TEMP/$nome.2.glb" > /dev/null
  "$GT" quantize "$TEMP/$nome.2.glb" "$DESTINO/$nome.glb" > /dev/null
done
ls -la "$DESTINO"
