"""Leva a revisão de tiles do banco para os índices que o jogo lê.

Simétrico ao aplica-mascaras.py, e pelo mesmo motivo: a revisão é feita por
sudo, mas tem que valer para todo mundo. Os índices são importados no build
(busca.ts, catálogo do editor), então a API não escreve neles — a decisão
manual vira patch no banco e este comando é a ponte.

É um passo consciente: reescreve arquivos versionados, então mostre o diff no
git antes de commitar.

Uso:
    python3 scripts/aplica-tiles.py --token <jwt-de-sudo> [--api <url>] [--seco]
"""
import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

INDICES = Path(__file__).resolve().parent.parent / 'kairos-ui/src/game/furniture'
PACKS = ['tiny-town', 'rpg-urban', 'modern-city']

# só o que a curadoria decide; o resto do tile (i, tags, opaco) é do gerador
CAMPOS = ('nome', 'cat', 'solido', 'serveComo', 'revisado')


def buscar(api: str, token: str) -> list[dict]:
    pedido = urllib.request.Request(
        f'{api}/kairos-api/tiles/revisoes',
        headers={'Authorization': f'Bearer {token}'},
    )
    try:
        with urllib.request.urlopen(pedido) as resposta:
            return json.loads(resposta.read().decode())
    except urllib.error.HTTPError as e:
        print(f'a API respondeu {e.code} — o token precisa ser de uma conta sudo')
        raise SystemExit(1)


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

    por_pack: dict[str, dict[int, dict]] = {}
    for r in revisoes:
        por_pack.setdefault(r['pack'], {})[r['indice']] = r

    print(f'{len(revisoes)} revisão(ões) no banco')
    total_mudados = 0
    sem_tile = []

    for pack in PACKS:
        caminho = INDICES / f'indice-{pack}.json'
        indice = json.loads(caminho.read_text())
        revisoes_do_pack = por_pack.get(pack, {})
        if not revisoes_do_pack:
            print(f'  {pack:14} nenhuma revisão')
            continue

        mudados = 0
        for tile in indice['tiles']:
            r = revisoes_do_pack.pop(tile['i'], None)
            if not r:
                continue
            antes = {c: tile.get(c) for c in CAMPOS}
            for campo in CAMPOS:
                valor = r.get(campo)
                # campo ausente no patch preserva o que o gerador produziu
                if valor is not None:
                    tile[campo] = valor
            if {c: tile.get(c) for c in CAMPOS} != antes:
                mudados += 1

        # revisão de um tile que não existe mais no índice
        for indice_orfao in revisoes_do_pack:
            sem_tile.append(f'{pack}#{indice_orfao}')

        print(f'  {pack:14} {mudados} tile(s) a atualizar')
        total_mudados += mudados
        if mudados and not args.seco:
            caminho.write_text(json.dumps(indice, ensure_ascii=False, indent=1) + '\n')

    if sem_tile:
        print(f'\n{len(sem_tile)} revisão(ões) sem tile correspondente: {", ".join(sem_tile[:8])}')

    if args.seco:
        print(f'\n[seco] {total_mudados} tile(s) mudariam — nada foi escrito')
        return 0

    if total_mudados:
        print(f'\n{total_mudados} tile(s) atualizados nos índices.')
        print('Os índices são versionados: confira o diff no git antes de commitar.')
    else:
        print('\nnada mudou — os índices já refletem as revisões')
    return 0


if __name__ == '__main__':
    sys.exit(main())
