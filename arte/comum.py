import math
import os
import sys

import bmesh
import bpy

FPS = 24


def argumentos():
    resto = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    livres = [a for a in resto if not a.startswith('--')]
    return livres[0] if livres else '/tmp/modelo.glb'


def limpar():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    cena = bpy.context.scene
    cena.render.fps = FPS
    return cena


def linear(cor):
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in cor)


def hexa(valor):
    valor = valor.lstrip('#')
    return linear(tuple(int(valor[i:i + 2], 16) / 255 for i in (0, 2, 4)))


class Modelo:
    def __init__(self, paleta):
        self.paleta = paleta
        self.materiais = {}
        self.partes = []

    def material(self, nome):
        if nome in self.materiais:
            return self.materiais[nome]
        definicao = self.paleta[nome]
        m = bpy.data.materials.new(nome)
        if bpy.app.version < (5, 0, 0):
            m.use_nodes = True
        bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        r, g, b = hexa(definicao['cor'])
        bsdf.inputs['Base Color'].default_value = (r, g, b, 1)
        bsdf.inputs['Metallic'].default_value = definicao.get('metal', 0.0)
        bsdf.inputs['Roughness'].default_value = definicao.get('aspereza', 0.85)
        if 'emissao' in definicao:
            er, eg, eb = hexa(definicao['emissao'])
            bsdf.inputs['Emission Color'].default_value = (er, eg, eb, 1)
            bsdf.inputs['Emission Strength'].default_value = definicao.get('forca', 1.0)
        self.materiais[nome] = m
        return m

    def finalizar(self, obj, nome_material, osso=None, chanfro=0.0):
        obj.data.materials.clear()
        obj.data.materials.append(self.material(nome_material))
        if chanfro:
            mod = obj.modifiers.new('chanfro', 'BEVEL')
            mod.width = chanfro
            mod.segments = 2
            mod.limit_method = 'ANGLE'
        for p in obj.data.polygons:
            p.use_smooth = False
        self.partes.append((obj, osso))
        return obj

    def caixa(self, nome, centro, tamanho, mat, osso=None, chanfro=0.014, rot=(0, 0, 0)):
        bpy.ops.mesh.primitive_cube_add(size=1, location=centro, rotation=rot)
        obj = bpy.context.active_object
        obj.name = nome
        obj.scale = tamanho
        return self.finalizar(obj, mat, osso, chanfro)

    def cilindro(self, nome, centro, raio, altura, mat, osso=None, lados=10, raio_topo=None, rot=(0, 0, 0), escala=(1, 1, 1), chanfro=0.0):
        bpy.ops.mesh.primitive_cone_add(vertices=lados, radius1=raio, radius2=raio if raio_topo is None else raio_topo, depth=altura, location=centro, rotation=rot)
        obj = bpy.context.active_object
        obj.name = nome
        obj.scale = escala
        return self.finalizar(obj, mat, osso, chanfro)

    def esfera(self, nome, centro, raio, mat, osso=None, escala=(1, 1, 1), segmentos=12, aneis=8):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=segmentos, ring_count=aneis, radius=raio, location=centro)
        obj = bpy.context.active_object
        obj.name = nome
        obj.scale = escala
        return self.finalizar(obj, mat, osso)

    def icosfera(self, nome, centro, raio, mat, osso=None, escala=(1, 1, 1), nivel=1):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=nivel, radius=raio, location=centro)
        obj = bpy.context.active_object
        obj.name = nome
        obj.scale = escala
        return self.finalizar(obj, mat, osso)

    def toro(self, nome, centro, raio, espessura, mat, osso=None, rot=(0, 0, 0), escala=(1, 1, 1), lados=16, secao=6):
        bpy.ops.mesh.primitive_torus_add(major_radius=raio, minor_radius=espessura, major_segments=lados, minor_segments=secao, location=centro, rotation=rot)
        obj = bpy.context.active_object
        obj.name = nome
        obj.scale = escala
        return self.finalizar(obj, mat, osso)

    def torno(self, nome, perfil, mat, osso=None, centro=(0, 0, 0), lados=12, escala=(1, 1, 1)):
        dados = bpy.data.meshes.new(nome)
        bm = bmesh.new()
        aneis = []
        for raio, z in perfil:
            aneis.append([bm.verts.new((math.cos(i / lados * math.tau) * raio, math.sin(i / lados * math.tau) * raio, z)) for i in range(lados)])
        for k in range(len(aneis) - 1):
            for i in range(lados):
                j = (i + 1) % lados
                bm.faces.new((aneis[k][i], aneis[k][j], aneis[k + 1][j], aneis[k + 1][i]))
        if perfil[0][0] > 1e-4:
            bm.faces.new(list(reversed(aneis[0])))
        if perfil[-1][0] > 1e-4:
            bm.faces.new(aneis[-1])
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(dados)
        bm.free()
        obj = bpy.data.objects.new(nome, dados)
        bpy.context.collection.objects.link(obj)
        obj.location = centro
        obj.scale = escala
        return self.finalizar(obj, mat, osso)

    def aplicar(self, obj):
        bpy.ops.object.select_all(action='DESELECT')
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        for mod in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    def agrupar(self, nome):
        partes = [obj for obj, _ in self.partes]
        for obj in partes:
            self.aplicar(obj)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in partes:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = partes[0]
        if len(partes) > 1:
            bpy.ops.object.join()
        grupo = bpy.context.active_object
        grupo.name = nome
        grupo.data.name = nome
        for p in grupo.data.polygons:
            p.use_smooth = False
        self.partes = []
        return grupo


