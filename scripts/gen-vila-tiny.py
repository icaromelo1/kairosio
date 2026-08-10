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

L, A = 36, 36

# Cada tile ocupa 2x2 células do mapa. TILE_PX é 40 e o boneco mede 16*6*0.8 = 77px,
# quase duas células: com tile de 1 célula, uma casa de 3 tiles ficava 1,5x a pessoa e
# uma árvore ficava na metade dela. A 2x o tile vai a 80px, a pessoa mede ~1 tile — a
# proporção da própria arte do Kenney. Dois é escala INTEIRA, então não borra.
ESCALA = 2

# ── vocabulário, pelos nomes do índice curado do tiny-town ────────────────────
GRAMA = [0, 1, 2]
TERRA = 25
TERRA_TOPO, TERRA_BAIXO, TERRA_ESQ, TERRA_DIR = 13, 37, 24, 26
ARVORES = [31, 34]
ARBUSTOS = [27, 28]
COGUMELO = 29
POCOS = [57, 104]
BARRIS = [130, 131]
# 81 = segmento reto horizontal; 56 = segmento reto VERTICAL. Eu usava 47, que é
# poste isolado e curto: repetido na lateral virava fileira de postes soltos em vez
# de cerca contínua. 44/46/68/70 são canto e T — não servem para trecho reto.
CERCA_H, CERCA_V = 81, 56
CERCA_CANTO_SE, CERCA_CANTO_SD = 68, 70
PISO_INTERNO = [108, 109, 110]
PEDRA_LISA = 126
SEBE_ESQ, SEBE_MEIO_ABERTO, SEBE_DIR = 21, 22, 23
CERCA_CANTO = 82
PORTAO = 22          # sebe com passagem: é o vão por onde se entra no pátio
PORTA_CASA = 85
PISO_PEDRA = 43       # piso de pedra circular no gramado: marca a entrada

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
# muro e sebe: sem isto o recinto é só desenho e a pessoa atravessa. Ficaram de fora
# na primeira versão porque o conjunto foi montado antes destas constantes existirem
SOLIDOS.update([PEDRA_LISA, SEBE_ESQ, SEBE_MEIO_ABERTO, SEBE_DIR])

rnd = random.Random(20260809)


def ref(i):
    return {'pack': PACK, 'i': i, 'cols': COLS, 'tile': TILE}


