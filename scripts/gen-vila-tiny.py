#!/usr/bin/env python3
"""Gera uma vila feita SÓ de sprites do Tiny Town, em grade inteira.

Por que um mapa novo e não uma conversão da Cidade: os 661 objetos de lá têm
tamanho fracionário (1.31x1, 1.79x1...) porque são formas vetoriais desenhadas pelo
scene.ts. Um sprite de 16x16 esticado para 1,31 célula fica borrado — pixel art não
sobrevive a escala não inteira. Recriar com sprite é gerar em grade inteira, não
remapear o que existe.

Todo objeto sai 1x1 com tileRef, que é o formato que o criarSpriteDeTile desenha
sem esticar.

Uso:
    python3 scripts/gen-vila-tiny.py --json vila.json
    python3 scripts/gen-vila-tiny.py --previa vila.png
"""
import argparse
import json
import os
import random
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
FURNITURE = os.path.join(AQUI, '..', 'kairos-ui/src/game/furniture')
PACK, COLS, TILE = 'tiny-town', 12, 16

L, A = 48, 48

# ── vocabulário, pelos nomes do índice curado do tiny-town ────────────────────
GRAMA = [0, 1, 2]
TERRA = 25
TERRA_TOPO, TERRA_BAIXO, TERRA_ESQ, TERRA_DIR = 13, 37, 24, 26
ARVORES = [31, 34]
ARBUSTOS = [27, 28]
COGUMELO = 29
POCOS = [57, 104]
BARRIS = [130, 131]
CERCA_H, CERCA_V = 81, 47
PISO_INTERNO = [108, 109, 110]

# cada material de casa: parede, janela, porta. Vem em conjunto porque misturar
# janela de pedra em parede de madeira é o tipo de coisa que só se vê depois
CASAS = [
    {'parede': [48, 49], 'borda': 50, 'janela': 51, 'porta': 85},
    {'parede': [52, 53], 'borda': 54, 'janela': 55, 'porta': 86},
    {'parede': [64, 65], 'borda': 66, 'janela': 55, 'porta': 87},
    {'parede': [72, 73], 'borda': 75, 'janela': 84, 'porta': 74},
    {'parede': [76, 77], 'borda': 79, 'janela': 88, 'porta': 78},
]

SOLIDOS = set()
for c in CASAS:
    SOLIDOS.update(c['parede'])
    SOLIDOS.add(c['borda'])
    SOLIDOS.add(c['janela'])
SOLIDOS.update(ARVORES + ARBUSTOS + POCOS + BARRIS + [CERCA_H, CERCA_V])

rnd = random.Random(20260809)


def ref(i):
    return {'pack': PACK, 'i': i, 'cols': COLS, 'tile': TILE}


class Vila:
    def __init__(self):
        self.chao = [[rnd.choice(GRAMA) if rnd.random() > 0.82 else 0 for _ in range(L)] for _ in range(A)]
        self.coisas = {}
        self.livre = [[True] * L for _ in range(A)]

    def por(self, x, y, i, solido=None):
        if not (0 <= x < L and 0 <= y < A):
            return
        self.coisas[(x, y)] = (i, i in SOLIDOS if solido is None else solido)
        self.livre[y][x] = False

    def rua(self, x0, y0, x1, y1):
        """Trilha de terra com as bordas certas, para não ficar recorte quadrado."""
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if not (0 <= x < L and 0 <= y < A):
                    continue
                self.chao[y][x] = TERRA
                self.livre[y][x] = False
        for x in range(x0, x1 + 1):
            if 0 <= x < L:
                if y0 - 1 >= 0 and self.chao[y0 - 1][x] != TERRA:
                    self.chao[y0][x] = TERRA_TOPO
                if y1 + 1 < A and self.chao[y1 + 1][x] != TERRA:
                    self.chao[y1][x] = TERRA_BAIXO
        for y in range(y0, y1 + 1):
            if 0 <= y < A:
                if x0 - 1 >= 0 and self.chao[y][x0 - 1] != TERRA:
                    self.chao[y][x0] = TERRA_ESQ
                if x1 + 1 < L and self.chao[y][x1 + 1] != TERRA:
                    self.chao[y][x1] = TERRA_DIR

    def casa(self, x, y, larg, alt):
        """Fachada: paredes com uma porta e janelas, e chão de interior por dentro."""
        m = rnd.choice(CASAS)
        porta_x = x + rnd.randrange(1, max(2, larg - 1))
        for dy in range(alt):
            for dx in range(larg):
                cx, cy = x + dx, y + dy
                borda = dx == larg - 1
                if dy == alt - 1 and cx == porta_x:
                    self.por(cx, cy, m['porta'], solido=False)
                elif dy == alt - 1 and dx % 2 == 0 and not borda:
                    self.por(cx, cy, m['janela'])
                else:
                    self.por(cx, cy, m['borda'] if borda else rnd.choice(m['parede']))
        # piso na frente da porta, para a entrada não nascer na grama
        self.chao[min(A - 1, y + alt)][porta_x] = rnd.choice(PISO_INTERNO)

    def enfeitar(self, x0, y0, x1, y1, quanto):
        vagas = [(x, y) for y in range(y0, y1) for x in range(x0, x1) if self.livre[y][x]]
        rnd.shuffle(vagas)
        for x, y in vagas[:quanto]:
            r = rnd.random()
            if r < 0.58:
                self.por(x, y, rnd.choice(ARVORES))
            elif r < 0.80:
                self.por(x, y, rnd.choice(ARBUSTOS))
            elif r < 0.88:
                self.por(x, y, COGUMELO, solido=False)
            elif r < 0.95:
                self.por(x, y, rnd.choice(BARRIS))
            else:
                self.por(x, y, rnd.choice(POCOS))


