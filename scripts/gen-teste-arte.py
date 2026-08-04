#!/usr/bin/env python3
"""Gera o mundo de comparacao de pacotes de arte.

A mesma planta e carimbada uma vez por zona, mudando so o campo `arte` dos
moveis. Cada zona tem uma placa com o nome do pacote. Imprime o JSON no stdout.
"""
import json
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CANONICO = json.load(open(os.path.join(RAIZ, "kairos-ui/src/game/furniture/canonico.json")))

ZONAS = [
    {"id": "svg", "arte": None, "nome": "SVG oficial", "cor": "#c9b79c"},
    {"id": "kenney", "arte": "kenney", "nome": "Kenney CC0", "cor": "#b9c2a8"},
    {"id": "lpc", "arte": "lpc", "nome": "LPC (a instalar)", "cor": "#c2b0a8"},
    {"id": "livre", "arte": "livre", "nome": "Reservado", "cor": "#b0b6c2"},
]

ZONA_W, ZONA_H = 34, 30
MARGEM = 2
LARGURA = MARGEM + len(ZONAS) * ZONA_W + MARGEM
ALTURA = MARGEM + ZONA_H + MARGEM

objetos = []
contador = {}


def novo_id(prefixo):
    contador[prefixo] = contador.get(prefixo, 0) + 1
    return f"{prefixo}-{contador[prefixo]}"


def add(kind, x, y, w, h, **extra):
    o = {"id": novo_id(kind), "kind": kind, "x": round(x, 2), "y": round(y, 2),
         "w": round(w, 2), "h": round(h, 2)}
    o.update(extra)
    objetos.append(o)


def mob(kind, x, y, arte=None):
    d = CANONICO[kind]
    extra = {"hVis": d["hVis"], "solid": True}
    if arte:
        extra["arte"] = arte
    add(kind, x, y, d["w"], d["h"], **extra)


TIPOS = ["chair", "table", "desk", "sofa", "bench", "shelf", "plant", "lamp",
         "column", "jukebox", "servers", "board", "tree", "hedge", "fountain"]


def zona(indice, spec):
    ox = MARGEM + indice * ZONA_W
    oy = MARGEM
    add("panel", ox, oy, ZONA_W - 2, ZONA_H, color=spec["cor"])
    add("area", ox, oy, ZONA_W - 2, ZONA_H, id=f"zona-{spec['id']}",
        name=spec["nome"], aberta=True)

    col_x = [ox + 3, ox + 11, ox + 19, ox + 26]
    linha_y = oy + 5
    passo_y = 6
    for i, kind in enumerate(TIPOS):
        cx = col_x[i % 4]
        cy = linha_y + (i // 4) * passo_y
        mob(kind, cx, cy, spec["arte"])

    add("board", ox + 1, oy + 1, CANONICO["board"]["w"], 1,
        hVis=CANONICO["board"]["hVis"], name=spec["nome"],
        action="Comparar pacote", glow="gold",
        **({"arte": spec["arte"]} if spec["arte"] else {}))


for i, spec in enumerate(ZONAS):
    zona(i, spec)

add("path", MARGEM, ALTURA - MARGEM - 2, LARGURA - MARGEM * 2, 2)

mapa = {
    "id": "teste-arte",
    "name": "Teste de Arte",
    "blurb": "Mesma planta em cada pacote de arte, lado a lado",
    "hours": "sempre",
    "label": "DEBUG",
    "width": LARGURA,
    "height": ALTURA,
    "spawn": {"x": MARGEM + 4, "y": ALTURA - MARGEM - 1},
    "palette": {
        "floor": ["#d8d2c6", "#cfc9bc"],
        "floorTrim": "#8a7f6e",
        "wall": "#9a8b74",
        "wallTop": "#b5603f",
        "accent": "#d9a441",
    },
    "objects": objetos,
}

print(json.dumps(mapa, ensure_ascii=False))
