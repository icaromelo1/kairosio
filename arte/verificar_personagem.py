import json
import math
import os
import sys
from itertools import combinations

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comum
import personagem as p

ESCALAS = p.ESCALAS
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOGO = os.path.join(RAIZ, 'kairos-ui', 'src', 'mundo', 'personagem', 'catalogo.ts')
POSES = ['parado', 'andar', 'sentar', 'acenar', 'dancar', 'correr']
AMOSTRAS = 8
TINTAS = {'cabelo': 'tinta_cabelo', 'chapeu': 'tinta_chapeu', 'rosto': 'tinta_rosto', 'cima': 'tinta_cima', 'baixo': 'tinta_baixo', 'sapato': 'tinta_sapato', 'acessorio': 'tinta_acessorio'}
COLORIVEIS = {'chapeu', 'rosto', 'cima', 'baixo', 'sapato', 'acessorio'}


def ler_catalogo():
    import re
    texto = open(CATALOGO, encoding='utf-8').read()
    pecas = []
    for m in re.finditer(r"\{ id: '([^']+)', slot: '([^']+)', nome: '([^']+)', malha: (null|'[^']+')([^}]*)\}", texto):
        malha = None if m.group(4) == 'null' else m.group(4).strip("'")
        corte = re.search(r"corte: '([^']+)'", m.group(5))
        pecas.append({'id': m.group(1), 'slot': m.group(2), 'malha': malha, 'corte': corte.group(1) if corte else None, 'semCor': 'semCor: true' in m.group(5), 'cor2': 'cor2:' in m.group(5), 'cobreBaixo': 'cobreBaixo: true' in m.group(5)})
    return pecas


CORTES = ('chapeu', 'aba')


def malha_do_cabelo(cabelo, chapeu):
    return f"{cabelo}_{chapeu['corte']}" if chapeu and chapeu.get('corte') else cabelo


def montar():
    comum.limpar()
    p.corpo()
    p.cabelos()
    p.cabelos_novos()
    p.cabelos_sob_chapeu()
    p.chapeus()
    p.rostos()
    p.cimas()
    p.baixos()
    p.sapatos()
    p.acessorios()
    armacao = comum.esqueleto('esqueleto', p.OSSOS)
    comum.vincular(armacao, p.pecas)
    p.animacoes(armacao)
    return armacao


def estruturais(armacao, catalogo):
    achados = []
    objetos = {o.name for o in p.pecas}
    ossos = {b.name for b in armacao.data.bones}
    malhas = {c['malha'] for c in catalogo if c['malha']}
    malhas |= {f"{c['malha']}_{corte}" for c in catalogo if c['malha'] and c['slot'] == 'cabelo' for corte in CORTES}
    for nome in sorted(malhas - objetos):
        achados.append(f'catalogo aponta malha inexistente: {nome}')
    for nome in sorted(objetos - malhas - {'corpo'}):
        achados.append(f'malha no modelo sem entrada no catalogo: {nome}')
    for obj in p.pecas:
        grupos = {g.index: g.name for g in obj.vertex_groups}
        for nome in grupos.values():
            if nome not in ossos:
                achados.append(f'{obj.name}: grupo {nome} nao e osso')
        sem_peso = sum(1 for v in obj.data.vertices if abs(sum(g.weight for g in v.groups) - 1) > 1e-3)
        if sem_peso:
            achados.append(f'{obj.name}: {sem_peso} vertices com peso != 1')
    for c in catalogo:
        if not c['malha'] or c['slot'] not in COLORIVEIS or c['semCor']:
            continue
        obj = bpy.data.objects[c['malha']]
        mats = {s.material.name for s in obj.material_slots if s.material}
        if TINTAS[c['slot']] not in mats:
            achados.append(f"{c['slot']}/{c['id']}: slot coloravel mas a peca nao usa {TINTAS[c['slot']]} (cor escolhida nao muda nada; usa {sorted(mats)})")
        segunda = TINTAS[c['slot']] + '2'
        if c['cor2'] and segunda not in mats:
            achados.append(f"{c['slot']}/{c['id']}: tem cor2 no catalogo mas a peca nao usa {segunda}")
        if not c['cor2'] and segunda in mats:
            achados.append(f"{c['slot']}/{c['id']}: usa {segunda} mas o catalogo nao oferece cor2 (fica na cor padrao)")
        alheias = sorted(m for m in mats if m.startswith('tinta_') and m not in (TINTAS[c['slot']], segunda))
        if alheias:
            achados.append(f"{c['slot']}/{c['id']}: tambem usa {alheias} (pinta com a cor de outro slot)")
    for pose in POSES:
        if pose not in bpy.data.actions:
            achados.append(f'animacao ausente: {pose}')
    return achados


