"""Gera as máscaras de região dos sprites de avatar.

Por que máscara e não troca de cor por índice: a cor sozinha não distingue
região. Medido no ruivo-verde/baixo-0.png, #8d5243 ocupa as linhas 2 a 15 — é
contorno de cabelo, sombra de rosto e sombra de roupa ao mesmo tempo. Trocar
"cor do cabelo" por índice repintaria rosto e roupa junto. Posição + cor
distingue; cor sozinha não.

Saída: um PNG por quadro, com a região codificada na cor —
  vermelho = pele · verde = cabelo · azul = roupa · branco = contorno
"""
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent / 'kairos-ui/src/game/furniture/avatar'
SAIDA = Path(__file__).resolve().parent.parent / 'kairos-ui/src/game/furniture/avatar-mascaras'

REGIAO = {
    'pele': (255, 0, 0, 255),
    'cabelo': (0, 255, 0, 255),
    'roupa': (0, 0, 255, 255),
    'contorno': (255, 255, 255, 255),
}

# faixas verticais de um sprite 16x16 de personagem de frente
def faixa(y: int, altura: int) -> str:
    t = y / altura
    if t < 0.34:
        return 'cabelo'
    if t < 0.60:
        return 'pele'
    return 'roupa'


def luminancia(c):
    r, g, b = c[0] / 255, c[1] / 255, c[2] / 255
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def carregar(preset: Path):
    quadros = {}
    for png in sorted(preset.glob('*.png')):
        quadros[png.stem] = Image.open(png).convert('RGBA')
    return quadros


def perfil_de_cores(quadros):
    """Onde cada cor mora, somando os 12 quadros do preset."""
    por_cor = defaultdict(Counter)
    total = Counter()
    for im in quadros.values():
        px = im.load()
        w, h = im.size
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a < 128:
                    continue
                cor = (r, g, b)
                por_cor[cor][faixa(y, h)] += 1
                total[cor] += 1
    return por_cor, total


def classificar(preset: Path):
    quadros = carregar(preset)
    por_cor, total = perfil_de_cores(quadros)

    # uma cor "pertence" a uma faixa quando concentra ali; espalhada, ela não
    # decide nada e quem decide é a posição do próprio pixel
    dono = {}
    espalhadas = set()
    for cor, faixas in por_cor.items():
        n = sum(faixas.values())
        principal, quantas = faixas.most_common(1)[0]
        if quantas / n >= 0.65:
            dono[cor] = principal
        else:
            espalhadas.add(cor)

    # toda região precisa de pelo menos uma semente, senão a propagação não tem
    # de onde espalhar e a região simplesmente não existe na máscara. Foi o que
    # aconteceu com o cabelo: a cor mais concentrada nele parava em 73%
    for regiao in ('cabelo', 'pele', 'roupa'):
        if any(v == regiao for v in dono.values()):
            continue
        melhor, melhor_share = None, 0.0
        for cor, faixas in por_cor.items():
            n = sum(faixas.values())
            share = faixas.get(regiao, 0) / n
            if share > melhor_share:
                melhor, melhor_share = cor, share
        if melhor and melhor_share >= 0.45:
            dono[melhor] = regiao
            espalhadas.discard(melhor)

    escuras = sorted(total, key=luminancia)[: max(1, len(total) // 3)]
    por_cor_n = 0
    propagados = 0
    so_faixa = 0

    SAIDA.mkdir(parents=True, exist_ok=True)
    destino = SAIDA / preset.name
    destino.mkdir(parents=True, exist_ok=True)

    for nome, im in quadros.items():
        w, h = im.size
        px = im.load()
        regiao = [[None] * w for _ in range(h)]

        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a < 128:
                    continue
                cor = (r, g, b)
                # borda da silhueta em tom escuro é contorno: é o sinal mais
                # objetivo daqui, não depende de faixa nem de paleta
                borda = any(
                    not (0 <= x + dx < w and 0 <= y + dy < h) or px[x + dx, y + dy][3] < 128
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                )
                if borda and cor in escuras:
                    regiao[y][x] = 'contorno'
                    por_cor_n += 1
                elif cor in dono:
                    regiao[y][x] = dono[cor]
                    por_cor_n += 1
                else:
                    regiao[y][x] = 'pendente'

        # segunda passada: o pixel que a cor não decidiu herda a região dos
        # vizinhos que ela decidiu. É o que resolve o tom de sombra
        # compartilhado — ele é sombra DO que está ao lado
        for _ in range(6):
            pendentes = [(x, y) for y in range(h) for x in range(w) if regiao[y][x] == 'pendente']
            if not pendentes:
                break
            decisoes = {}
            for x, y in pendentes:
                votos = Counter()
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        vx, vy = x + dx, y + dy
                        if not (0 <= vx < w and 0 <= vy < h):
                            continue
                        v = regiao[vy][vx]
                        if v and v not in ('pendente', 'contorno'):
                            votos[v] += 1
                if votos:
                    decisoes[(x, y)] = votos.most_common(1)[0][0]
            if not decisoes:
                break
            for (x, y), v in decisoes.items():
                regiao[y][x] = v
                propagados += 1

        # o que ninguém alcançou cai na faixa, e é o que sobra para revisão
        for y in range(h):
            for x in range(w):
                if regiao[y][x] == 'pendente':
                    regiao[y][x] = faixa(y, h)
                    so_faixa += 1

        mascara = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        mp = mascara.load()
        for y in range(h):
            for x in range(w):
                if regiao[y][x]:
                    mp[x, y] = REGIAO[regiao[y][x]]
        mascara.save(destino / f'{nome}.png')

    return por_cor_n, propagados, so_faixa, len(espalhadas), len(total)


def main():
    presets = sorted(p for p in RAIZ.iterdir() if p.is_dir())
    relatorio = {}
    a = b = c = 0
    print(f'{len(presets)} presets\n')
    for p in presets:
        cor_n, prop, faixa_n, esp, cores = classificar(p)
        a += cor_n; b += prop; c += faixa_n
        relatorio[p.name] = {'porCor': cor_n, 'propagados': prop, 'soFaixa': faixa_n,
                             'coresEspalhadas': esp, 'cores': cores}
        print(f'  {p.name:18} cor {cor_n:5} · vizinhança {prop:4} · só faixa {faixa_n:3}'
              f'   ({esp}/{cores} cores espalhadas)')
    total = a + b + c
    print(f'\ntotal: {total} px em 72 máscaras')
    print(f'  decididos pela COR (confiança alta):        {a:5} ({100*a/total:.1f}%)')
    print(f'  decididos por VIZINHANÇA (confiança média): {b:5} ({100*b/total:.1f}%)')
    print(f'  decididos só pela FAIXA (revisar):          {c:5} ({100*c/total:.1f}%)')
    (SAIDA / 'relatorio.json').write_text(json.dumps(relatorio, indent=2, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    sys.exit(main())
