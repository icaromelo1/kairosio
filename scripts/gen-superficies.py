#!/usr/bin/env python3
"""Recorta as pecas de autotile das superficies a partir dos tilemaps Kenney.

Le os tilemaps versionados em kairos-ui/src/game/furniture/tilemaps/ e grava
as pecas em kairos-ui/src/game/furniture/superficie/<familia>/<peca>.png.

Cada peca nomeia quais bordas do tile estao EXPOSTAS (viradas para fora da
superficie). O nome nao e decorativo: surfaces.ts escolhe a peca pela mascara
de vizinhanca, entao um indice trocado pinta borda no meio do gramado.

Por isso o script valida o que recortou antes de gravar: compara cada borda com
a peca "mid" da MESMA familia (que por definicao nao tem borda exposta) e confere
contra o que o nome promete. Comparar contra o mid, e nao contra um limiar fixo,
e o que faz o teste valer para grama (borda de terra, delta enorme) e para
calcada (borda um tom acima, delta pequeno). Sai 1 se algum indice divergir.

Uso:
    python3 scripts/gen-superficies.py [--dry-run]
"""
from __future__ import annotations

import os
import sys

TILE = 16
GAP = 1
STEP = TILE + GAP

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TILEMAPS = os.path.join(RAIZ, "kairos-ui/src/game/furniture/tilemaps")
SAIDA = os.path.join(RAIZ, "kairos-ui/src/game/furniture/superficie")

FONTES = {
    "modern-city": (os.path.join(TILEMAPS, "modern-city.png"), 37),
    "rpg-urban": (os.path.join(TILEMAPS, "rpg-urban.png"), 27),
}

# quais bordas cada nome de peca promete ter EXPOSTAS
EXPOSTAS = {
    "mid": set(),
    "top": {"t"}, "bottom": {"b"}, "left": {"l"}, "right": {"r"},
    "tl": {"t", "l"}, "tr": {"t", "r"}, "bl": {"b", "l"}, "br": {"b", "r"},
    "vstrip": {"l", "r"}, "hstrip": {"t", "b"},
    "cap-left": {"t", "b", "l"}, "cap-right": {"t", "b", "r"},
    "cap-top": {"t", "l", "r"}, "cap-bottom": {"b", "l", "r"},
    "isolated": {"t", "b", "l", "r"},
}

FAMILIAS = {
    "wall": {
        "fonte": "modern-city",
        "pecas": {
            "tl": 8, "tr": 9, "top": 10, "left": 11,
            "bl": 45, "br": 46, "bottom": 47, "right": 48,
            "mid": 14, "isolated": 120,
            "hstrip": 84, "vstrip": 122,
            "cap-left": 83, "cap-right": 85,
        },
    },
    "path": {
        "fonte": "modern-city",
        "pecas": {
            "tl": 16, "tr": 17, "top": 18, "left": 19,
            "bl": 53, "br": 54, "bottom": 55, "right": 56,
            "mid": 22, "isolated": 128,
            "hstrip": 92, "vstrip": 130,
            "cap-left": 91, "cap-right": 93,
        },
    },
    "panel": {
        "fonte": "modern-city",
        "pecas": {
            "tl": 24, "tr": 25, "top": 26, "left": 27,
            "bl": 61, "br": 62, "bottom": 63, "right": 64,
            "mid": 30, "isolated": 136,
            "hstrip": 100, "vstrip": 138,
            "cap-left": 99, "cap-right": 101,
        },
    },
    # blob 3x3 regular nas linhas 25-27, colunas 0-2 do modern-city.
    # o mapeamento anterior pegava mid=962, que e a peca LEFT (925+37): toda
    # grama interior saia com uma coluna de terra de 2px na borda esquerda, e
    # como a Cidade tem um unico objeto grass de 120x120, isso virava listra
    # marrom a cada tile. as outras 5 pecas vinham de uma familia diferente.
    "grass": {
        "fonte": "modern-city",
        "pecas": {
            "tl": 925, "top": 926, "tr": 927,
            "left": 962, "mid": 963, "right": 964,
            "bl": 999, "bottom": 1000, "br": 1001,
            "isolated": 1002,
        },
    },
    "water": {
        "fonte": "rpg-urban",
        "pecas": {
            "tl": 0, "tr": 2, "top": 1, "left": 27,
            "bl": 54, "br": 56, "bottom": 55, "right": 29,
            "mid": 28,
        },
    },
}


def recortar(im, idx, cols):
    linha, coluna = divmod(idx, cols)
    x, y = coluna * STEP, linha * STEP
    return im.crop((x, y, x + TILE, y + TILE))


def bordas_expostas(tile, mid):
    """Quais bordas foram decoradas em relacao ao mid da MESMA familia.

    Comparar contra o mid, e nao contra um limiar fixo de cor, e o que faz o
    teste valer para todas as familias: em grass a borda e terra (delta enorme),
    em path e um cinza um tom acima (delta pequeno). O mid, por definicao, nao
    tem borda exposta — entao qualquer decoracao aparece como diferenca.
    """
    a, b = tile.load(), mid.load()

    def difere(p, q):
        if p[3] != q[3]:
            return True
        return sum(abs(x - y) for x, y in zip(p[:3], q[:3])) > 12

    def linha(pontos):
        return sum(difere(a[x, y], b[x, y]) for x, y in pontos) / len(pontos)

    return {
        "t": linha([(x, 0) for x in range(TILE)]),
        "b": linha([(x, TILE - 1) for x in range(TILE)]),
        "l": linha([(0, y) for y in range(TILE)]),
        "r": linha([(TILE - 1, y) for y in range(TILE)]),
        "c": linha([(x, y) for x in range(6, 10) for y in range(6, 10)]),
    }


def main():
    try:
        from PIL import Image
    except ImportError:
        sys.exit("ERRO: Pillow ausente — pip install Pillow")

    dry = "--dry-run" in sys.argv
    problemas = []
    gravados = 0

    for familia, spec in FAMILIAS.items():
        caminho, cols = FONTES[spec["fonte"]]
        im = Image.open(caminho).convert("RGBA")
        destino = os.path.join(SAIDA, familia)

        mid = recortar(im, spec["pecas"]["mid"], cols)

        for nome, idx in spec["pecas"].items():
            tile = recortar(im, idx, cols)
            p = bordas_expostas(tile, mid)
            esperado = EXPOSTAS.get(nome)
            if esperado is None:
                problemas.append(f"{familia}/{nome}: nome fora do vocabulario")
                continue

            for borda in ("t", "b", "l", "r"):
                exposta = p[borda] > 0.5
                deveria = borda in esperado
                if exposta != deveria:
                    problemas.append(
                        f"{familia}/{nome} (tile {idx}): borda {borda} "
                        f"{'decorada' if exposta else 'igual ao mid'}, mas o nome pede "
                        f"{'exposta' if deveria else 'fechada'}"
                    )

            if not dry:
                os.makedirs(destino, exist_ok=True)
                tile.save(os.path.join(destino, f"{nome}.png"))
                gravados += 1

    if problemas:
        print(f"{len(problemas)} problema(s):", file=sys.stderr)
        for p in problemas:
            print(f"  - {p}", file=sys.stderr)
        sys.exit(1)

    for familia, spec in FAMILIAS.items():
        print(f"{familia}: {len(spec['pecas'])} pecas")
    print(f"\n{gravados} arquivo(s) {'validado(s)' if dry else 'gravado(s)'} em {SAIDA}")


if __name__ == "__main__":
    main()
