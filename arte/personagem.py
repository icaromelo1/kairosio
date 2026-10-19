import importlib
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comum

importlib.reload(comum)
from comum import Modelo

PALETA = {
    'pele': {'cor': '#e8b894'},
    'olhos': {'cor': '#2a2026'},
    'bochecha': {'cor': '#f09a8c'},
    'branco': {'cor': '#f4f1ea'},
    'preto': {'cor': '#26262b'},
    'lente': {'cor': '#1d2a33', 'aspereza': 0.25},
    'tinta_cabelo': {'cor': '#3d2817'},
    'tinta_chapeu': {'cor': '#c0392b'},
    'tinta_rosto': {'cor': '#2a2a2a'},
    'tinta_cima': {'cor': '#2c7441'},
    'tinta_baixo': {'cor': '#2f3d5c'},
    'tinta_sapato': {'cor': '#f0eee8'},
    'tinta_acessorio': {'cor': '#d9a441'},
}

OSSOS = [
    ('quadril', (0, 0, 0.5), (0, 0, 0.6), 'raiz'),
    ('tronco', (0, 0, 0.6), (0, 0, 0.85), 'quadril'),
    ('cabeca', (0, 0, 0.85), (0, 0, 1.25), 'tronco'),
    ('braco.L', (0.17, 0, 0.82), (0.195, 0, 0.62), 'tronco'),
    ('antebraco.L', (0.195, 0, 0.62), (0.205, 0, 0.44), 'braco.L'),
    ('braco.R', (-0.17, 0, 0.82), (-0.195, 0, 0.62), 'tronco'),
    ('antebraco.R', (-0.195, 0, 0.62), (-0.205, 0, 0.44), 'braco.R'),
    ('coxa.L', (0.075, 0, 0.5), (0.075, 0, 0.27), 'quadril'),
    ('canela.L', (0.075, 0, 0.27), (0.075, 0, 0.04), 'coxa.L'),
    ('coxa.R', (-0.075, 0, 0.5), (-0.075, 0, 0.27), 'quadril'),
    ('canela.R', (-0.075, 0, 0.27), (-0.075, 0, 0.04), 'coxa.R'),
]

m = Modelo(PALETA)
pecas = []

CABECA = (0, 0, 1.03)
RAIO_CABECA = 0.2


def cortar_abaixo(obj, z):
    m.aplicar(obj)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < z], context='VERTS')
    bm.to_mesh(obj.data)
    bm.free()


def lados(funcao):
    for lado, sx in (('L', 1), ('R', -1)):
        funcao(lado, sx)


def fechar(nome):
    pecas.append(comum.peca_esqueletica(m, nome))


def corpo():
    m.esfera('cabeca', CABECA, RAIO_CABECA, 'pele', 'cabeca', escala=(1, 0.95, 1), segmentos=16, aneis=10)
    lados(lambda l, sx: m.esfera(f'olho{l}', (sx * 0.072, -0.18, 1.05), 0.026, 'olhos', 'cabeca', escala=(1, 0.6, 1.25), segmentos=8, aneis=6))
    lados(lambda l, sx: m.esfera(f'bochecha{l}', (sx * 0.12, -0.16, 0.98), 0.03, 'bochecha', 'cabeca', escala=(1, 0.4, 0.7), segmentos=8, aneis=5))
    m.caixa('boca', (0, -0.188, 0.955), (0.05, 0.01, 0.012), 'olhos', 'cabeca', chanfro=0)
    lados(lambda l, sx: m.esfera(f'orelha{l}', (sx * 0.195, 0.0, 1.02), 0.04, 'pele', 'cabeca', escala=(0.5, 0.8, 1), segmentos=8, aneis=5))
    m.cilindro('pescoco', (0, 0, 0.84), 0.05, 0.07, 'pele', 'tronco')
    m.caixa('peito', (0, 0, 0.72), (0.3, 0.18, 0.26), 'pele', 'tronco', chanfro=0.03)
    m.caixa('bacia', (0, 0, 0.55), (0.28, 0.17, 0.12), 'pele', 'quadril', chanfro=0.03)

    def membros(l, sx):
        m.cilindro(f'braco{l}', (sx * 0.183, 0, 0.72), 0.045, 0.21, 'pele', f'braco.{l}', lados=8)
        m.cilindro(f'antebraco{l}', (sx * 0.2, 0, 0.53), 0.04, 0.19, 'pele', f'antebraco.{l}', lados=8)
        m.esfera(f'mao{l}', (sx * 0.205, 0, 0.42), 0.05, 'pele', f'antebraco.{l}', segmentos=8, aneis=6)
        m.cilindro(f'coxa{l}', (sx * 0.075, 0, 0.385), 0.06, 0.24, 'pele', f'coxa.{l}', lados=8)
        m.cilindro(f'canela{l}', (sx * 0.075, 0, 0.16), 0.05, 0.24, 'pele', f'canela.{l}', lados=8)
        m.caixa(f'pe{l}', (sx * 0.075, -0.025, 0.025), (0.08, 0.14, 0.05), 'pele', f'canela.{l}')
    lados(membros)
    fechar('corpo')