class Vila:
    def __init__(self):
        self.chao = [[rnd.choice(GRAMA) if rnd.random() > 0.82 else 0 for _ in range(L)] for _ in range(A)]
        self.coisas = {}
        self.livre = [[True] * L for _ in range(A)]
        self.salas = []
        self.portas = []

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

    # ── recintos ────────────────────────────────────────────────────────────
    # A área é derivada AQUI, do mesmo retângulo que desenhou o muro. Calcular a
    # área num passo separado é como gente parada do lado de fora passa a contar
    # como dentro: o áudio vaza ao contrário e nada na tela denuncia.
    def patio(self, x, y, larg, alt, nome):
        """Recinto ao ar livre cercado de sebe, com um vão de passagem."""
        portao_x = x + larg // 2
        for dx in range(larg):
            for dy in (0, alt - 1):
                cx, cy = x + dx, y + dy
                if cy == y + alt - 1 and cx == portao_x:
                    # vão de verdade: pedra no chão e nada de sebe por cima, senão a
                    # entrada fica igual ao resto do muro e ninguém acha
                    # peça, não chão: o objeto 'door' é emitido a partir de coisas,
                    # e sem entrada aqui a sala fica sem porta para o espacial.ts
                    self.por(cx, cy, PISO_PEDRA, solido=False)
                    self.portas.append((cx, cy))
                else:
                    self.por(cx, cy, SEBE_MEIO_ABERTO if dx % 3 == 1 else
                             (SEBE_ESQ if dx == 0 else SEBE_DIR if dx == larg - 1 else SEBE_MEIO_ABERTO))
        for dy in range(1, alt - 1):
            self.por(x, y + dy, SEBE_ESQ)
            self.por(x + larg - 1, y + dy, SEBE_DIR)
        self.enfeitar(x + 1, y + 1, x + larg - 1, y + alt - 1, max(3, (larg * alt) // 6))
        self.salas.append({'x': x + 1, 'y': y + 1, 'w': larg - 2, 'h': alt - 2,
                           'nome': nome, 'aberta': True})

    def casa(self, x, y, larg, alt, nome):
        """Cômodo fechado: fachada na frente, pedra lisa nos outros lados."""
        m = rnd.choice(CASAS)
        porta_x = x + larg // 2
        for dy in range(alt):
            for dx in range(larg):
                cx, cy = x + dx, y + dy
                borda = dx in (0, larg - 1)
                if dy == alt - 1:
                    if cx == porta_x:
                        self.por(cx, cy, m['porta'], solido=False)
                        self.portas.append((cx, cy))
                    elif not borda and dx % 2 == 0:
                        self.por(cx, cy, m['janela'])
                    else:
                        self.por(cx, cy, rnd.choice(m['parede']))
                elif dy == 0 or borda:
                    # pedra lisa nos lados e no fundo: a fachada do Tiny é desenhada
                    # de frente, e repetida nos quatro lados o cômodo fica errado
                    self.por(cx, cy, PEDRA_LISA)
                else:
                    # autotile: borda só na borda. Sortear entre os três espalhava
                    # emenda no meio do cômodo e parecia grade preta
                    if dx == 1:
                        piso = PISO_INTERNO[0]
                    elif dx == larg - 2:
                        piso = PISO_INTERNO[2]
                    else:
                        piso = PISO_INTERNO[1]
                    self.chao[cy][cx] = piso
                    self.livre[cy][cx] = False
        self.chao[min(A - 1, y + alt)][porta_x] = PISO_PEDRA
        self.salas.append({'x': x + 1, 'y': y + 1, 'w': larg - 2, 'h': alt - 2,
                           'nome': nome, 'aberta': False})


NOMES_PATIO = ['Praça do Poço', 'Horta Comunitária', 'Pátio da Feira', 'Jardim de Cima',
               'Quintal do Moinho', 'Pomar', 'Largo da Cerca', 'Roda de Conversa']
NOMES_CASA = ['Casa de Pedra', 'Oficina', 'Armazém', 'Casa do Forno']


def gerar():
    v = Vila()
    for y in (11, 24):
        v.rua(1, y, L - 2, y + 1)
    for x in (11, 24):
        v.rua(x, 1, x + 1, A - 2)

    blocos = [(a, b) for a in [(2, 10), (13, 23), (26, L - 3)]
              for b in [(2, 10), (13, 23), (26, A - 3)]]
    rnd.shuffle(blocos)

    npat, ncasa = 0, 0
    for (qx0, qx1), (qy0, qy1) in blocos:
        larg_q, alt_q = qx1 - qx0, qy1 - qy0
        if larg_q < 6 or alt_q < 5:
            continue
        # uma casa a cada três recintos: interior custa arte cuidadosa e o espírito
        # da vila é o encontro ao ar livre
        vira_casa = ncasa < len(NOMES_CASA) and (npat + ncasa) % 3 == 2
        cl = min(larg_q - 1, rnd.randrange(6, 9))
        ca = min(alt_q - 1, rnd.randrange(5, 7))
        cx = qx0 + (larg_q - cl) // 2
        cy = qy0 + (alt_q - ca) // 2
        if vira_casa:
            v.casa(cx, cy, cl, ca, NOMES_CASA[ncasa]); ncasa += 1
        elif npat < len(NOMES_PATIO):
            v.patio(cx, cy, cl, ca, NOMES_PATIO[npat]); npat += 1
        v.enfeitar(qx0, qy0, qx1, qy1, max(5, (larg_q * alt_q) // 14))

    for _ in range(160):
        x, y = rnd.randrange(1, L - 1), rnd.randrange(1, A - 1)
        if (x < 3 or y < 3 or x > L - 4 or y > A - 4) and v.livre[y][x]:
            v.por(x, y, rnd.choice(ARVORES))

    for x in range(1, L - 1):
        v.por(x, 0, CERCA_H)
        v.por(x, A - 1, CERCA_H)
    for y in range(1, A - 1):
        v.por(0, y, CERCA_V)
        v.por(L - 1, y, CERCA_V)
    # as quatro quinas: com segmento reto elas ficariam com a ponta solta
    v.por(0, 0, CERCA_CANTO_SE)
    v.por(L - 1, 0, CERCA_CANTO_SD)
    v.por(0, A - 1, CERCA_V)
    v.por(L - 1, A - 1, CERCA_V)
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
                'id': f'p{n}', 'kind': 'tile', 'x': x * ESCALA, 'y': y * ESCALA,
                'w': ESCALA, 'h': ESCALA, 'solid': False, 'tileRef': ref(piso),
            })
    portas = set(v.portas)
    for (x, y), (i, solido) in sorted(v.coisas.items()):
        n += 1
        objetos.append({
            # kind 'door' nas passagens: é assim que espacial.ts associa a porta à
            # sala e devolve OCLUSAO_PORTA em vez de OCLUSAO_PAREDE para quem passa
            'id': f't{n}', 'kind': 'door' if (x, y) in portas else 'tile',
            'x': x * ESCALA, 'y': y * ESCALA,
            'w': ESCALA, 'h': ESCALA, 'solid': solido, 'tileRef': ref(i),
        })

    for k, s in enumerate(v.salas):
        objetos.append({
            'id': f'sala-{k}', 'kind': 'area', 'name': s['nome'],
            'x': s['x'] * ESCALA, 'y': s['y'] * ESCALA,
            'w': s['w'] * ESCALA, 'h': s['h'] * ESCALA,
            'solid': False, 'aberta': s['aberta'],
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
            'name': 'Vila', 'width': L * ESCALA, 'height': A * ESCALA,
            'spawn': {'x': (L // 2) * ESCALA, 'y': 11 * ESCALA},
            'palette': {
                # forma exigida pelo MapPalette (maps.ts:9): floor é PAR de cores,
                # não existe 'ground'. Eu tinha inventado essa chave e o chão saía
                # cinza. #84c669 é a cor medida do tile 0 de grama.
                'floor': ['#84c669', '#84c669'],
                'floorTrim': '#6aa552',
                'wall': '#7a6a52',
                'wallTop': '#a08a68',
                'accent': '#f0b03c',
            },
            'objects': objetos,
        }
        with open(args.json, 'w') as f:
            json.dump(mapa, f, ensure_ascii=False)
        solidos = sum(1 for o in objetos if o['solid'])
        print(f'{len(objetos)} objetos ({solidos} sólidos) -> {args.json}', file=sys.stderr)


if __name__ == '__main__':
    main()