def quadros(acao):
    inicio, fim = acao.frame_range
    return sorted({round(inicio + (fim - inicio) * i / AMOSTRAS) for i in range(AMOSTRAS)})


def arvores(depsgraph):
    resultado = {}
    for obj in p.pecas:
        avaliado = obj.evaluated_get(depsgraph)
        malha = avaliado.to_mesh()
        mundo = obj.matrix_world
        vertices = [mundo @ v.co for v in malha.vertices]
        poligonos = [list(f.vertices) for f in malha.polygons]
        resultado[obj.name] = (BVHTree.FromPolygons(vertices, poligonos), min(v.z for v in vertices))
        avaliado.to_mesh_clear()
    return resultado


def partes_do_corpo(depsgraph):
    obj = bpy.data.objects['corpo']
    avaliado = obj.evaluated_get(depsgraph)
    malha = avaliado.to_mesh()
    mundo = obj.matrix_world
    nomes = {g.index: g.name for g in obj.vertex_groups}
    grupo_do_vertice = {v.index: nomes[max(v.groups, key=lambda g: g.weight).group] for v in obj.data.vertices}
    vertices = [mundo @ v.co for v in malha.vertices]
    por_grupo = {}
    for f in malha.polygons:
        por_grupo.setdefault(grupo_do_vertice[f.vertices[0]], []).append(list(f.vertices))
    avaliado.to_mesh_clear()
    return {g: BVHTree.FromPolygons(vertices, faces) for g, faces in por_grupo.items()}


VIZINHOS = {('olhos', 'cabeca'), ('braco.L', 'tronco'), ('braco.R', 'tronco'), ('antebraco.L', 'braco.L'), ('antebraco.R', 'braco.R'), ('coxa.L', 'quadril'), ('coxa.R', 'quadril'), ('canela.L', 'coxa.L'), ('canela.R', 'coxa.R'), ('cabeca', 'tronco'), ('quadril', 'tronco')}


def geometricos(armacao, catalogo):
    slot_da_malha = {c['malha']: c['slot'] for c in catalogo if c['malha']}
    corte_da_malha = {c['malha']: c.get('corte') for c in catalogo if c['malha']}
    for c in catalogo:
        if c['malha'] and c['slot'] == 'cabelo':
            for corte in CORTES:
                slot_da_malha[f"{c['malha']}_{corte}"] = 'cabelo'
                corte_da_malha[f"{c['malha']}_{corte}"] = corte
    slot_da_malha['corpo'] = 'corpo'

    cobre = {c['malha'] for c in catalogo if c['cobreBaixo']}

    def combina(a, b):
        sa, sb = slot_da_malha[a], slot_da_malha[b]
        if sa == sb:
            return False
        if (a in cobre and sb == 'baixo') or (b in cobre and sa == 'baixo'):
            return False
        if {sa, sb} == {'cabelo', 'chapeu'}:
            cabelo, chapeu = (a, b) if sa == 'cabelo' else (b, a)
            return corte_da_malha.get(cabelo) == corte_da_malha.get(chapeu)
        cabelo = a if sa == 'cabelo' else b if sb == 'cabelo' else None
        return not (cabelo and corte_da_malha.get(cabelo))

    pares = [(a.name, b.name) for a, b in combinations(p.pecas, 2) if combina(a.name, b.name)]
    cena = bpy.context.scene
    for trilha in armacao.animation_data.nla_tracks:
        trilha.mute = True
    resultado = {'pares': {}, 'corpo': {}, 'chao': {}}
    for pose in POSES:
        acao = bpy.data.actions.get(pose)
        if not acao:
            continue
        armacao.animation_data.action = acao
        for quadro in quadros(acao):
            cena.frame_set(quadro)
            depsgraph = bpy.context.evaluated_depsgraph_get()
            arv = arvores(depsgraph)
            for a, b in pares:
                n = len(arv[a][0].overlap(arv[b][0]))
                if n:
                    chave = f'{a} x {b}'
                    atual = resultado['pares'].setdefault(chave, {})
                    if n > atual.get(pose, (0, 0))[0]:
                        atual[pose] = (n, quadro)
            partes = partes_do_corpo(depsgraph)
            for ga, gb in combinations(sorted(partes), 2):
                if (ga, gb) in VIZINHOS or (gb, ga) in VIZINHOS:
                    continue
                n = len(partes[ga].overlap(partes[gb]))
                if n:
                    chave = f'corpo:{ga} x corpo:{gb}'
                    atual = resultado['corpo'].setdefault(chave, {})
                    if n > atual.get(pose, (0, 0))[0]:
                        atual[pose] = (n, quadro)
            for nome, (_, z) in arv.items():
                atual = resultado['chao'].setdefault(nome, {})
                if pose not in atual or z < atual[pose][0]:
                    atual[pose] = (round(z, 3), quadro)
    return resultado