def base_cabelo():
    m.esfera('cabelo', (0, 0.035, 1.075), 0.215, 'tinta_cabelo', 'cabeca', escala=(1.03, 1, 1), segmentos=14, aneis=9)


def cabelos():
    base_cabelo()
    lados(lambda l, sx: m.caixa(f'costeleta{l}', (sx * 0.19, -0.04, 1.0), (0.04, 0.07, 0.1), 'tinta_cabelo', 'cabeca'))
    fechar('cabelo_curto')

    base_cabelo()
    m.esfera('topete', (0, -0.1, 1.22), 0.1, 'tinta_cabelo', 'cabeca', escala=(1.4, 1.1, 0.7))
    m.esfera('topete2', (0.04, -0.14, 1.2), 0.07, 'tinta_cabelo', 'cabeca', escala=(1.2, 1, 0.7))
    fechar('cabelo_topete')

    base_cabelo()
    m.caixa('cascata', (0, 0.12, 0.9), (0.38, 0.1, 0.42), 'tinta_cabelo', 'cabeca', chanfro=0.04)
    lados(lambda l, sx: m.caixa(f'mecha{l}', (sx * 0.19, 0.0, 0.94), (0.07, 0.16, 0.32), 'tinta_cabelo', 'cabeca', chanfro=0.03))
    m.caixa('franja', (0, -0.15, 1.15), (0.3, 0.06, 0.08), 'tinta_cabelo', 'cabeca', chanfro=0.03)
    fechar('cabelo_longo')

    base_cabelo()
    m.esfera('coque', (0, 0.12, 1.27), 0.09, 'tinta_cabelo', 'cabeca')
    fechar('cabelo_coque')

    for i in range(11):
        a = i / 11 * math.tau
        r = 0.17
        m.icosfera(f'cacho{i}', (math.cos(a) * r, math.sin(a) * r * 0.9 + 0.04, 1.1 + 0.03 * math.sin(i)), 0.085, 'tinta_cabelo', 'cabeca')
    m.icosfera('cachoTopo', (0, 0.02, 1.22), 0.13, 'tinta_cabelo', 'cabeca', escala=(1.2, 1.2, 0.8))
    fechar('cabelo_cacheado')

    base_cabelo()
    m.caixa('crista', (0, 0.0, 1.27), (0.07, 0.34, 0.12), 'tinta_cabelo', 'cabeca', chanfro=0.02)
    fechar('cabelo_moicano')


