#!/usr/bin/env python3
"""Consolida os JSON de classificacao de tiles num indice unico.

Junta os arquivos parciais, confere que a cobertura e total e sem duplicata,
mede a area opaca de cada tile (para o renderizador derivar proporcao do
proprio sprite em vez de espremer na caixa canonica do SVG) e grava o indice.

O `cols` vem da largura do PNG, e o nome do pack e argumento — antes os dois eram
constantes de rpg-urban, o que media o tile errado em qualquer pack mais estreito.

Uso:
    python3 scripts/consolida-indice.py <dirParciais> <tilemap.png> <saida.json> <pack>

Sai 1 se faltar tile, houver duplicata ou categoria fora do vocabulario.
"""
from __future__ import annotations

import glob
import json
import os
import sys

CATEGORIAS = {
    "piso", "parede", "porta", "janela", "movel", "natureza",
    "veiculo", "personagem", "sinal", "decoracao", "item", "vazio",
}
SOLIDOS = {"parede", "movel", "natureza", "veiculo", "decoracao"}

TILE = 16
GAP = 1


def colunas_de(tilemap):
    """cols vem da largura do PNG, não de constante: com o valor errado o script
    mede o tile vizinho e ninguém percebe olhando o JSON."""
    try:
        from PIL import Image
    except ImportError:
        sys.exit("ERRO: Pillow ausente — pip install Pillow")
    largura = Image.open(tilemap).size[0]
    cols = (largura + GAP) // (TILE + GAP)
    if cols * (TILE + GAP) - GAP != largura:
        sys.exit(f"ERRO: {tilemap} tem {largura}px, que não fecha grade de {TILE}px com {GAP}px de gap")
    return cols


def medir_opacos(tilemap, cols):
    from PIL import Image

    im = Image.open(tilemap).convert("RGBA")
    medidas = {}
    linhas = (im.height + GAP) // (TILE + GAP)
    for r in range(linhas):
        for c in range(cols):
            i = r * cols + c
            sx, sy = c * (TILE + GAP), r * (TILE + GAP)
            recorte = im.crop((sx, sy, sx + TILE, sy + TILE))
            bb = recorte.getbbox()
            medidas[i] = {"w": 0, "h": 0} if not bb else {
                "w": bb[2] - bb[0], "h": bb[3] - bb[1],
            }
    return medidas


def main():
    if len(sys.argv) != 5:
        sys.exit(__doc__)
    dir_parciais, tilemap, saida, pack = sys.argv[1:5]
    cols = colunas_de(tilemap)

    arquivos = sorted(glob.glob(os.path.join(dir_parciais, "*.json")))
    if not arquivos:
        sys.exit(f"ERRO: nenhum JSON parcial em {dir_parciais}")

    tiles = {}
    duplicados = []
    for caminho in arquivos:
        with open(caminho) as f:
            dados = json.load(f)
        for t in dados.get("tiles", []):
            i = int(t["i"])
            if i in tiles:
                duplicados.append(i)
                continue
            tiles[i] = t

    problemas = []
    if duplicados:
        problemas.append(f"{len(duplicados)} indices duplicados: {sorted(set(duplicados))[:10]}")

    for i, t in sorted(tiles.items()):
        if t.get("cat") not in CATEGORIAS:
            problemas.append(f"tile {i}: categoria invalida {t.get('cat')!r}")
        if not t.get("nome"):
            problemas.append(f"tile {i}: sem nome")

    esperado = set(range(max(tiles) + 1)) if tiles else set()
    faltando = sorted(esperado - set(tiles))
    if faltando:
        problemas.append(f"{len(faltando)} tiles sem classificacao: {faltando[:10]}")

    if problemas:
        print(f"{len(problemas)} problema(s):", file=sys.stderr)
        for p in problemas:
            print(f"  - {p}", file=sys.stderr)
        sys.exit(1)

    medidas = medir_opacos(tilemap, cols)
    for i, t in tiles.items():
        m = medidas.get(i, {"w": 0, "h": 0})
        t["opaco"] = m
        t["solido"] = t["cat"] in SOLIDOS
        t.setdefault("tags", [])
        t.setdefault("serveComo", [])
        t.setdefault("revisado", False)

    indice = {
        "pack": pack,
        "tile": TILE,
        "cols": cols,
        "categorias": sorted(CATEGORIAS),
        "tiles": [tiles[i] for i in sorted(tiles)],
    }
    with open(saida, "w") as f:
        json.dump(indice, f, ensure_ascii=False, indent=1)

    from collections import Counter
    por_cat = Counter(t["cat"] for t in indice["tiles"])
    print(f"indice com {len(indice['tiles'])} tiles -> {saida}")
    for cat, n in por_cat.most_common():
        print(f"  {n:4d}  {cat}")


if __name__ == "__main__":
    main()