def contato(pasta, armacao, catalogo):
    p.preparar_fotos()
    cena = bpy.context.scene
    cena.render.resolution_x = 220
    cena.render.resolution_y = 260
    base = {'cabelo': 'cabelo_curto', 'cima': 'cima_camiseta', 'baixo': 'baixo_calca', 'sapato': 'sapato_tenis'}
    for c in catalogo:
        if not c['malha']:
            continue
        visiveis = {'corpo', *base.values()}
        visiveis.discard(base.get(c['slot']))
        if c['cobreBaixo']:
            visiveis.discard(base['baixo'])
        visiveis.add(c['malha'])
        for pose in ['parado', 'andar', 'correr', 'sentar', 'acenar', 'dancar']:
            acao = bpy.data.actions[pose]
            quadro = quadros(acao)[2]
            direcao = (0.7, -1, 0.35) if pose not in ('sentar', 'correr') else (1, -0.4, 0.3)
            p.fotografar(pasta, armacao, visiveis, f"{c['slot']}-{c['id']}-{pose}", pose, quadro, direcao)
        p.fotografar(pasta, armacao, visiveis, f"{c['slot']}-{c['id']}-costas", None, 1, (-0.5, 1, 0.3))


PARES_DE_SLOT = [('cabelo', 'chapeu'), ('cima', 'baixo'), ('cima', 'acessorio'), ('chapeu', 'rosto'), ('cabelo', 'acessorio'), ('baixo', 'sapato'), ('cabelo', 'rosto'), ('rosto', 'acessorio')]


def combinacoes(pasta, armacao, catalogo):
    base = {'cabelo': 'cabelo_curto', 'cima': 'cima_camiseta', 'baixo': 'baixo_calca', 'sapato': 'sapato_tenis'}
    por_slot = {}
    for c in catalogo:
        if c['malha']:
            por_slot.setdefault(c['slot'], []).append(c)
    for sa, sb in PARES_DE_SLOT:
        for a in por_slot[sa]:
            for b in por_slot[sb]:
                escolha = dict(base)
                escolha[sa] = a['malha']
                escolha[sb] = b['malha']
                chapeu = next((c for c in catalogo if c['malha'] == escolha.get('chapeu')), None)
                if escolha.get('cabelo'):
                    escolha['cabelo'] = malha_do_cabelo(escolha['cabelo'], chapeu)
                visiveis = {'corpo', *escolha.values()}
                nome = f"{sa}-{a['id']}+{sb}-{b['id']}"
                for pose, direcao in (('parado', (0.4, -1, 0.75)), ('dancar', (-0.7, 1, 0.35)), ('sentar', (1, -0.4, 0.3))):
                    acao = bpy.data.actions[pose]
                    p.fotografar(pasta, armacao, visiveis, f'{nome}~{pose}', pose, quadros(acao)[2], direcao)


if __name__ == '__main__':
    saida = comum.argumentos()
    os.makedirs(saida, exist_ok=True)
    catalogo = ler_catalogo()
    armacao = montar()
    relatorio = {'estruturais': estruturais(armacao, catalogo), 'versao_blender': bpy.app.version_string, 'pecas': len(catalogo)}
    relatorio.update(geometricos(armacao, catalogo))
    with open(os.path.join(saida, 'relatorio.json'), 'w', encoding='utf-8') as f:
        json.dump(relatorio, f, ensure_ascii=False, indent=1)
    if '--fotos' in sys.argv:
        contato(os.path.join(saida, 'fotos'), armacao, catalogo)
    if '--combinacoes' in sys.argv:
        if '--fotos' not in sys.argv:
            p.preparar_fotos()
            bpy.context.scene.render.resolution_x = 220
            bpy.context.scene.render.resolution_y = 260
        combinacoes(os.path.join(saida, 'combinacoes'), armacao, catalogo)
    print('VERIFICACAO OK')