def chapeus():
    m.torno('copa', [(0.222, 1.08), (0.21, 1.17), (0.15, 1.24), (0.0, 1.26)], 'tinta_chapeu', 'cabeca', lados=16)
    m.caixa('aba', (0, -0.24, 1.09), (0.24, 0.16, 0.02), 'tinta_chapeu', 'cabeca', chanfro=0.01)
    m.esfera('botao', (0, 0, 1.26), 0.02, 'tinta_chapeu', 'cabeca', segmentos=6, aneis=4)
    fechar('chapeu_bone')

    m.torno('gorro', [(0.228, 1.04), (0.232, 1.12), (0.2, 1.22), (0.12, 1.29), (0.0, 1.31)], 'tinta_chapeu', 'cabeca', lados=16)
    m.cilindro('barra', (0, 0, 1.06), 0.234, 0.06, 'tinta_chapeu', 'cabeca', lados=16)
    m.icosfera('pompom', (0, 0, 1.34), 0.05, 'branco', 'cabeca')
    fechar('chapeu_gorro')

    m.cilindro('aba', (0, 0, 1.16), 0.31, 0.02, 'tinta_chapeu', 'cabeca', lados=18)
    m.cilindro('copa', (0, 0, 1.25), 0.17, 0.17, 'tinta_chapeu', 'cabeca', lados=16, raio_topo=0.15)
    m.cilindro('faixa', (0, 0, 1.19), 0.172, 0.035, 'preto', 'cabeca', lados=16)
    fechar('chapeu_fedora')

    arco = m.toro('arco', (0, 0, 1.03), 0.228, 0.018, 'tinta_chapeu', 'cabeca', rot=(math.pi / 2, 0, 0), lados=24)
    cortar_abaixo(arco, 1.02)
    lados(lambda l, sx: m.cilindro(f'concha{l}', (sx * 0.22, 0, 1.02), 0.06, 0.05, 'preto', 'cabeca', rot=(0, math.pi / 2, 0), lados=12))
    fechar('chapeu_fones')


def rostos():
    lados(lambda l, sx: m.toro(f'aro{l}', (sx * 0.072, -0.195, 1.05), 0.045, 0.008, 'tinta_rosto', 'cabeca', rot=(math.pi / 2, 0, 0), lados=12, secao=4))
    m.caixa('ponte', (0, -0.197, 1.055), (0.05, 0.01, 0.01), 'tinta_rosto', 'cabeca', chanfro=0)
    lados(lambda l, sx: m.caixa(f'haste{l}', (sx * 0.15, -0.1, 1.055), (0.01, 0.2, 0.01), 'tinta_rosto', 'cabeca', chanfro=0))
    fechar('rosto_oculos')

    lados(lambda l, sx: m.caixa(f'lente{l}', (sx * 0.075, -0.2, 1.05), (0.1, 0.012, 0.06), 'lente', 'cabeca', chanfro=0.005))
    m.caixa('ponte', (0, -0.2, 1.06), (0.06, 0.012, 0.012), 'tinta_rosto', 'cabeca', chanfro=0)
    lados(lambda l, sx: m.caixa(f'haste{l}', (sx * 0.15, -0.1, 1.06), (0.01, 0.2, 0.012), 'tinta_rosto', 'cabeca', chanfro=0))
    fechar('rosto_oculos_sol')

    m.esfera('barba', (0, -0.125, 0.93), 0.14, 'tinta_cabelo', 'cabeca', escala=(1.15, 0.55, 0.72), segmentos=12, aneis=8)
    m.caixa('bigode', (0, -0.192, 0.98), (0.11, 0.03, 0.03), 'tinta_cabelo', 'cabeca', chanfro=0.01)
    fechar('rosto_barba')

    m.caixa('bigode', (0, -0.192, 0.98), (0.12, 0.03, 0.03), 'tinta_cabelo', 'cabeca', chanfro=0.01)
    fechar('rosto_bigode')


def tronco_roupa(mat='tinta_cima', largura=0.33, profundidade=0.21):
    m.caixa('torso', (0, 0, 0.715), (largura, profundidade, 0.29), mat, 'tronco', chanfro=0.03)
    m.caixa('barra', (0, 0, 0.57), (largura - 0.02, profundidade - 0.01, 0.1), mat, 'quadril', chanfro=0.03)


