"""Prova que o `cols` do índice é mesmo a largura da folha do tilesheet.

O modo folha prende a grade em `cols` colunas para que objeto de vários tiles
(casa, boneco, carro) se leia inteiro. Se `cols` estiver errado, a grade "funciona"
— desenha, não quebra, não dá erro — e simplesmente mostra o sheet embaralhado.
Só comparando com o PNG dá para saber.

A referência é independente do código do front: vem das dimensões reais do PNG e
das calhas de 1px entre os tiles, não da mesma conta que o front faz.

Checa, por pack:
  1. cols * (tile+1) - 1 == largura do PNG   (o índice descreve a folha certa)
  2. linhas * (tile+1) - 1 == altura do PNG
  3. as calhas de 1px estão vazias           (a origem e o passo estão certos)
  4. n de tiles == cols * linhas             (nenhum slot faltando: posição no
                                              array é a posição na folha)

Contraprova: refaz o item 1 com 8 colunas, que é o que o auto-fill produzia num
painel estreito. Se isso NÃO falhar, o teste não mede nada e o script dá erro.
"""
import json
import sys
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent / 'kairos-ui/src/game/furniture'
PACKS = ['tiny-town', 'rpg-urban', 'modern-city']


def calhas_vazias(img: Image.Image, tile: int) -> int:
    """Conta pixels não transparentes nas linhas/colunas de 1px que separam tiles."""
    passo = tile + 1
    px = img.load()
    largura, altura = img.size
    sujos = 0
    for x in range(tile, largura, passo):
        for y in range(altura):
            if px[x, y][3] != 0:
                sujos += 1
    for y in range(tile, altura, passo):
        for x in range(largura):
            if px[x, y][3] != 0:
                sujos += 1
    return sujos


def main() -> int:
    falhas = []
    for pack in PACKS:
        indice = json.loads((RAIZ / f'indice-{pack}.json').read_text())
        cols, tile, n = indice['cols'], indice['tile'], len(indice['tiles'])
        img = Image.open(RAIZ / f'tilemaps/{pack}.png').convert('RGBA')
        largura, altura = img.size
        passo = tile + 1
        linhas = (n + cols - 1) // cols

        larg_ok = cols * passo - 1 == largura
        alt_ok = linhas * passo - 1 == altura
        slots_ok = n == cols * linhas
        sujos = calhas_vazias(img, tile)
        # contraprova: a mesma identidade com a contagem errada tem que reprovar
        contraprova_ok = 8 * passo - 1 != largura

        print(f'  {pack:13} {cols}x{linhas} tile={tile}  PNG {largura}x{altura}')
        print(f'  {"":13} largura={"ok" if larg_ok else f"ESPERAVA {cols * passo - 1}"}  '
              f'altura={"ok" if alt_ok else f"ESPERAVA {linhas * passo - 1}"}  '
              f'calhas={"vazias" if sujos == 0 else f"{sujos} px sujos"}  '
              f'slots={"completos" if slots_ok else f"{n} != {cols * linhas}"}  '
              f'contraprova={"reprova como deve" if contraprova_ok else "NAO REPROVOU"}')

        if not larg_ok:
            falhas.append(f'{pack}: cols={cols} não bate com a largura do PNG')
        if not alt_ok:
            falhas.append(f'{pack}: altura do PNG não bate com {linhas} linhas')
        if sujos:
            falhas.append(f'{pack}: {sujos} px de arte caindo nas calhas — passo errado')
        if not slots_ok:
            falhas.append(f'{pack}: índice não cobre a grade inteira')
        if not contraprova_ok:
            falhas.append(f'{pack}: contraprova passou — o teste não mede nada')

    if falhas:
        print('\nFALHOU:')
        for f in falhas:
            print(f'  - {f}')
        return 1
    print('\nOs 3 índices descrevem a folha real: a grade presa em cols reproduz o tilesheet.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
