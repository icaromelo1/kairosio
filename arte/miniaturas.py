import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comum
import verificar_personagem as v

ESCALAS = v.ESCALAS
TAMANHO = 128
BASE = {'cabelo': 'cabelo_curto', 'cima': 'cima_camiseta', 'baixo': 'baixo_calca', 'sapato': 'sapato_tenis'}
CORES = {
    'pele': '#e8b894', 'tinta_cabelo': '#5a3a22', 'tinta_chapeu': '#d9a441', 'tinta_rosto': '#26262b',
    'tinta_cima': '#4d6fa3', 'tinta_baixo': '#2f3d5c', 'tinta_sapato': '#c0392b', 'tinta_acessorio': '#d9a441',
}
NEUTRO = '#d8cfbf'


def preparar():
    cena = bpy.context.scene
    motores = [i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    try:
        cena.render.engine = next((e for e in motores if 'EEVEE' in e), motores[0])
    except TypeError:
        pass
    cena.render.film_transparent = True
    cena.render.resolution_x = TAMANHO
    cena.render.resolution_y = TAMANHO
    cena.render.image_settings.file_format = 'PNG'
    cena.render.image_settings.color_mode = 'RGBA'
    mundo = bpy.data.worlds.new('mundo')
    cena.world = mundo
    if bpy.app.version < (5, 0, 0):
        mundo.use_nodes = True
    fundo = next(n for n in mundo.node_tree.nodes if n.type == 'BACKGROUND')
    fundo.inputs['Color'].default_value = (1, 1, 1, 1)
    fundo.inputs['Strength'].default_value = 0.9
    bpy.ops.object.light_add(type='SUN', location=(2, -3, 5))
    sol = bpy.context.active_object
    sol.data.energy = 3.2
    sol.rotation_euler = (0.7, 0.15, 0.35)
    bpy.ops.object.camera_add()
    camera = bpy.context.active_object
    camera.data.type = 'ORTHO'
    cena.camera = camera
    return camera


def colorir(destaque):
    for material in bpy.data.materials:
        bsdf = next((n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if material.node_tree else None
        base = material.name.split('#')[0]
        if not bsdf or base not in CORES:
            continue
        cor = CORES[base] if base in ('pele', destaque) else NEUTRO
        bsdf.inputs['Base Color'].default_value = (*comum.hexa(cor), 1)


def caixa(obj):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    avaliado = obj.evaluated_get(depsgraph)
    malha = avaliado.to_mesh()
    pontos = [obj.matrix_world @ vert.co for vert in malha.vertices]
    avaliado.to_mesh_clear()
    minimo = Vector((min(p.x for p in pontos), min(p.y for p in pontos), min(p.z for p in pontos)))
    maximo = Vector((max(p.x for p in pontos), max(p.y for p in pontos), max(p.z for p in pontos)))
    return minimo, maximo


def fotografar(pasta, camera, visiveis, foco, nome):
    for obj in v.p.pecas:
        obj.hide_render = obj.name not in visiveis
    minimo, maximo = caixa(bpy.data.objects[foco])
    centro = (minimo + maximo) / 2
    lado = max((maximo - minimo).x, (maximo - minimo).z, 0.36 if foco.startswith(('cabelo', 'chapeu')) else 0.46)
    direcao = Vector((0.45, -1, 0.35)).normalized()
    camera.location = centro + direcao * 5
    camera.rotation_euler = (centro - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.ortho_scale = lado * 1.35
    bpy.context.scene.render.filepath = os.path.join(pasta, f'{nome}.png')
    bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    pasta = comum.argumentos()
    os.makedirs(pasta, exist_ok=True)
    catalogo = v.ler_catalogo()
    armacao = v.montar()
    camera = preparar()
    for trilha in armacao.animation_data.nla_tracks:
        trilha.mute = True
    armacao.animation_data.action = bpy.data.actions['parado']
    bpy.context.scene.frame_set(1)
    cabeca = {'cabelo', 'chapeu', 'rosto'}
    for c in catalogo:
        escolha = dict(BASE)
        if c['malha']:
            escolha[c['slot']] = c['malha']
        else:
            escolha.pop(c['slot'], None)
        if c['slot'] == 'rosto' or not c['malha']:
            foco = 'cabelo_curto' if c['slot'] in cabeca else BASE.get(c['slot'], 'cima_camiseta')
        else:
            foco = c['malha']
        colorir(('tinta_cabelo' if c['semCor'] else v.TINTAS[c['slot']]) if c['malha'] else None)
        fotografar(pasta, camera, {'corpo', *escolha.values()}, foco, f"{c['slot']}-{c['id']}")
    print('MINIATURAS OK')