def mangas(longa, mat='tinta_cima'):
    def manga(l, sx):
        m.cilindro(f'manga{l}', (sx * 0.185, 0, 0.75 if not longa else 0.72), 0.056, 0.14 if not longa else 0.22, mat, f'braco.{l}', lados=8)
        if longa:
            m.cilindro(f'punho{l}', (sx * 0.2, 0, 0.54), 0.05, 0.2, mat, f'antebraco.{l}', lados=8)
    lados(manga)


def cimas():
    tronco_roupa()
    mangas(False)
    fechar('cima_camiseta')

    tronco_roupa(largura=0.34, profundidade=0.22)
    mangas(True)
    m.caixa('capuz', (0, 0.11, 0.85), (0.24, 0.08, 0.09), 'tinta_cima', 'tronco', chanfro=0.03)
    m.caixa('bolso', (0, -0.115, 0.6), (0.18, 0.01, 0.08), 'tinta_cima', 'quadril', chanfro=0.01)
    lados(lambda l, sx: m.cilindro(f'cordao{l}', (sx * 0.04, -0.112, 0.76), 0.007, 0.09, 'branco', 'tronco', lados=5))
    fechar('cima_moletom')

    tronco_roupa()
    mangas(True)
    m.caixa('gola', (0, -0.06, 0.845), (0.16, 0.1, 0.035), 'branco', 'tronco', chanfro=0.01)
    for i in range(4):
        m.esfera(f'botao{i}', (0, -0.107, 0.8 - i * 0.07), 0.009, 'branco', 'tronco' if i < 3 else 'quadril', segmentos=6, aneis=4)
    fechar('cima_camisa')

    tronco_roupa(largura=0.31, profundidade=0.2)
    fechar('cima_regata')

    tronco_roupa(largura=0.345, profundidade=0.225)
    mangas(True)
    m.caixa('blusaInterna', (0, -0.113, 0.7), (0.09, 0.01, 0.26), 'branco', 'tronco', chanfro=0)
    lados(lambda l, sx: m.caixa(f'lapela{l}', (sx * 0.07, -0.118, 0.78), (0.05, 0.012, 0.12), 'tinta_cima', 'tronco', chanfro=0.005, rot=(0, sx * 0.3, 0)))
    fechar('cima_jaqueta')


def baixos():
    def quadril():
        m.caixa('cos', (0, 0, 0.5), (0.3, 0.19, 0.11), 'tinta_baixo', 'quadril', chanfro=0.03)

    quadril()
    lados(lambda l, sx: m.cilindro(f'coxa{l}', (sx * 0.075, 0, 0.385), 0.068, 0.25, 'tinta_baixo', f'coxa.{l}', lados=8))
    lados(lambda l, sx: m.cilindro(f'canela{l}', (sx * 0.075, 0, 0.16), 0.058, 0.22, 'tinta_baixo', f'canela.{l}', lados=8))
    fechar('baixo_calca')

    quadril()
    lados(lambda l, sx: m.cilindro(f'coxa{l}', (sx * 0.075, 0, 0.41), 0.07, 0.19, 'tinta_baixo', f'coxa.{l}', lados=8))
    fechar('baixo_bermuda')

    quadril()
    m.torno('saia', [(0.16, 0.56), (0.2, 0.45), (0.24, 0.32)], 'tinta_baixo', 'quadril', lados=14)
    fechar('baixo_saia')


