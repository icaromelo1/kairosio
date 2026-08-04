#!/usr/bin/env python3
"""Valida um mapa do Kairos contra as proporcoes canonicas dos moveis.

Uso:
    python3 scripts/valida-proporcoes.py mapa.json
    python3 scripts/gen-cidade.py | python3 scripts/valida-proporcoes.py -

Sai com codigo 1 e lista os desvios se algum movel estiver deformado.
"""
import json
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CANONICO = os.path.join(RAIZ, "kairos-ui/src/game/furniture/canonico.json")

SUPERFICIES = {"grass", "path", "water", "panel", "rug", "flower", "wall", "door", "area"}

TOLERANCIA_ASPECTO = 0.02
FATOR_TAMANHO_MAX = 2.0


def carregar_origens():
    base = os.path.join(RAIZ, "kairos-ui/src/game/furniture")
    out = {}
    for nome in sorted(os.listdir(base)):
        caminho = os.path.join(base, nome, "origem.json")
        if os.path.exists(caminho):
            with open(caminho) as f:
                out[nome] = json.load(f)
    return out


def carregar_canonico():
    if not os.path.exists(CANONICO):
        sys.exit(f"ERRO: fonte canonica ausente em {CANONICO}")
    with open(CANONICO) as f:
        dados = json.load(f)
    if not dados:
        sys.exit(f"ERRO: {CANONICO} esta vazio")
    return dados


def validar(mapa, canonico, origens_por_pack):
    desvios = []
    objetos = mapa.get("objects", [])
    if not objetos:
        sys.exit("ERRO: mapa sem objetos — nada foi validado")

    for o in objetos:
        kind = o.get("kind")
        if kind in SUPERFICIES or kind not in canonico:
            continue
        w, h = float(o.get("w", 0)), float(o.get("h", 0))
        if w <= 0 or h <= 0:
            desvios.append(f"{o.get('id', '?')} ({kind}): tamanho invalido {w}x{h}")
            continue

        arte = o.get("arte")
        if arte and arte in origens_por_pack:
            origem = origens_por_pack[arte].get(kind)
            if not origem:
                desvios.append(f"{o.get('id', '?')} ({kind}): pacote {arte} nao tem esse tipo")
                continue
            px_w, px_h = origem["px"]
            cw, ch = px_w / px_h, 1.0
        else:
            alvo = canonico[kind]
            cw, ch = alvo["w"], alvo["hVis"]
        hv = float(o.get("hVis", o.get("h", 0)))
        if hv <= 0:
            desvios.append(f"{o.get('id', '?')} ({kind}): hVis invalido")
            continue
        esperado = cw / ch
        obtido = w / hv
        if abs(obtido - esperado) / esperado > TOLERANCIA_ASPECTO:
            desvios.append(
                f"{o.get('id', '?')} ({kind}): desenho {w:g}x{hv:g} deforma "
                f"— canonico {cw}x{ch}, proporcao {esperado:.2f} vs {obtido:.2f}"
            )
            continue

        if not arte and hv > ch * FATOR_TAMANHO_MAX:
            desvios.append(
                f"{o.get('id', '?')} ({kind}): altura {hv:g} e {hv / ch:.1f}x a canonica "
                f"{ch} — desproporcional ao avatar (2.0 tiles)"
            )
    return desvios


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    origem = sys.argv[1]
    bruto = sys.stdin.read() if origem == "-" else open(origem).read()
    mapa = json.loads(bruto)

    canonico = carregar_canonico()
    desvios = validar(mapa, canonico, carregar_origens())

    total = len(mapa.get("objects", []))
    if desvios:
        print(f"{len(desvios)} desvio(s) em {total} objetos:", file=sys.stderr)
        for d in desvios:
            print(f"  - {d}", file=sys.stderr)
        sys.exit(1)
    print(f"proporcoes ok — {total} objetos verificados contra {len(canonico)} tipos canonicos")


if __name__ == "__main__":
    main()
