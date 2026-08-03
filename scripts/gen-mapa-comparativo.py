#!/usr/bin/env python3
"""Gera o mundo 120x120 de comparacao das 3 variantes de movel.

Um bloco de 60x60 (2 escritorios + salas + praca) e carimbado 3 vezes:
  (0,0)   -> faixa y<60          -> variante 'vector' (visual atual)
  (0,60)  -> y>=60 e x<60        -> variante 'mine'
  (60,60) -> y>=60 e x>=60       -> variante 'agy'
O quadrante (60,0) recebe a extensao do parque central.
As bandas sao lidas pela posicao em furniture/catalog.ts — o mapa nao carrega
nenhuma marca de variante.
"""
import json
import uuid

objetos = []


def add(kind, x, y, w, h, **extra):
    o = {"id": str(uuid.uuid4())[:8], "kind": kind, "x": x, "y": y, "w": w, "h": h}
    o.update(extra)
    objetos.append(o)


def sala(ox, oy, larg, alt, nome):
    """Paredes da sala via hedge (solido), com vao de porta no meio da parede sul."""
    meio = ox + larg // 2
    add("wall", ox, oy, larg, 1, solid=True)
    add("wall", ox, oy + alt - 1, meio - ox - 1, 1, solid=True)
    add("wall", meio + 1, oy + alt - 1, ox + larg - meio - 1, 1, solid=True)
    add("wall", ox, oy + 1, 1, alt - 2, solid=True)
    add("wall", ox + larg - 1, oy + 1, 1, alt - 2, solid=True)
    add("panel", ox + 1, oy + 1, larg - 2, alt - 2, color="rgba(124,58,237,0.05)")
    _ = nome


def escritorio(ox, oy):
    """Escritorio 26x22: parede externa, telhado que some ao entrar, salas e baias."""
    add("wall", ox - 1, oy - 1, 28, 1, solid=True)
    add("wall", ox - 1, oy + 22, 28, 1, solid=True)
    add("wall", ox - 1, oy, 1, 22, solid=True)
    add("wall", ox + 26, oy, 1, 10, solid=True)
    add("wall", ox + 26, oy + 14, 1, 8, solid=True)
    add("roof", ox - 1, oy - 1, 28, 24)
    sala(ox, oy, 12, 10, "reuniao")
    add("table", ox + 3, oy + 3, 6, 4)
    for i in range(3):
        add("chair", ox + 2 + i * 3, oy + 2, 1, 2)
        add("chair", ox + 2 + i * 3, oy + 7, 1, 2)
    add("board", ox + 1, oy + 1, 10, 1, glow="cyan", name="Lousa da reuniao")

    sala(ox + 14, oy, 12, 10, "servidores")
    add("servers", ox + 16, oy + 2, 4, 2)
    add("servers", ox + 16, oy + 6, 4, 2)
    add("servers", ox + 21, oy + 2, 3, 3)
    add("lamp", ox + 20, oy + 5, 1, 1, glow="purple")

    for linha in range(2):
        for col in range(4):
            bx = ox + 1 + col * 6
            by = oy + 12 + linha * 5
            add("desk", bx, by, 4, 2)
            add("chair", bx + 1, by + 2, 1, 2)
            add("shelf", bx + 5, by, 1, 2) if col < 3 else None

    add("shelf", ox + 24, oy + 12, 2, 6)
    add("plant", ox + 24, oy + 19, 1, 2)
    add("jukebox", ox, oy + 20, 2, 2, glow="gold", name="Jukebox")


def praca(ox, oy):
    """Praca central 26x22: grama, caminho em cruz, fonte, bancos, arvores."""
    add("grass", ox, oy, 26, 22)
    add("path", ox, oy + 10, 26, 2)
    add("path", ox + 12, oy, 2, 22)
    add("fountain", ox + 10, oy + 8, 4, 4, shape="circle")
    for dx, dy in ((3, 4), (20, 4), (3, 16), (20, 16)):
        add("tree", ox + dx, oy + dy, 3, 3)
    for dx, dy in ((8, 5), (16, 5), (8, 15), (16, 15)):
        add("bench", ox + dx, oy + dy, 2, 1)
    for dx, dy in ((6, 8), (19, 8), (6, 13), (19, 13)):
        add("lamp", ox + dx, oy + dy, 1, 1, glow="gold")
    add("flower", ox + 2, oy + 9, 2, 2)
    add("flower", ox + 22, oy + 11, 2, 2)
    add("hedge", ox + 1, oy + 1, 6, 1)
    add("hedge", ox + 19, oy + 20, 6, 1)


def bloco(ox, oy):
    """Bloco urbano de 60x60: 2 escritorios + praca + tapete de ligacao."""
    escritorio(ox + 2, oy + 2)
    escritorio(ox + 32, oy + 2)
    praca(ox + 17, oy + 26)
    add("rug", ox + 2, oy + 50, 12, 8)
    add("sofa", ox + 4, oy + 52, 3, 2)
    add("table", ox + 8, oy + 52, 3, 2)
    add("water", ox + 46, oy + 50, 12, 8)
    add("column", ox + 30, oy + 51, 1, 2)
    add("column", ox + 34, oy + 51, 1, 2)


bloco(0, 0)
bloco(0, 60)
bloco(60, 60)
praca(70, 10)
add("path", 60, 32, 60, 2)

mapa = {
    "id": "comparativo-svg",
    "name": "Comparativo SVG",
    "blurb": "Mundo de debug: mesma planta em 3 variantes de movel",
    "hours": "sempre",
    "label": "DEBUG",
    "width": 120,
    "height": 120,
    "palette": {
        "floor": ["#1a1a26", "#1d1d2a"],
        "floorTrim": "#252535",
        "wall": "#0d0d14",
        "wallTop": "#252535",
        "accent": "#7c3aed",
    },
    "spawn": {"x": 30, "y": 30},
    "objects": objetos,
}

print(json.dumps(mapa))