def sapatos():
    def tenis(l, sx):
        m.caixa(f'tenis{l}', (sx * 0.075, -0.03, 0.04), (0.1, 0.18, 0.07), 'tinta_sapato', f'canela.{l}', chanfro=0.02)
        m.caixa(f'sola{l}', (sx * 0.075, -0.03, 0.01), (0.105, 0.185, 0.02), 'branco', f'canela.{l}', chanfro=0.005)
    lados(tenis)
    fechar('sapato_tenis')

    def bota(l, sx):
        m.caixa(f'bota{l}', (sx * 0.075, -0.02, 0.075), (0.1, 0.17, 0.14), 'tinta_sapato', f'canela.{l}', chanfro=0.02)
        m.caixa(f'sola{l}', (sx * 0.075, -0.02, 0.01), (0.105, 0.175, 0.022), 'preto', f'canela.{l}', chanfro=0.005)
    lados(bota)
    fechar('sapato_bota')

    def social(l, sx):
        m.caixa(f'sapato{l}', (sx * 0.075, -0.035, 0.035), (0.092, 0.18, 0.055), 'tinta_sapato', f'canela.{l}', chanfro=0.02)
        m.caixa(f'sola{l}', (sx * 0.075, -0.035, 0.008), (0.095, 0.182, 0.016), 'preto', f'canela.{l}', chanfro=0.004)
    lados(social)
    fechar('sapato_social')

    def chinelo(l, sx):
        m.caixa(f'chinelo{l}', (sx * 0.075, -0.03, 0.008), (0.1, 0.19, 0.016), 'tinta_sapato', f'canela.{l}', chanfro=0.004)
        m.caixa(f'tira{l}', (sx * 0.075, -0.06, 0.045), (0.09, 0.02, 0.02), 'tinta_sapato', f'canela.{l}', chanfro=0)
    lados(chinelo)
    fechar('sapato_chinelo')


def acessorios():
    m.caixa('mochila', (0, 0.17, 0.7), (0.24, 0.1, 0.27), 'tinta_acessorio', 'tronco', chanfro=0.03)
    m.caixa('bolsoMochila', (0, 0.225, 0.64), (0.18, 0.03, 0.1), 'tinta_acessorio', 'tronco', chanfro=0.015)
    lados(lambda l, sx: m.caixa(f'alca{l}', (sx * 0.09, -0.112, 0.73), (0.03, 0.012, 0.22), 'preto', 'tronco', chanfro=0))
    fechar('acessorio_mochila')

    m.toro('cachecol', (0, 0, 0.845), 0.085, 0.035, 'tinta_acessorio', 'tronco', lados=14, secao=6)
    m.caixa('ponta', (0.05, -0.1, 0.74), (0.06, 0.03, 0.16), 'tinta_acessorio', 'tronco', chanfro=0.01)
    fechar('acessorio_cachecol')

    m.caixa('fita', (0, -0.112, 0.78), (0.012, 0.01, 0.12), 'tinta_acessorio', 'tronco', chanfro=0)
    m.caixa('cracha', (0, -0.118, 0.69), (0.07, 0.012, 0.09), 'branco', 'tronco', chanfro=0.005)
    m.caixa('foto', (0, -0.125, 0.7), (0.035, 0.004, 0.035), 'tinta_acessorio', 'tronco', chanfro=0)
    fechar('acessorio_cracha')

    m.caixa('bolsa', (0.2, -0.02, 0.55), (0.07, 0.18, 0.14), 'tinta_acessorio', 'quadril', chanfro=0.02)
    m.caixa('alcaBolsa', (0.02, -0.02, 0.72), (0.03, 0.02, 0.4), 'preto', 'tronco', chanfro=0, rot=(0, -0.8, 0))
    fechar('acessorio_bolsa')


