"""Prova que a recoloração por máscara não vaza entre regiões.

O teste só vale se conseguir falhar: por isso ele roda também o swap indexado
que o design descartou, e exige que ESSE vaze. Se os dois passarem, o teste não
está medindo nada.
"""
import colorsys
import glob
import sys
from collections import Counter

from PIL import Image

ALVO = '#7b3fa8'


def regiao(px):
    r, g, b, a = px
    if a < 128:
        return None
    if r > 200 and g > 200 and b > 200:
        return 'contorno'
    if r > 200:
        return 'pele'
    if g > 200:
        return 'cabelo'
    return 'roupa'


def lum(r, g, b):
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255


def por_mascara(arte, masc, alvo):
    """O que o motor faz: a máscara decide, a rampa preserva sombra e luz."""
    ap, mp = arte.load(), masc.load()
    w, h = arte.size
    tr, tg, tb = (int(alvo[i:i + 2], 16) for i in (1, 3, 5))
    h0, l0, s0 = colorsys.rgb_to_hls(tr / 255, tg / 255, tb / 255)
    lo, hi = 1.0, 0.0
    for y in range(h):
        for x in range(w):
            if ap[x, y][3] >= 128 and regiao(mp[x, y]) == 'cabelo':
                L = lum(*ap[x, y][:3])
                lo, hi = min(lo, L), max(hi, L)
    saida = {}
    for y in range(h):
        for x in range(w):
            if ap[x, y][3] < 128:
                continue
            if regiao(mp[x, y]) != 'cabelo':
                saida[(x, y)] = ap[x, y][:3]
                continue
            L = lum(*ap[x, y][:3])
            p = (L - lo) / (hi - lo) if hi > lo else 0.5
            base, topo = l0 * 0.55, min(1.0, l0 * 1.35)
            saida[(x, y)] = tuple(round(c * 255) for c in colorsys.hls_to_rgb(h0, base + p * (topo - base), s0))
    return saida


def por_indice(arte, masc, alvo):
    """O que o design descartou: troca toda ocorrência das cores 'de cabelo'."""
    ap, mp = arte.load(), masc.load()
    w, h = arte.size
    do_cabelo = {ap[x, y][:3] for y in range(h) for x in range(w)
                 if ap[x, y][3] >= 128 and regiao(mp[x, y]) == 'cabelo'}
    novo = tuple(int(alvo[i:i + 2], 16) for i in (1, 3, 5))
    saida = {}
    for y in range(h):
        for x in range(w):
            if ap[x, y][3] < 128:
                continue
            c = ap[x, y][:3]
            saida[(x, y)] = novo if c in do_cabelo else c
    return saida


def vazamento(arte, masc, depois):
    """Quantos pixels FORA do cabelo mudaram."""
    ap, mp = arte.load(), masc.load()
    w, h = arte.size
    fora = Counter()
    for y in range(h):
        for x in range(w):
            if ap[x, y][3] < 128:
                continue
            reg = regiao(mp[x, y])
            if reg == 'cabelo':
                continue
            if depois[(x, y)] != ap[x, y][:3]:
                fora[reg or '?'] += 1
    return fora


def main():
    falhas = 0
    testados = 0
    for caminho in sorted(glob.glob('kairos-ui/src/game/furniture/avatar/*/*.png')):
        preset_quadro = caminho.split('/avatar/')[1]
        m = f'kairos-ui/src/game/furniture/avatar-mascaras/{preset_quadro}'
        try:
            arte = Image.open(caminho).convert('RGBA')
            masc = Image.open(m).convert('RGBA')
        except FileNotFoundError:
            continue
        mp = masc.load()
        w, h = masc.size
        tem_cabelo = any(regiao(mp[x, y]) == 'cabelo' for y in range(h) for x in range(w))
        if not tem_cabelo:
            continue  # sem região de cabelo não há o que provar neste quadro
        testados += 1

        vaza_mascara = vazamento(arte, masc, por_mascara(arte, masc, ALVO))
        vaza_indice = vazamento(arte, masc, por_indice(arte, masc, ALVO))

        if sum(vaza_mascara.values()):
            print(f'FALHOU  {preset_quadro}: máscara vazou {dict(vaza_mascara)}')
            falhas += 1
        if not sum(vaza_indice.values()):
            print(f'INÚTIL  {preset_quadro}: o swap indexado NÃO vazou — o teste não mede nada aqui')
            falhas += 1

    print(f'\n{testados} quadros com região de cabelo testados')
    print(f'{"todos passaram" if not falhas else str(falhas) + " problema(s)"}')
    return 1 if falhas else 0


if __name__ == '__main__':
    sys.exit(main())
