#!/bin/bash
# Gera o SVG de um móvel via agy (Gemini), sob o contrato de docs/design/contrato-arte-svg.md.
# Uso: ./gen-svg-agy.sh <kind> "<descricao do movel>" [proporcao]
set -euo pipefail

KIND="${1:?informe o kind}"
DESC="${2:?informe a descricao}"
PROP="${3:-1x1}"
OUT_DIR="$(dirname "$0")/../kairos-ui/src/game/furniture/svg-agy"
SCHEMA="$(mktemp)"
mkdir -p "$OUT_DIR"

cat > "$SCHEMA" <<'JSON'
{
  "type": "object",
  "required": ["viewBox", "shapeCount", "svg"],
  "properties": {
    "viewBox":    { "type": "string", "const": "0 0 100 100" },
    "shapeCount": { "type": "integer", "maximum": 24 },
    "svg":        { "type": "string" }
  }
}
JSON

PROMPT="Desenhe um SVG de: ${DESC}.

Destino: jogo 2.5D top-down com billboards ancorados na base (estilo Stardew Valley/Gather.town). O objeto renderiza entre 32 e 96 pixels na tela.

REGRAS OBRIGATORIAS:
1. viewBox exatamente \"0 0 100 100\". Retorne no campo svg APENAS o conteudo interno, sem a tag <svg> externa, sem <?xml?>, sem comentarios <!-- -->.
2. Proibido: <defs>, <filter>, <mask>, <clipPath>, gradiente (linearGradient/radialGradient). Apenas formas solidas: path, rect, circle, ellipse, polygon.
3. Projecao: vista FRONTAL levemente elevada. NUNCA top-down puro, NUNCA isometrico.
4. O objeto apoia em y=100 (pes/base/rodas tocam essa linha). Ocupa de x=0 a x=100 sem sobra.
5. Luz vindo do TOPO-ESQUERDA: face esquerda mais clara, direita mais escura.
6. Inclua uma sombra de contato: elipse achatada em y=97, cor #141024, opacity 0.5.
7. MAXIMO DE 24 FORMAS. Detalhe abaixo de 2px vira ruido a 32px — priorize a SILHUETA, que e o que se enxerga no tamanho real. Sem costura, parafuso, textura ou reflexo pequeno.
8. Sem stroke com largura menor que 1. Prefira forma preenchida a contorno fino.
9. PALETA FECHADA — use SOMENTE estas cores, nenhuma outra:
   #141024 #1d1833 #251f3d #342b54 #483c73 #5d4e94 #7362b3 #8c7ae6 #352b1a #5a4a32 #2e3545 #7888a0
10. Proporcao canonica do objeto: ${PROP} (largura x altura em tiles). Desenhe pensando nessa proporcao.

Informe em shapeCount o numero real de formas que voce usou."

RESP=$(agy -p "$PROMPT" --model gemini-3.6-flash-high --json-schema "$SCHEMA" --output-format json 2>&1)
rm -f "$SCHEMA"

echo "$RESP" | python3 -c "
import sys, json, re
raw = sys.stdin.read()
try:
    data = json.loads(raw)
except Exception:
    print('ERRO: resposta nao e JSON'); print(raw[:400]); sys.exit(1)
out = data.get('structured_output')
if not out:
    print('ERRO: sem structured_output'); print(raw[:400]); sys.exit(1)
svg = out['svg']
PALETA = {'#141024','#1d1833','#251f3d','#342b54','#483c73','#5d4e94','#7362b3','#8c7ae6','#352b1a','#5a4a32','#2e3545','#7888a0'}
usadas = set(c.lower() for c in re.findall(r'#[0-9a-fA-F]{6}', svg))
fora = usadas - PALETA
proibidas = [t for t in ('<defs','<filter','<mask','<clipPath','Gradient','<svg','<?xml') if t in svg]
formas = len(re.findall(r'<(path|rect|circle|ellipse|polygon)\b', svg))
print('shapeCount declarado:', out.get('shapeCount'))
print('formas reais:', formas)
print('cores fora da paleta:', ' '.join(sorted(fora)) if fora else 'nenhuma')
print('tags proibidas:', ' '.join(proibidas) if proibidas else 'nenhuma')
open('$OUT_DIR/$KIND.svg','w').write('<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\">\n' + svg + '\n</svg>\n')
print('salvo: $OUT_DIR/$KIND.svg')
"