def animacoes(armacao):
    comum.acao(armacao, 'parado', 2.4, [
        (0, {}),
        (0.5, {'tronco': {'r': (2, 0, 0)}, 'cabeca': {'r': (-2, 0, 2)}, 'braco.L': {'r': (0, 0, -2)}, 'braco.R': {'r': (0, 0, 2)}}),
        (1, {}),
    ])

    def passo(fase):
        s = 1 if fase else -1
        return {
            'quadril': {'l': (0, 0.015, 0)},
            'coxa.L': {'r': (-28 * s, 0, 0)},
            'coxa.R': {'r': (28 * s, 0, 0)},
            'canela.L': {'r': (12 if s > 0 else 30, 0, 0)},
            'canela.R': {'r': (30 if s > 0 else 12, 0, 0)},
            'braco.L': {'r': (26 * s, 0, -4)},
            'braco.R': {'r': (-26 * s, 0, 4)},
            'antebraco.L': {'r': (-15, 0, 0)},
            'antebraco.R': {'r': (-15, 0, 0)},
            'tronco': {'r': (4, 3 * s, 0)},
        }

    meio = {'quadril': {'l': (0, -0.01, 0)}, 'canela.L': {'r': (20, 0, 0)}, 'canela.R': {'r': (20, 0, 0)}, 'tronco': {'r': (4, 0, 0)}, 'antebraco.L': {'r': (-15, 0, 0)}, 'antebraco.R': {'r': (-15, 0, 0)}}
    comum.acao(armacao, 'andar', 0.7, [(0, passo(True)), (0.25, meio), (0.5, passo(False)), (0.75, meio), (1, passo(True))])

    sentado = {
        'coxa.L': {'r': (-88, 0, 0)}, 'coxa.R': {'r': (-88, 0, 0)},
        'canela.L': {'r': (88, 0, 0)}, 'canela.R': {'r': (88, 0, 0)},
        'braco.L': {'r': (-25, 0, 3)}, 'braco.R': {'r': (-25, 0, -3)},
        'antebraco.L': {'r': (-45, 0, 0)}, 'antebraco.R': {'r': (-45, 0, 0)},
        'quadril': {'l': (0, -0.02, 0)},
    }
    respira = dict(sentado)
    respira['tronco'] = {'r': (3, 0, 0)}
    comum.acao(armacao, 'sentar', 2.4, [(0, sentado), (0.5, respira), (1, sentado)])

    def aceno(angulo):
        return {'braco.R': {'r': (0, 0, 145)}, 'antebraco.R': {'r': (0, 0, angulo)}, 'cabeca': {'r': (0, 0, 6)}, 'braco.L': {'r': (0, 0, -3)}}
    comum.acao(armacao, 'acenar', 0.8, [(0, aceno(-25)), (0.5, aceno(25)), (1, aceno(-25))])

    def danca(s):
        return {
            'raiz': {'l': (0, 0, 0)},
            'quadril': {'r': (0, 0, 8 * s), 'l': (0, 0.03 if s > 0 else 0, 0)},
            'tronco': {'r': (0, 10 * s, -6 * s)},
            'cabeca': {'r': (0, -8 * s, 6 * s)},
            'braco.L': {'r': (0, 0, -130 if s > 0 else -30)},
            'braco.R': {'r': (0, 0, 30 if s > 0 else 130)},
            'antebraco.L': {'r': (0, 0, -40)},
            'antebraco.R': {'r': (0, 0, 40)},
            'coxa.L': {'r': (-10 if s > 0 else 0, 0, 0)},
            'coxa.R': {'r': (0 if s > 0 else -10, 0, 0)},
            'canela.L': {'r': (15 if s > 0 else 0, 0, 0)},
            'canela.R': {'r': (0 if s > 0 else 15, 0, 0)},
        }
    comum.acao(armacao, 'dancar', 1.0, [(0, danca(1)), (0.5, danca(-1)), (1, danca(1))])


def fotografar(pasta, armacao, visiveis, nome, acao_nome=None, quadro=1, direcao=(0.6, -1, 0.5)):
    for obj in pecas:
        obj.hide_render = obj.name not in visiveis
    cena = bpy.context.scene
    for trilha in armacao.animation_data.nla_tracks:
        trilha.mute = True
    armacao.animation_data.action = bpy.data.actions[acao_nome] if acao_nome else None
    if not acao_nome:
        for pb in armacao.pose.bones:
            pb.rotation_euler = (0, 0, 0)
            pb.location = (0, 0, 0)
    cena.frame_set(quadro)
    camera = bpy.data.objects.get('camera')
    alvo = Vector((0, 0, 0.62))
    camera.location = alvo + Vector(direcao).normalized() * 6
    camera.rotation_euler = (alvo - camera.location).to_track_quat('-Z', 'Y').to_euler()
    cena.render.filepath = os.path.join(pasta, f'{nome}.png')
    bpy.ops.render.render(write_still=True)