def gerar():
    v = Vila()
    # avenidas: duas horizontais e duas verticais, largura 2, deixando 9 quarteirões
    for y in (11, 25, 39):
        v.rua(1, y, L - 2, y + 1)
    for x in (11, 25, 39):
        v.rua(x, 1, x + 1, A - 2)

    limites_x = [(2, 10), (13, 24), (27, 38), (41, L - 3)]
    limites_y = [(2, 10), (13, 24), (27, 38), (41, A - 3)]
    for (qx0, qx1) in limites_x:
        for (qy0, qy1) in limites_y:
            larg_q, alt_q = qx1 - qx0, qy1 - qy0
            if larg_q < 5 or alt_q < 4:
                continue
            for _ in range(1 if larg_q < 10 else 2):
                cl = rnd.randrange(4, max(5, min(7, larg_q)))
                ca = rnd.randrange(3, max(4, min(5, alt_q)))
                if qx1 - cl <= qx0 or qy1 - ca - 1 <= qy0:
                    continue
                cx = rnd.randrange(qx0, qx1 - cl)
                cy = rnd.randrange(qy0, qy1 - ca - 1)
                if all(v.livre[yy][xx] for yy in range(cy, cy + ca + 1) for xx in range(cx, cx + cl)):
                    v.casa(cx, cy, cl, ca)
            v.enfeitar(qx0, qy0, qx1, qy1, max(8, (larg_q * alt_q) // 9))

    # bosque na moldura: a vila fica cercada de mata em vez de grama vazia
    for _ in range(160):
        x, y = rnd.randrange(1, L - 1), rnd.randrange(1, A - 1)
        na_borda = x < 3 or y < 3 or x > L - 4 or y > A - 4
        if na_borda and v.livre[y][x]:
            v.por(x, y, rnd.choice(ARVORES))

    # cerca contornando a vila inteira
    for x in range(1, L - 1):
        v.por(x, 0, CERCA_H)
        v.por(x, A - 1, CERCA_H)
    for y in range(A):
        v.por(0, y, CERCA_V)
        v.por(L - 1, y, CERCA_V)
    return v


GRAMA_LISA = 0

def para_objetos(v):
    """Grama lisa NÃO vira objeto: o palette.ground pinta #84c669, que é a cor
    exata do tile 0, então a omissão é invisível. Emitir as 2304 células como
    objeto próprio inflava o seed em 12x e punha um container por célula na cena."""
    objetos = []
    n = 0
    for y in range(A):
        for x in range(L):
            piso = v.chao[y][x]
            if piso == GRAMA_LISA:
                continue
            n += 1
            objetos.append({
                'id': f'p{n}', 'kind': 'tile', 'x': x, 'y': y, 'w': 1, 'h': 1,
                'solid': False, 'tileRef': ref(piso),
            })
    for (x, y), (i, solido) in sorted(v.coisas.items()):
        n += 1
        objetos.append({
            'id': f't{n}', 'kind': 'tile', 'x': x, 'y': y, 'w': 1, 'h': 1,
            'solid': solido, 'tileRef': ref(i),
        })
    return objetos


def previa(v, destino):
    from PIL import Image
    folha = Image.open(os.path.join(FURNITURE, f'tilemaps/{PACK}.png')).convert('RGBA')
    passo = TILE + 1

    def recorte(i):
        c, r = i % COLS, i // COLS
        return folha.crop((c * passo, r * passo, c * passo + TILE, r * passo + TILE))

    img = Image.new('RGBA', (L * TILE, A * TILE), (30, 32, 38, 255))
    for y in range(A):
        for x in range(L):
            img.alpha_composite(recorte(v.chao[y][x]), (x * TILE, y * TILE))
    for (x, y), (i, _) in sorted(v.coisas.items()):
        img.alpha_composite(recorte(i), (x * TILE, y * TILE))
    img.convert('RGB').save(destino)
    print(f'prévia em {destino} ({L * TILE}x{A * TILE}px)', file=sys.stderr)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--json')
    ap.add_argument('--previa')
    args = ap.parse_args()
    v = gerar()
    if args.previa:
        previa(v, args.previa)
    if args.json:
        objetos = para_objetos(v)
        mapa = {
            'name': 'Vila', 'width': L, 'height': A,
            'spawn': {'x': L // 2, 'y': 15},
            'palette': {'ground': '#84c669', 'accent': '#f0b03c', 'wallTop': '#8d6b4a', 'floorTrim': '#b39b74'},
            'objects': objetos,
        }
        with open(args.json, 'w') as f:
            json.dump(mapa, f, ensure_ascii=False)
        solidos = sum(1 for o in objetos if o['solid'])
        print(f'{len(objetos)} objetos ({solidos} sólidos) -> {args.json}', file=sys.stderr)


if __name__ == '__main__':
    main()
