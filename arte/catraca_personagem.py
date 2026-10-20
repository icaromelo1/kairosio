import json
import sys

FOLGA = 1.1
CHAO = -0.01


def maximo(por_pose):
    return max(n for n, _ in por_pose.values())


def falhas(relatorio, base):
    erros = list(relatorio['estruturais'])
    for chave, por_pose in relatorio['corpo'].items():
        erros.append(f'corpo atravessa a si mesmo: {chave} {por_pose}')
    for peca, por_pose in relatorio['chao'].items():
        for pose, (z, quadro) in por_pose.items():
            if pose != 'sentar' and z < CHAO:
                erros.append(f'{peca} abaixo do chao em {pose} (quadro {quadro}): {z}')
    for chave, por_pose in relatorio['pares'].items():
        atual = maximo(por_pose)
        limite = base.get(chave)
        if limite is None:
            erros.append(f'intersecao nova: {chave} ({atual} triangulos)')
        elif atual > limite * FOLGA:
            erros.append(f'intersecao piorou: {chave} {limite} -> {atual}')
    return erros


if __name__ == '__main__':
    caminho_relatorio, caminho_base = sys.argv[1:3]
    relatorio = json.load(open(caminho_relatorio, encoding='utf-8'))
    if '--atualizar' in sys.argv:
        base = {chave: maximo(por_pose) for chave, por_pose in relatorio['pares'].items()}
        json.dump(dict(sorted(base.items())), open(caminho_base, 'w', encoding='utf-8'), indent=1)
        print(f'base atualizada: {len(base)} pares')
        sys.exit(0)
    base = json.load(open(caminho_base, encoding='utf-8'))
    erros = falhas(relatorio, base)
    for erro in erros:
        print(f'PERSONAGEM {erro}')
    if erros:
        print('Revise as folhas com: blender -b --python arte/verificar_personagem.py -- <pasta> --fotos --combinacoes')
        print('Se a mudanca for aceita, atualize a base com --atualizar.')
        sys.exit(1)
    print(f'personagem ok: {len(relatorio["pares"])} pares dentro da base')
