"""Leva as correções do editor de máscara para os PNGs que o jogo lê.

O editor grava cada pincelada no banco, mas o jogo lê as máscaras como PNG
importado no build — de propósito: assim o caminho de render do avatar não
ganha uma chamada de rede. Este comando é a ponte entre os dois, e é um passo
consciente: ele reescreve arquivos versionados, então o diff tem que ser olhado
no git antes do commit.

Uso:
    python3 scripts/aplica-mascaras.py --token <jwt-de-sudo> [--api <url>] [--seco]

--seco mostra o que mudaria sem escrever nada.
"""
import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image

MASCARAS = Path(__file__).resolve().parent.parent / 'kairos-ui/src/game/furniture/avatar-mascaras'

# mesma tabela do gerador e do motor de recoloração — se divergir, a máscara
# editada vira outra coisa ao virar PNG
COR = {
    'p': (255, 0, 0, 255),
    'c': (0, 255, 0, 255),
    'r': (0, 0, 255, 255),
    'o': (255, 255, 255, 255),
    '.': (0, 0, 0, 0),
}
LETRA = {v: k for k, v in COR.items()}


def buscar(api: str, token: str) -> list[dict]:
    pedido = urllib.request.Request(
        f'{api}/kairos-api/mascaras',
        headers={'Authorization': f'Bearer {token}'},
    )
    try:
        with urllib.request.urlopen(pedido) as resposta:
            return json.loads(resposta.read().decode())
    except urllib.error.HTTPError as e:
        print(f'a API respondeu {e.code} — o token precisa ser de uma conta sudo')
        raise SystemExit(1)


def letra_do_pixel(px) -> str:
    if px[3] < 128:
        return '.'
    r, g, b = px[0], px[1], px[2]
    if r > 200 and g > 200 and b > 200:
        return 'o'
    if r > 200:
        return 'p'
    if g > 200:
        return 'c'
    return 'r'


def ler_png(caminho: Path) -> str:
    im = Image.open(caminho).convert('RGBA')
    px = im.load()
    w, h = im.size
    return ''.join(letra_do_pixel(px[x, y]) for y in range(h) for x in range(w))


def escrever_png(caminho: Path, pixels: str) -> None:
    lado = 16
    im = Image.new('RGBA', (lado, lado), (0, 0, 0, 0))
    mp = im.load()
    for i, letra in enumerate(pixels):
        mp[i % lado, i // lado] = COR[letra]
    im.save(caminho)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--token', required=True, help='JWT de uma conta sudo')
    ap.add_argument('--api', default='https://icaromelodev.com.br')
    ap.add_argument('--seco', action='store_true', help='mostra o que mudaria, sem escrever')
    args = ap.parse_args()

    revisoes = buscar(args.api, args.token)
    if not revisoes:
        print('nenhuma revisão gravada — nada a aplicar')
        return 0

    mudados, iguais, sem_arquivo, sem_pixels = [], 0, [], 0

    for r in revisoes:
        preset, quadro, pixels = r.get('preset'), r.get('quadro'), r.get('pixels')
        if not pixels:
            # linha só com 'intencional' ou 'duvida' não altera a arte
            sem_pixels += 1
            continue
        caminho = MASCARAS / preset / f'{quadro}.png'
        if not caminho.exists():
            sem_arquivo.append(f'{preset}/{quadro}')
            continue
        if ler_png(caminho) == pixels:
            iguais += 1
            continue
        mudados.append((caminho, pixels, f'{preset}/{quadro}'))

    print(f'{len(revisoes)} revisão(ões) no banco')
    print(f'  {len(mudados)} quadro(s) a reescrever')
    print(f'  {iguais} já idêntico(s) ao PNG')
    if sem_pixels:
        print(f'  {sem_pixels} sem pixels (só marca de intencional ou dúvida)')
    if sem_arquivo:
        print(f'  {len(sem_arquivo)} sem PNG correspondente: {", ".join(sem_arquivo)}')

    if args.seco:
        for _, _, nome in mudados:
            print(f'    mudaria {nome}')
        return 0

    for caminho, pixels, nome in mudados:
        escrever_png(caminho, pixels)
        print(f'    escrito {nome}')

    if mudados:
        print('\nOs PNGs são versionados: confira o diff no git antes de commitar.')
        print('Depois rode: python3 scripts/prova-recoloracao.py')
    return 0


if __name__ == '__main__':
    sys.exit(main())