def preparar_fotos():
    cena = bpy.context.scene
    motores = [i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    eevee = next((e for e in motores if 'EEVEE' in e), motores[0])
    try:
        cena.render.engine = eevee
    except TypeError:
        pass
    mundo = bpy.data.worlds.new('mundo')
    cena.world = mundo
    if bpy.app.version < (5, 0, 0):
        mundo.use_nodes = True
    fundo = next(n for n in mundo.node_tree.nodes if n.type == 'BACKGROUND')
    fundo.inputs['Color'].default_value = (*comum.hexa('#e2d5b8'), 1)
    fundo.inputs['Strength'].default_value = 1.0
    bpy.ops.object.light_add(type='SUN', location=(2, -3, 5))
    sol = bpy.context.active_object
    sol.data.energy = 3.0
    sol.rotation_euler = (math.radians(40), math.radians(10), math.radians(20))
    cena.render.resolution_x = 360
    cena.render.resolution_y = 420
    bpy.ops.object.camera_add()
    camera = bpy.context.active_object
    camera.name = 'camera'
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 1.6
    cena.camera = camera
    return camera


if __name__ == '__main__':
    saida = comum.argumentos()
    fotos = '--fotos' in sys.argv
    comum.limpar()
    corpo()
    cabelos()
    chapeus()
    rostos()
    cimas()
    baixos()
    sapatos()
    acessorios()
    armacao = comum.esqueleto('esqueleto', OSSOS)
    comum.vincular(armacao, pecas)
    animacoes(armacao)
    total = 0
    for p in pecas:
        total += comum.triangulos(p)
        print(f'PECA {p.name} {comum.triangulos(p)}')
    print(f'TRIANGULOS {total}')
    if fotos:
        pasta = saida
        os.makedirs(pasta, exist_ok=True)
        preparar_fotos()
        base = {'corpo', 'cabelo_curto', 'cima_camiseta', 'baixo_calca', 'sapato_tenis'}
        fotografar(pasta, armacao, base, 'frente', None, 1, (0, -1, 0.15))
        fotografar(pasta, armacao, base, 'lado', None, 1, (1, 0, 0.15))
        fotografar(pasta, armacao, base, 'andar', 'andar', 1)
        fotografar(pasta, armacao, base, 'sentar', 'sentar', 1, (1, -0.3, 0.2))
        fotografar(pasta, armacao, base, 'acenar', 'acenar', 1, (0, -1, 0.15))
        fotografar(pasta, armacao, base, 'dancar', 'dancar', 1, (0, -1, 0.15))
        fotografar(pasta, armacao, {'corpo', 'cabelo_longo', 'chapeu_fedora', 'rosto_oculos', 'cima_jaqueta', 'baixo_saia', 'sapato_bota', 'acessorio_cracha'}, 'combo1')
        fotografar(pasta, armacao, {'corpo', 'cabelo_cacheado', 'rosto_barba', 'cima_moletom', 'baixo_bermuda', 'sapato_chinelo', 'acessorio_mochila'}, 'combo2', None, 1, (-0.6, 1, 0.4))
        fotografar(pasta, armacao, {'corpo', 'cabelo_coque', 'chapeu_fones', 'rosto_oculos_sol', 'cima_camisa', 'baixo_calca', 'sapato_social', 'acessorio_cachecol'}, 'combo3')
    else:
        for p in pecas:
            p.hide_render = False
        comum.exportar(saida, animado=True)