def triangulos(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def _hexa_de(cor):
    return '#' + ''.join(f'{round(max(0.0, min(1.0, c ** (1 / 2.2))) * 255):02x}' for c in cor[:3])


def _emissivo(material):
    bsdf = next((n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    return bsdf is None or bsdf.inputs['Emission Strength'].default_value > 0.0


def pintar(tamanho=256):
    cena = bpy.context.scene
    malhas = [o for o in bpy.data.objects if o.type == 'MESH' and o.data.materials]
    if not malhas:
        return
    cena.render.engine = 'CYCLES'
    cena.cycles.device = 'CPU'
    cena.cycles.samples = 16
    cena.render.bake.margin = 4
    usos = {}
    for obj in malhas:
        for m in set(obj.data.materials):
            if m:
                usos[m.name] = usos.get(m.name, 0) + 1
    for obj in malhas:
        for i, m in enumerate(obj.data.materials):
            if m and not _emissivo(m) and usos[m.name] > 1:
                copia = m.copy()
                copia.name = f'{m.name}#{obj.name}'
                obj.data.materials[i] = copia
    visibilidade = {o.name: o.hide_render for o in bpy.data.objects if o.type == 'MESH'}
    for obj in malhas:
        materiais = [m for m in obj.data.materials if m and not _emissivo(m)]
        if not materiais:
            continue
        for outro in bpy.data.objects:
            if outro.type == 'MESH':
                outro.hide_render = outro is not obj
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        if not obj.data.uv_layers:
            obj.data.uv_layers.new(name='UV')
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.015)
        bpy.ops.object.mode_set(mode='OBJECT')
        imagem = bpy.data.images.new(f'detalhe_{obj.name}', tamanho, tamanho)
        imagem.colorspace_settings.name = 'Non-Color'
        restaurar = []
        for m in materiais:
            nos = m.node_tree.nodes
            ligacoes = m.node_tree.links
            saida = next(n for n in nos if n.type == 'OUTPUT_MATERIAL')
            bsdf = next(n for n in nos if n.type == 'BSDF_PRINCIPLED')
            m['cor'] = _hexa_de(bsdf.inputs['Base Color'].default_value)
            geometria = nos.new('ShaderNodeNewGeometry')
            separar = nos.new('ShaderNodeSeparateXYZ')
            ligacoes.new(geometria.outputs['Position'], separar.inputs['Vector'])
            pincel = nos.new('ShaderNodeMapRange')
            pincel.inputs['From Min'].default_value = 0.0
            pincel.inputs['From Max'].default_value = 2.0
            pincel.inputs['To Min'].default_value = 0.9
            pincel.inputs['To Max'].default_value = 1.04
            ligacoes.new(separar.outputs['Z'], pincel.inputs['Value'])
            oclusao = nos.new('ShaderNodeAmbientOcclusion')
            oclusao.inputs['Distance'].default_value = 0.05
            sombra = nos.new('ShaderNodeMapRange')
            sombra.inputs['To Min'].default_value = 0.82
            sombra.inputs['To Max'].default_value = 1.0
            ligacoes.new(oclusao.outputs['AO'], sombra.inputs['Value'])
            quina = nos.new('ShaderNodeMapRange')
            quina.inputs['From Min'].default_value = 0.52
            quina.inputs['From Max'].default_value = 0.62
            quina.inputs['To Min'].default_value = 1.0
            quina.inputs['To Max'].default_value = 1.12
            ligacoes.new(geometria.outputs['Pointiness'], quina.inputs['Value'])
            vezes = nos.new('ShaderNodeMath')
            vezes.operation = 'MULTIPLY'
            ligacoes.new(pincel.outputs['Result'], vezes.inputs[0])
            ligacoes.new(sombra.outputs['Result'], vezes.inputs[1])
            total = nos.new('ShaderNodeMath')
            total.operation = 'MULTIPLY'
            total.use_clamp = True
            ligacoes.new(vezes.outputs['Value'], total.inputs[0])
            ligacoes.new(quina.outputs['Result'], total.inputs[1])
            emissao = nos.new('ShaderNodeEmission')
            ligacoes.new(total.outputs['Value'], emissao.inputs['Color'])
            ligacoes.new(emissao.outputs['Emission'], saida.inputs['Surface'])
            textura = nos.new('ShaderNodeTexImage')
            textura.image = imagem
            nos.active = textura
            restaurar.append((m, bsdf, saida, textura, [separar, pincel, oclusao, sombra, geometria, quina, vezes, total, emissao]))
        bpy.ops.object.bake(type='EMIT', margin=4)
        imagem.pack()
        for m, bsdf, saida, textura, temporarios in restaurar:
            for n in temporarios:
                m.node_tree.nodes.remove(n)
            m.node_tree.links.new(bsdf.outputs['BSDF'], saida.inputs['Surface'])
            mistura = m.node_tree.nodes.new('ShaderNodeMix')
            mistura.data_type = 'RGBA'
            mistura.blend_type = 'MULTIPLY'
            mistura.inputs['Factor'].default_value = 1.0
            mistura.inputs[7].default_value = bsdf.inputs['Base Color'].default_value
            m.node_tree.links.new(textura.outputs['Color'], mistura.inputs[6])
            m.node_tree.links.new(mistura.outputs[2], bsdf.inputs['Base Color'])
    for nome, oculto in visibilidade.items():
        bpy.data.objects[nome].hide_render = oculto


def exportar(caminho, animado=False):
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    pintado = os.environ.get('PINTAR') == '1'
    if pintado:
        pintar()
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=caminho, export_format='GLB', use_selection=False, export_apply=False,
        export_animations=animado, export_animation_mode='NLA_TRACKS', export_force_sampling=True,
        export_def_bones=False, export_yup=True, export_cameras=False, export_lights=False,
        export_image_format='JPEG' if pintado else 'AUTO',
    )


def peca_esqueletica(modelo, nome):
    partes = list(modelo.partes)
    for obj, osso in partes:
        modelo.aplicar(obj)
        grupo = obj.vertex_groups.new(name=osso)
        grupo.add([v.index for v in obj.data.vertices], 1.0, 'REPLACE')
    bpy.ops.object.select_all(action='DESELECT')
    for obj, _ in partes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = partes[0][0]
    if len(partes) > 1:
        bpy.ops.object.join()
    peca = bpy.context.active_object
    peca.name = nome
    peca.data.name = nome
    for p in peca.data.polygons:
        p.use_smooth = False
    modelo.partes = []
    return peca


def esqueleto(nome, ossos):
    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
    armacao = bpy.context.active_object
    armacao.name = nome
    armacao.data.name = nome
    edicao = armacao.data.edit_bones
    raiz = edicao[0]
    raiz.name = 'raiz'
    raiz.head = (0, 0, 0)
    raiz.tail = (0, 0.1, 0)
    for nome_osso, cabeca, cauda, pai in ossos:
        b = edicao.new(nome_osso)
        b.head = cabeca
        b.tail = cauda
        b.parent = edicao[pai]
        b.roll = 0
    bpy.ops.object.mode_set(mode='OBJECT')
    return armacao


def vincular(armacao, pecas):
    for peca in pecas:
        peca.parent = armacao
        mod = peca.modifiers.new('esqueleto', 'ARMATURE')
        mod.object = armacao
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = armacao
    armacao.select_set(True)
    bpy.ops.object.mode_set(mode='POSE')
    for pb in armacao.pose.bones:
        pb.rotation_mode = 'XYZ'
    bpy.ops.object.mode_set(mode='OBJECT')


def curvas(a):
    if hasattr(a, 'fcurves'):
        return list(a.fcurves)
    return [c for camada in a.layers for faixa in camada.strips for cb in faixa.channelbags for c in cb.fcurves]


def acao_com_escala(armacao, nome, duracao, quadros_chave, ciclo=True):
    escalas = sys.modules['__main__'].__dict__.get('ESCALAS', {})
    ajustados = []
    for t, poses in quadros_chave:
        novas = {k: dict(v) for k, v in poses.items()}
        for osso, escala in escalas.items():
            novas.setdefault(osso, {}).setdefault('s', escala)
        ajustados.append((t, novas))
    return acao(armacao, nome, duracao, ajustados, ciclo)


def acao(armacao, nome, duracao, quadros_chave, ciclo=True):
    armacao.animation_data_create()
    a = bpy.data.actions.new(nome)
    a.use_fake_user = True
    armacao.animation_data.action = a
    total = max(1, round(duracao * FPS))
    for t, poses in quadros_chave:
        quadro = 1 + round(t * total)
        for pb in armacao.pose.bones:
            pose = poses.get(pb.name, {})
            pb.rotation_euler = tuple(math.radians(v) for v in pose.get('r', (0, 0, 0)))
            pb.location = pose.get('l', (0, 0, 0))
            pb.scale = pose.get('s', (1, 1, 1))
            pb.keyframe_insert('rotation_euler', frame=quadro)
            pb.keyframe_insert('location', frame=quadro)
            pb.keyframe_insert('scale', frame=quadro)
    if ciclo:
        for curva in curvas(a):
            curva.modifiers.new('CYCLES')
    trilha = armacao.animation_data.nla_tracks.new()
    trilha.name = nome
    trilha.strips.new(nome, 1, a)
    armacao.animation_data.action = None
    for pb in armacao.pose.bones:
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)
    return a
