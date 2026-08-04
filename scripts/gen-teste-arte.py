#!/usr/bin/env python3
"""Gera o mundo de comparacao de pacotes de arte.

A mesma planta e carimbada uma vez por zona, mudando so o campo `arte` dos
moveis. O nome do pacote e escrito no chao com uma fonte de 3x5 usando objetos
`custom`, porque o mapa nao tem tipo de texto e o nome da area nao aparece no
HUD. Imprime o JSON no stdout.

So entram zonas de pacote REALMENTE instalado — zona sem pacote cairia no SVG e
renderizaria identica a ele, o que nao compara nada.
"""
import json
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FURNITURE = os.path.join(RAIZ, "kairos-ui/src/game/furniture")
CANONICO = json.load(open(os.path.join(FURNITURE, "canonico.json")))

FONTE = {
    "A": ["010", "101", "111", "101", "101"],
    "C": ["011", "100", "100", "100", "011"],
    "E": ["111", "100", "110", "100", "111"],
    "F": ["111", "100", "110", "100", "100"],
    "G": ["011", "100", "101", "101", "011"],
    "I": ["111", "010", "010", "010", "111"],
    "K": ["101", "110", "100", "110", "101"],
    "L": ["100", "100", "100", "100", "111"],
    "N": ["101", "111", "111", "111", "101"],
    "O": ["010", "101", "101", "101", "010"],
    "P": ["110", "101", "110", "100", "100"],
    "R": ["110", "101", "110", "101", "101"],
    "S": ["011", "100", "010", "001", "110"],
    "T": ["111", "010", "010", "010", "010"],
    "V": ["101", "101", "101", "101", "010"],
    "Y": ["101", "101", "010", "010", "010"],
    "0": ["111", "101", "101", "101", "111"],
    " ": ["000", "000", "000", "000", "000"],
}


def pixels_do_texto(texto, cor):
    linhas = ["" for _ in range(5)]
    for ch in texto.upper():
        glifo = FONTE.get(ch, FONTE[" "])
        for i in range(5):
            linhas[i] += glifo[i] + "0"
    return [[cor if c == "1" else None for c in linha] for linha in linhas]


def pacotes_instalados():
    achados = []
    for nome in sorted(os.listdir(FURNITURE)):
        caminho = os.path.join(FURNITURE, nome)
        if not os.path.isdir(caminho) or nome in ("svg", "svg-surface"):
            continue
        pngs = [f for f in os.listdir(caminho) if f.endswith(".png")]
        if pngs:
            achados.append((nome, len(pngs)))
    return achados


ZONAS = [{"id": "svg", "arte": None, "rotulo": "SVG", "cor": "#c9b79c"}]
for nome, _ in pacotes_instalados():
    ZONAS.append({"id": nome, "arte": nome, "rotulo": nome, "cor": "#b9c2a8"})

if len(ZONAS) < 2:
    raise SystemExit("ERRO: nenhum pacote PNG instalado — o mundo compararia o SVG com ele mesmo")

ZONA_W, ZONA_H = 34, 32
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
        name=spec["rotulo"], aberta=True)

    matriz = pixels_do_texto(spec["rotulo"], "#3b332a")
    largura_txt = len(matriz[0]) * 0.55
    add("custom", ox + 2, oy + 1, largura_txt, 3, pixels=matriz)

    col_x = [ox + 3, ox + 11, ox + 19, ox + 26]
    linha_y = oy + 7
    for i, kind in enumerate(TIPOS):
        mob(kind, col_x[i % 4], linha_y + (i // 4) * 6, spec["arte"])


for i, spec in enumerate(ZONAS):
    zona(i, spec)

add("path", MARGEM, ALTURA - MARGEM - 2, LARGURA - MARGEM * 2, 2)

mapa = {
    "id": "teste-arte",
    "name": "Teste de Arte",
    "blurb": "Mesma planta em cada pacote de arte instalado, lado a lado",
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
