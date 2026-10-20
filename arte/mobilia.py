import importlib
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comum

importlib.reload(comum)
from comum import Modelo

PALETA = {
    'madeira': {'cor': '#b9824f'},
    'madeiraEscura': {'cor': '#7a5232'},
    'metal': {'cor': '#59626b', 'metal': 0.3, 'aspereza': 0.5},
    'metalClaro': {'cor': '#b3bcc3', 'metal': 0.3, 'aspereza': 0.45},
    'preto': {'cor': '#2a2c31'},
    'tela': {'cor': '#9fd8ff', 'emissao': '#7cc8ff', 'forca': 0.8},
    'branco': {'cor': '#f3efe6'},
    'creme': {'cor': '#e6d8b8'},
    'azul': {'cor': '#4d6fa3'},
    'verde': {'cor': '#4f8a5b'},
    'mostarda': {'cor': '#d9a441'},
    'vinho': {'cor': '#9b4a5a'},
    'vermelho': {'cor': '#d0453a'},
    'vaso': {'cor': '#c56a3d'},
    'folha': {'cor': '#3f8f4a'},
    'folhaClara': {'cor': '#6db35a'},
    'luz': {'cor': '#ffe7b0', 'emissao': '#ffd27a', 'forca': 1.2},
    'ledVerde': {'cor': '#7dffa0', 'emissao': '#5dff8a', 'forca': 1.5},
    'agua': {'cor': '#8fc8f0', 'aspereza': 0.2},
    'livroA': {'cor': '#3d6fb0'},
    'livroB': {'cor': '#c9483c'},
    'livroC': {'cor': '#e0b54a'},
    'livroD': {'cor': '#5a9b6a'},
    'tronco': {'cor': '#6e4a2c'},
    'pinheiro': {'cor': '#2f6b3f'},
    'pedra': {'cor': '#9a958a'},
    'pedraClara': {'cor': '#c9c2b2'},
    'florRosa': {'cor': '#e9789a'},
    'florAmarela': {'cor': '#f2c94c'},
    'florRoxa': {'cor': '#8e6bd1'},
    'terra': {'cor': '#7b5a3c'},
    'aguaFonte': {'cor': '#7fc4e8', 'aspereza': 0.15},
    'verdeMesa': {'cor': '#2f7d55'},
    'azulMesa': {'cor': '#2c5d8f'},
    'arcade': {'cor': '#6b4fa8'},
    'telaJogo': {'cor': '#ff7ac8', 'emissao': '#ff6ab8', 'forca': 1.0},
    'vidro': {'cor': '#bfe3f2', 'emissao': '#a8d8ee', 'forca': 0.35, 'aspereza': 0.1},
    'moldura': {'cor': '#f3efe6'},
    'cortica': {'cor': '#c9955c'},
    'papelA': {'cor': '#fff3a6'},
    'papelB': {'cor': '#ffc2d1'},
    'papelC': {'cor': '#b8e6c9'},
    'quadroA': {'cor': '#e07a5f'},
    'quadroB': {'cor': '#3d6fb0'},
    'quadroC': {'cor': '#f2c94c'},
    'tapeteGrande': {'cor': '#5b7fb5'},
    'tapeteBorda': {'cor': '#e6d8b8'},
}

m = Modelo(PALETA)
aleatorio = random.Random(7)


def pernas(x, y, altura, raio=0.025, mat='metal'):
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.cilindro('perna', (sx * x, sy * y, altura / 2), raio, altura, mat, lados=8)


def mesa_trabalho():
    m.caixa('tampo', (0, 0, 0.725), (1.4, 0.7, 0.04), 'madeira', chanfro=0.012)
    m.caixa('borda', (0, -0.345, 0.7), (1.38, 0.012, 0.03), 'madeiraEscura', chanfro=0)
    for sx in (-1, 1):
        m.caixa('pe', (sx * 0.66, 0, 0.36), (0.04, 0.62, 0.04), 'metal', chanfro=0.008)
        m.caixa('coluna', (sx * 0.66, 0, 0.36), (0.04, 0.04, 0.7), 'metal', chanfro=0.008)
    m.caixa('trave', (0, 0.25, 0.55), (1.3, 0.03, 0.08), 'metal', chanfro=0.006)
    m.caixa('gaveteiro', (0.45, 0.02, 0.32), (0.38, 0.5, 0.56), 'branco', chanfro=0.015)
    for i in range(3):
        z = 0.15 + i * 0.17
        m.caixa(f'gaveta{i}', (0.45, -0.232, z), (0.34, 0.01, 0.15), 'creme', chanfro=0.004)
        m.caixa(f'puxador{i}', (0.45, -0.24, z + 0.04), (0.12, 0.012, 0.012), 'metal', chanfro=0)
    m.caixa('baseMonitor', (0, 0.18, 0.755), (0.24, 0.16, 0.015), 'preto', chanfro=0.006)
    m.caixa('hasteMonitor', (0, 0.22, 0.86), (0.05, 0.04, 0.22), 'preto', chanfro=0.006)
    m.caixa('monitor', (0, 0.18, 1.04), (0.64, 0.035, 0.38), 'preto', chanfro=0.01)
    m.caixa('telaMonitor', (0, 0.161, 1.045), (0.58, 0.004, 0.32), 'tela', chanfro=0)
    m.caixa('teclado', (0, -0.12, 0.752), (0.44, 0.15, 0.015), 'preto', chanfro=0.004)
    for i in range(4):
        m.caixa(f'teclas{i}', (0, -0.17 + i * 0.033, 0.761), (0.4, 0.022, 0.004), 'metalClaro', chanfro=0)
    m.caixa('mousepad', (0.34, -0.12, 0.747), (0.22, 0.18, 0.004), 'azul', chanfro=0)
    m.esfera('mouse', (0.34, -0.12, 0.757), 0.03, 'branco', escala=(0.8, 1.2, 0.5), segmentos=8, aneis=6)
    m.cilindro('caneca', (-0.5, -0.06, 0.79), 0.04, 0.09, 'vermelho', lados=12)
    m.toro('alca', (-0.455, -0.06, 0.79), 0.025, 0.008, 'vermelho', rot=(math.pi / 2, 0, 0), lados=10, secao=4)
    m.caixa('papel1', (-0.32, -0.02, 0.747), (0.2, 0.28, 0.004), 'branco', chanfro=0, rot=(0, 0, 0.15))
    m.caixa('papel2', (-0.3, -0.04, 0.751), (0.2, 0.28, 0.004), 'creme', chanfro=0, rot=(0, 0, -0.1))
    return m.agrupar('mesa_trabalho')

def cadeira():
    m.caixa('assento', (0, -0.01, 0.47), (0.46, 0.44, 0.07), 'azul', chanfro=0.03)
    m.caixa('almofadaAssento', (0, -0.02, 0.51), (0.4, 0.38, 0.03), 'azul', chanfro=0.015)
    m.caixa('encosto', (0, 0.22, 0.78), (0.44, 0.06, 0.46), 'azul', chanfro=0.03, rot=(-0.12, 0, 0))
    m.caixa('lombar', (0, 0.19, 0.68), (0.36, 0.03, 0.12), 'azul', chanfro=0.012, rot=(-0.12, 0, 0))
    m.caixa('suporte', (0, 0.2, 0.55), (0.06, 0.04, 0.16), 'preto', chanfro=0.008)
    for sx in (-1, 1):
        m.caixa(f'bracoV{sx}', (sx * 0.24, 0.02, 0.58), (0.03, 0.04, 0.16), 'preto', chanfro=0.006)
        m.caixa(f'bracoH{sx}', (sx * 0.24, -0.01, 0.665), (0.05, 0.26, 0.03), 'preto', chanfro=0.01)
    m.cilindro('coluna', (0, 0, 0.3), 0.025, 0.32, 'metalClaro', lados=10)
    m.cilindro('capa', (0, 0, 0.22), 0.035, 0.16, 'preto', lados=10)
    for i in range(5):
        a = i / 5 * math.tau
        m.caixa(f'pata{i}', (math.cos(a) * 0.13, math.sin(a) * 0.13, 0.07), (0.26, 0.04, 0.03), 'preto', chanfro=0.008, rot=(0, 0, a))
        m.esfera(f'rodinha{i}', (math.cos(a) * 0.25, math.sin(a) * 0.25, 0.03), 0.03, 'preto', segmentos=8, aneis=5)
    return m.agrupar('cadeira')

def mesa_reuniao():
    m.caixa('tampo', (0, 0, 0.73), (3.2, 1.3, 0.05), 'madeira', chanfro=0.025)
    m.caixa('filete', (0, 0, 0.705), (3.1, 1.2, 0.02), 'madeiraEscura', chanfro=0)
    for x in (-1.05, 1.05):
        m.caixa('pedestal', (x, 0, 0.36), (0.12, 0.8, 0.68), 'metal', chanfro=0.015)
        m.caixa('pe', (x, 0, 0.02), (0.22, 1.0, 0.04), 'metal', chanfro=0.01)
    m.caixa('travessa', (0, 0, 0.4), (2.0, 0.08, 0.06), 'metal', chanfro=0.01)
    m.caixa('tomadas', (0, 0, 0.765), (0.4, 0.12, 0.02), 'preto', chanfro=0.004)
    m.caixa('notebook', (0.6, -0.25, 0.765), (0.34, 0.24, 0.02), 'metalClaro', chanfro=0.004)
    m.caixa('tela', (0.6, -0.14, 0.87), (0.34, 0.02, 0.2), 'metalClaro', chanfro=0.004, rot=(-0.25, 0, 0))
    for i, x in enumerate((-1.1, -0.2, 1.0)):
        m.caixa(f'bloco{i}', (x, 0.35 * (1 if i % 2 else -1), 0.76), (0.15, 0.21, 0.01), 'papelA', chanfro=0)
        m.cilindro(f'caneta{i}', (x + 0.12, 0.35 * (1 if i % 2 else -1), 0.765), 0.006, 0.14, 'azul', lados=5, rot=(math.pi / 2, 0, 0.3))
    m.cilindro('jarra', (-0.6, 0.15, 0.85), 0.06, 0.2, 'agua', lados=12)
    for x in (-0.45, -0.75):
        m.cilindro('copo', (x, 0.3, 0.8), 0.03, 0.09, 'agua', lados=10)
    return m.agrupar('mesa_reuniao')

def estofado(largura, profundidade, tecido, nome, lugares):
    m.caixa('base', (0, 0, 0.2), (largura - 0.1, profundidade - 0.05, 0.22), tecido, chanfro=0.04)
    largura_util = largura - 0.4
    for i in range(lugares):
        x = -largura_util / 2 + largura_util / lugares * (i + 0.5)
        m.caixa('almofada', (x, -0.06, 0.38), (largura_util / lugares - 0.02, profundidade - 0.32, 0.15), tecido, chanfro=0.05)
        m.caixa('encostoAlmofada', (x, profundidade / 2 - 0.22, 0.62), (largura_util / lugares - 0.03, 0.16, 0.36), tecido, chanfro=0.06, rot=(-0.18, 0, 0))
        m.caixa('costura', (x, -0.06, 0.457), (largura_util / lugares - 0.1, profundidade - 0.42, 0.004), 'creme', chanfro=0)
    m.caixa('encosto', (0, profundidade / 2 - 0.08, 0.5), (largura, 0.16, 0.6), tecido, chanfro=0.05)
    for sx in (-1, 1):
        m.caixa('braco', (sx * (largura / 2 - 0.1), 0, 0.36), (0.2, profundidade, 0.32), tecido, chanfro=0.05)
        m.cilindro('rolo', (sx * (largura / 2 - 0.1), 0, 0.53), 0.1, profundidade, tecido, lados=12, rot=(math.pi / 2, 0, 0))
    if largura > 1.2:
        m.caixa('almofadaDecor', (-largura / 2 + 0.35, 0.12, 0.6), (0.3, 0.1, 0.3), 'mostarda' if tecido != 'mostarda' else 'vinho', chanfro=0.05, rot=(0.3, 0, 0.2))
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.cilindro('pe', (sx * (largura / 2 - 0.12), sy * (profundidade / 2 - 0.12), 0.045), 0.03, 0.09, 'madeiraEscura', lados=8, raio_topo=0.02)
    return m.agrupar(nome)

def mesa_centro():
    m.caixa('tampo', (0, 0, 0.38), (1.1, 0.6, 0.05), 'madeira', chanfro=0.015)
    pernas(0.48, 0.24, 0.36, raio=0.03, mat='madeiraEscura')
    m.caixa('livro1', (-0.2, 0.05, 0.42), (0.26, 0.18, 0.03), 'livroA')
    m.caixa('livro2', (-0.19, 0.04, 0.45), (0.22, 0.16, 0.03), 'livroC')
    m.cilindro('xicara', (0.25, -0.08, 0.43), 0.04, 0.06, 'branco')
    return m.agrupar('mesa_centro')


def mesa_redonda():
    m.cilindro('tampo', (0, 0, 0.72), 0.55, 0.05, 'branco', lados=20)
    m.cilindro('pe', (0, 0, 0.36), 0.05, 0.7, 'metal')
    m.cilindro('base', (0, 0, 0.02), 0.3, 0.04, 'metal', lados=16)
    m.cilindro('vasinho', (0.1, 0.1, 0.79), 0.05, 0.09, 'vaso')
    m.icosfera('flor', (0.1, 0.1, 0.88), 0.07, 'folhaClara')
    return m.agrupar('mesa_redonda')


def banqueta():
    m.cilindro('assento', (0, 0, 0.62), 0.2, 0.06, 'madeira', lados=14)
    m.cilindro('coluna', (0, 0, 0.31), 0.03, 0.6, 'metal')
    m.cilindro('base', (0, 0, 0.015), 0.18, 0.03, 'metal', lados=14)
    m.toro('apoio', (0, 0, 0.25), 0.14, 0.012, 'metal')
    return m.agrupar('banqueta')


def puff():
    m.cilindro('corpo', (0, 0, 0.2), 0.34, 0.4, 'vinho', lados=16, chanfro=0.03)
    m.cilindro('tampa', (0, 0, 0.41), 0.3, 0.03, 'mostarda', lados=16)
    return m.agrupar('puff')


def folhagem(centro, raio, n):
    cx, cy, cz = centro
    m.icosfera('copa', (cx, cy, cz), raio * 0.62, 'folha', nivel=2)
    for i in range(n * 3):
        a = i / (n * 3) * math.tau + aleatorio.random() * 0.4
        incl = 0.35 + aleatorio.random() * 0.6
        comprimento = raio * aleatorio.uniform(0.75, 1.05)
        x = cx + math.cos(a) * raio * 0.45
        y = cy + math.sin(a) * raio * 0.45
        z = cz + aleatorio.uniform(-0.15, 0.3) * raio
        folha = m.esfera(f'folha{i}', (x, y, z), comprimento * 0.5, 'folha' if i % 3 else 'folhaClara', escala=(0.42, 1, 0.12), segmentos=8, aneis=5)
        folha.rotation_euler = (incl, 0, a - math.pi / 2)

def planta():
    m.torno('vaso', [(0.15, 0), (0.19, 0.32), (0.21, 0.34), (0.21, 0.37), (0, 0.37)], 'vaso')
    m.cilindro('terra', (0, 0, 0.36), 0.18, 0.02, 'madeiraEscura')
    folhagem((0, 0, 0.6), 0.24, 5)
    return m.agrupar('planta')


def planta_grande():
    m.torno('vaso', [(0.22, 0), (0.27, 0.42), (0.3, 0.45), (0.3, 0.48), (0, 0.48)], 'branco')
    m.cilindro('tronco', (0, 0, 0.75), 0.035, 0.6, 'madeiraEscura')
    folhagem((0, 0, 1.15), 0.34, 6)
    folhagem((0.08, -0.04, 1.5), 0.24, 4)
    return m.agrupar('planta_grande')


def estante():
    altura = 1.8
    for sx in (-1, 1):
        m.caixa('lateral', (sx * 0.78, 0, altura / 2), (0.04, 0.42, altura), 'madeira')
    m.caixa('fundo', (0, 0.19, altura / 2), (1.56, 0.03, altura), 'madeiraEscura')
    cores = ['livroA', 'livroB', 'livroC', 'livroD']
    for k, z in enumerate((0.04, 0.42, 0.8, 1.18, 1.56, 1.78)):
        m.caixa('prateleira', (0, 0, z), (1.56, 0.4, 0.03), 'madeira')
        if z > 1.7:
            continue
        x = -0.72
        while x < 0.62:
            largura = aleatorio.uniform(0.05, 0.09)
            altura_livro = aleatorio.uniform(0.22, 0.32)
            if aleatorio.random() < 0.85:
                m.caixa('livro', (x + largura / 2, 0.02, z + 0.015 + altura_livro / 2), (largura, 0.26, altura_livro), cores[aleatorio.randrange(4)], chanfro=0)
            x += largura + 0.01
    return m.agrupar('estante')


def lousa():
    for sx in (-1, 1):
        m.cilindro('perna', (sx * 0.98, 0.08, 0.8), 0.025, 1.6, 'metal')
        m.caixa('pe', (sx * 0.98, 0.08, 0.02), (0.06, 0.28, 0.04), 'metal')
    m.caixa('moldura', (0, 0.09, 1.3), (2.06, 0.05, 1.16), 'metalClaro')
    m.caixa('quadro', (0, 0.065, 1.3), (1.98, 0.01, 1.08), 'branco', chanfro=0)
    m.caixa('bandeja', (0, 0.03, 0.74), (1.6, 0.1, 0.025), 'metalClaro')
    for i, (x, z, w, mat) in enumerate(((-0.6, 1.55, 0.5, 'azul'), (-0.45, 1.4, 0.3, 'azul'), (0.3, 1.5, 0.6, 'vermelho'), (0.4, 1.2, 0.4, 'verde'), (-0.3, 1.1, 0.7, 'preto'))):
        m.caixa(f'rabisco{i}', (x, 0.058, z), (w, 0.004, 0.03), mat, chanfro=0)
    m.caixa('marcador', (0.3, 0.0, 0.76), (0.12, 0.02, 0.02), 'vermelho', chanfro=0)
    return m.agrupar('lousa')


def jukebox():
    m.caixa('corpo', (0, 0, 0.55), (0.9, 0.56, 1.1), 'vinho', chanfro=0.03)
    m.cilindro('arco', (0, 0, 1.1), 0.45, 0.56, 'vinho', lados=20, rot=(math.pi / 2, 0, 0))
    m.cilindro('arcoLuz', (0, -0.04, 1.1), 0.38, 0.5, 'luz', lados=20, rot=(math.pi / 2, 0, 0))
    m.caixa('painel', (0, -0.285, 0.75), (0.6, 0.02, 0.4), 'preto')
    for i in range(5):
        m.caixa('tecla', (-0.24 + i * 0.12, -0.3, 0.62), (0.08, 0.02, 0.05), 'mostarda', chanfro=0)
    m.caixa('grade', (0, -0.285, 0.3), (0.6, 0.02, 0.3), 'madeiraEscura')
    for i in range(4):
        m.caixa('fresta', (0, -0.3, 0.2 + i * 0.065), (0.52, 0.01, 0.02), 'preto', chanfro=0)
    return m.agrupar('jukebox')


def balcao():
    m.caixa('frente', (0, -0.34, 0.5), (2.6, 0.12, 1.0), 'madeira', chanfro=0.02)
    for i in range(6):
        x = -1.1 + i * 0.44
        m.caixa(f'ripa{i}', (x, -0.405, 0.48), (0.36, 0.012, 0.86), 'madeiraEscura' if i % 2 else 'madeira', chanfro=0.004)
    m.caixa('faixa', (0, -0.41, 0.93), (2.6, 0.012, 0.08), 'mostarda', chanfro=0)
    m.caixa('tampo', (0, -0.3, 1.04), (2.7, 0.32, 0.05), 'branco', chanfro=0.015)
    m.caixa('mesaInterna', (0, 0.05, 0.72), (2.5, 0.6, 0.04), 'madeiraEscura')
    for sx in (-1, 1):
        m.caixa('lateral', (sx * 1.28, 0, 0.5), (0.05, 0.8, 1.0), 'madeira')
    m.caixa('monitor', (0.5, 0.15, 0.95), (0.5, 0.04, 0.32), 'preto')
    m.caixa('tela', (0.5, 0.128, 0.95), (0.45, 0.006, 0.27), 'tela', chanfro=0)
    m.cilindro('sino', (-0.8, -0.3, 1.09), 0.05, 0.05, 'mostarda', raio_topo=0.02)
    m.torno('vasinho', [(0.06, 1.065), (0.07, 1.16), (0, 1.16)], 'vaso', centro=(0.9, -0.3, 0), lados=10)
    m.icosfera('flor', (0.9, -0.3, 1.24), 0.08, 'florRosa')
    m.caixa('folhetos', (-0.3, -0.3, 1.075), (0.22, 0.14, 0.02), 'papelB', chanfro=0.003)
    return m.agrupar('balcao')

def geladeira():
    m.caixa('corpo', (0, 0, 0.9), (0.78, 0.68, 1.8), 'branco', chanfro=0.03)
    m.caixa('divisao', (0, -0.342, 1.25), (0.76, 0.01, 0.02), 'metalClaro', chanfro=0)
    for z in (1.5, 0.9):
        m.caixa('puxador', (0.3, -0.36, z), (0.03, 0.03, 0.3), 'metal')
    m.caixa('ima', (-0.15, -0.345, 1.0), (0.1, 0.01, 0.1), 'vermelho', chanfro=0)
    m.caixa('ima2', (0.02, -0.345, 0.85), (0.08, 0.01, 0.12), 'azul', chanfro=0)
    return m.agrupar('geladeira')


def bebedouro():
    m.caixa('corpo', (0, 0, 0.5), (0.4, 0.4, 1.0), 'branco', chanfro=0.03)
    m.caixa('bica', (0, -0.21, 0.78), (0.12, 0.04, 0.08), 'metal')
    m.cilindro('galao', (0, 0, 1.22), 0.17, 0.42, 'agua', lados=14)
    m.cilindro('tampa', (0, 0, 1.45), 0.06, 0.05, 'azul')
    return m.agrupar('bebedouro')


def rack_servidor():
    m.caixa('corpo', (0, 0, 1.0), (0.68, 0.98, 2.0), 'preto', chanfro=0.02)
    for linha in range(8):
        z = 0.3 + linha * 0.2
        m.caixa('gaveta', (0, -0.495, z), (0.6, 0.01, 0.15), 'metal', chanfro=0)
        for i in range(3):
            m.caixa('led', (0.18 + i * 0.05, -0.502, z + 0.03), (0.025, 0.006, 0.025), 'ledVerde' if (linha + i) % 3 else 'luz', chanfro=0)
    return m.agrupar('rack_servidor')


def luminaria():
    m.cilindro('base', (0, 0, 0.02), 0.16, 0.04, 'metal', lados=14)
    m.cilindro('haste', (0, 0, 0.8), 0.018, 1.56, 'metal')
    m.cilindro('cupula', (0, 0, 1.55), 0.2, 0.26, 'creme', raio_topo=0.12, lados=14)
    m.cilindro('lampada', (0, 0, 1.45), 0.08, 0.06, 'luz', lados=10)
    return m.agrupar('luminaria')


def tapete():
    m.caixa('tapete', (0, 0, 0.008), (3.0, 2.0, 0.016), 'azul', chanfro=0)
    m.caixa('miolo', (0, 0, 0.012), (2.6, 1.6, 0.016), 'creme', chanfro=0)
    m.caixa('centro', (0, 0, 0.016), (2.2, 1.2, 0.016), 'azul', chanfro=0)
    return m.agrupar('tapete')


def tapete_redondo():
    m.cilindro('tapete', (0, 0, 0.008), 1.1, 0.016, 'mostarda', lados=28)
    m.cilindro('miolo', (0, 0, 0.012), 0.8, 0.016, 'creme', lados=28)
    return m.agrupar('tapete_redondo')



def arvore():
    m.cilindro('tronco', (0, 0, 0.7), 0.13, 1.4, 'tronco', lados=10, raio_topo=0.09)
    for i, a in enumerate((0.4, 2.4, 4.3)):
        m.cilindro(f'galho{i}', (math.cos(a) * 0.18, math.sin(a) * 0.18, 1.35), 0.05, 0.6, 'tronco', lados=6, rot=(math.sin(a) * 0.7, -math.cos(a) * 0.7, 0))
    for i, (x, y, z, r) in enumerate(((0, 0, 1.75, 0.7), (0.4, 0.15, 1.6, 0.5), (-0.38, -0.1, 1.62, 0.52), (0.1, -0.35, 1.55, 0.45), (0.05, 0.1, 2.15, 0.5))):
        m.icosfera(f'copa{i}', (x, y, z), r, 'folha' if i % 2 else 'folhaClara', nivel=2)
    for i in range(5):
        a = i / 5 * math.tau
        m.icosfera(f'raiz{i}', (math.cos(a) * 0.14, math.sin(a) * 0.14, 0.05), 0.07, 'tronco', escala=(1.4, 0.7, 0.6))
    return m.agrupar('arvore')

def arvore_pinheiro():
    m.cilindro('tronco', (0, 0, 0.3), 0.1, 0.6, 'tronco', lados=8)
    for i, (z, r) in enumerate(((0.9, 0.7), (1.45, 0.55), (1.95, 0.38))):
        m.cilindro(f'copa{i}', (0, 0, z), r, 0.75, 'pinheiro', lados=9, raio_topo=0.02)
    return m.agrupar('arvore_pinheiro')


def arbusto():
    for i, (x, y, z, r) in enumerate(((0, 0, 0.3, 0.32), (0.22, 0.08, 0.24, 0.24), (-0.2, -0.06, 0.25, 0.25), (0.05, -0.2, 0.22, 0.2))):
        m.icosfera(f'tufo{i}', (x, y, z), r, 'folha' if i % 2 else 'folhaClara', nivel=2)
    for i in range(4):
        a = i * 1.7
        m.icosfera(f'florzinha{i}', (math.cos(a) * 0.25, math.sin(a) * 0.25, 0.42), 0.04, 'florRosa' if i % 2 else 'branco')
    return m.agrupar('arbusto')

def canteiro():
    m.caixa('borda', (0, 0, 0.1), (1.8, 0.8, 0.2), 'madeiraEscura')
    m.caixa('terra', (0, 0, 0.21), (1.7, 0.7, 0.03), 'terra', chanfro=0)
    cores = ['florRosa', 'florAmarela', 'florRoxa']
    for i in range(10):
        x = -0.72 + (i % 5) * 0.36
        y = -0.17 if i < 5 else 0.17
        m.cilindro(f'caule{i}', (x, y, 0.32), 0.012, 0.2, 'folha', lados=5)
        m.icosfera(f'flor{i}', (x, y, 0.44), 0.07, cores[i % 3])
    return m.agrupar('canteiro')


def banco_jardim():
    m.caixa('assento', (0, 0, 0.45), (1.6, 0.45, 0.06), 'madeira', chanfro=0.01)
    m.caixa('encosto', (0, 0.2, 0.75), (1.6, 0.06, 0.35), 'madeira', chanfro=0.01)
    for sx in (-1, 1):
        m.caixa('pe', (sx * 0.7, 0, 0.22), (0.06, 0.42, 0.44), 'metal')
        m.caixa('apoio', (sx * 0.7, 0.18, 0.6), (0.06, 0.06, 0.3), 'metal')
    return m.agrupar('banco_jardim')


def mesa_picnic():
    m.caixa('tampo', (0, 0, 0.74), (1.8, 0.8, 0.06), 'madeira', chanfro=0.01)
    for sy in (-1, 1):
        m.caixa('banco', (0, sy * 0.68, 0.44), (1.8, 0.3, 0.05), 'madeira', chanfro=0.01)
    for sx in (-1, 1):
        m.caixa('cavalete', (sx * 0.7, 0, 0.37), (0.08, 1.5, 0.06), 'madeiraEscura', rot=(0.0, 0, 0))
        m.caixa('perna', (sx * 0.7, 0, 0.37), (0.08, 0.08, 0.74), 'madeiraEscura')
    return m.agrupar('mesa_picnic')


def fonte():
    m.torno('bacia', [(1.2, 0), (1.25, 0.35), (1.1, 0.4), (1.05, 0.12), (0, 0.12)], 'pedraClara', lados=24)
    m.cilindro('agua', (0, 0, 0.3), 1.05, 0.02, 'aguaFonte', lados=24)
    m.cilindro('coluna', (0, 0, 0.75), 0.15, 0.9, 'pedraClara', lados=12)
    m.cilindro('pratoAlto', (0, 0, 1.2), 0.5, 0.1, 'pedraClara', lados=16, raio_topo=0.35)
    m.cilindro('aguaAlta', (0, 0, 1.26), 0.33, 0.02, 'aguaFonte', lados=16)
    m.icosfera('jato', (0, 0, 1.45), 0.12, 'aguaFonte')
    return m.agrupar('fonte')


def poste():
    m.cilindro('base', (0, 0, 0.1), 0.12, 0.2, 'preto', lados=8)
    m.cilindro('haste', (0, 0, 1.3), 0.04, 2.4, 'preto', lados=8)
    m.caixa('lanterna', (0, 0, 2.55), (0.22, 0.22, 0.3), 'luz', chanfro=0.02)
    m.cilindro('chapeu', (0, 0, 2.75), 0.2, 0.12, 'preto', lados=4, raio_topo=0.02, rot=(0, 0, math.pi / 4))
    return m.agrupar('poste')


def pedra():
    m.icosfera('pedra1', (0, 0, 0.18), 0.32, 'pedra', escala=(1.2, 1, 0.65))
    m.icosfera('pedra2', (0.3, 0.15, 0.1), 0.18, 'pedraClara', escala=(1, 1, 0.7))
    return m.agrupar('pedra')


def tv():
    m.caixa('rack', (0, 0.05, 0.25), (1.6, 0.4, 0.5), 'madeiraEscura', chanfro=0.02)
    m.caixa('pe', (0, 0.1, 0.6), (0.3, 0.15, 0.2), 'preto')
    m.caixa('tv', (0, 0.12, 1.15), (1.5, 0.06, 0.88), 'preto', chanfro=0.01)
    m.caixa('tela', (0, 0.088, 1.15), (1.4, 0.006, 0.78), 'tela', chanfro=0)
    m.caixa('console', (0.5, -0.05, 0.52), (0.3, 0.2, 0.05), 'branco')
    return m.agrupar('tv')


def mesa_pingpong():
    m.caixa('tampo', (0, 0, 0.74), (2.6, 1.45, 0.05), 'azulMesa', chanfro=0.01)
    m.caixa('linha', (0, 0, 0.768), (2.6, 0.02, 0.004), 'branco', chanfro=0)
    m.caixa('rede', (0, 0, 0.85), (0.02, 1.55, 0.16), 'branco', chanfro=0)
    pernas(1.1, 0.6, 0.72, raio=0.035)
    m.caixa('raquete', (0.6, -0.3, 0.78), (0.15, 0.12, 0.015), 'vermelho', chanfro=0)
    m.esfera('bola', (-0.4, 0.2, 0.79), 0.025, 'branco', segmentos=6, aneis=4)
    return m.agrupar('mesa_pingpong')


def arcade():
    m.caixa('corpo', (0, 0, 0.85), (0.7, 0.7, 1.7), 'arcade', chanfro=0.02)
    m.caixa('tela', (0, -0.33, 1.25), (0.52, 0.04, 0.42), 'telaJogo', chanfro=0, rot=(0.25, 0, 0))
    m.caixa('painel', (0, -0.42, 0.95), (0.62, 0.22, 0.06), 'preto', rot=(-0.3, 0, 0))
    m.cilindro('alavanca', (-0.15, -0.44, 1.02), 0.02, 0.1, 'vermelho', lados=6)
    for i in range(3):
        m.cilindro(f'botao{i}', (0.05 + i * 0.08, -0.44, 0.99), 0.025, 0.03, 'florAmarela', lados=8)
    m.caixa('letreiro', (0, -0.31, 1.62), (0.66, 0.04, 0.12), 'luz', chanfro=0)
    return m.agrupar('arcade')


def sinuca():
    m.caixa('mesa', (0, 0, 0.7), (2.3, 1.3, 0.12), 'madeiraEscura', chanfro=0.03)
    m.caixa('feltro', (0, 0, 0.765), (2.1, 1.1, 0.01), 'verdeMesa', chanfro=0)
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.caixa('pe', (sx * 1.0, sy * 0.5, 0.32), (0.14, 0.14, 0.64), 'madeiraEscura')
    for i, cor in enumerate(('vermelho', 'florAmarela', 'azul', 'branco', 'preto')):
        m.esfera(f'bola{i}', (-0.4 + i * 0.12, (i % 2) * 0.1, 0.79), 0.03, cor, segmentos=6, aneis=4)
    m.cilindro('taco', (0.2, -0.45, 0.8), 0.012, 1.4, 'madeira', rot=(0, math.pi / 2, 0.2), lados=6)
    return m.agrupar('sinuca')


def impressora():
    m.caixa('movel', (0, 0, 0.35), (0.7, 0.55, 0.7), 'madeira', chanfro=0.02)
    m.caixa('impressora', (0, 0, 0.85), (0.6, 0.48, 0.3), 'branco', chanfro=0.02)
    m.caixa('bandeja', (0, -0.28, 0.78), (0.4, 0.1, 0.02), 'metalClaro', chanfro=0)
    m.caixa('papel', (0, -0.27, 0.8), (0.3, 0.08, 0.01), 'creme', chanfro=0)
    m.caixa('painel', (0.2, -0.2, 1.0), (0.12, 0.08, 0.02), 'tela', chanfro=0)
    return m.agrupar('impressora')


def armario():
    m.caixa('corpo', (0, 0, 0.95), (1.6, 0.5, 1.9), 'metalClaro', chanfro=0.02)
    for i in range(4):
        x = -0.6 + i * 0.4
        m.caixa(f'porta{i}', (x, -0.255, 0.95), (0.36, 0.01, 1.8), 'azul' if i % 2 else 'mostarda', chanfro=0)
        m.caixa(f'puxador{i}', (x + 0.12, -0.265, 1.0), (0.02, 0.02, 0.12), 'metal', chanfro=0)
    return m.agrupar('armario')


def divisoria():
    m.caixa('painel', (0, 0, 0.6), (1.8, 0.08, 1.2), 'verde', chanfro=0.02)
    m.caixa('borda', (0, 0, 1.21), (1.82, 0.1, 0.04), 'madeira', chanfro=0.005)
    for sx in (-1, 1):
        m.caixa('pe', (sx * 0.8, 0, 0.03), (0.08, 0.35, 0.06), 'metal')
    return m.agrupar('divisoria')


def notebook():
    m.caixa('base', (0, -0.05, 0.765), (0.34, 0.24, 0.018), 'metalClaro', chanfro=0.004)
    m.caixa('tampa', (0, 0.07, 0.88), (0.34, 0.018, 0.22), 'metalClaro', chanfro=0.004, rot=(-0.25, 0, 0))
    m.caixa('tela', (0, 0.06, 0.885), (0.3, 0.004, 0.18), 'tela', chanfro=0, rot=(-0.25, 0, 0))
    return m.agrupar('notebook')


def planta_mesa():
    m.torno('vaso', [(0.06, 0.75), (0.075, 0.86), (0, 0.86)], 'vaso', lados=10)
    folhagem((0, 0, 0.93), 0.09, 4)
    return m.agrupar('planta_mesa')


def pilha_livros():
    for i, (cor, w) in enumerate((('livroA', 0.24), ('livroC', 0.22), ('livroB', 0.2))):
        m.caixa(f'livro{i}', (0.01 * i, 0, 0.765 + i * 0.035), (w, 0.17, 0.033), cor, chanfro=0.004, rot=(0, 0, 0.1 * i))
    return m.agrupar('pilha_livros')


def quadro(nome, cores):
    m.caixa('moldura', (0, 0, 0.75), (0.7, 0.04, 0.5), 'madeiraEscura', chanfro=0.01)
    m.caixa('tela', (0, -0.022, 0.75), (0.6, 0.006, 0.4), 'moldura', chanfro=0)
    for i, cor in enumerate(cores):
        m.caixa(f'mancha{i}', (-0.15 + i * 0.15, -0.026, 0.72 + (i % 2) * 0.08), (0.16, 0.004, 0.2 - i * 0.03), cor, chanfro=0)
    return m.agrupar(nome)


def relogio():
    m.cilindro('aro', (0, 0, 0.85), 0.17, 0.05, 'preto', lados=20, rot=(math.pi / 2, 0, 0))
    m.cilindro('mostrador', (0, -0.027, 0.85), 0.15, 0.006, 'moldura', lados=20, rot=(math.pi / 2, 0, 0))
    m.caixa('ponteiroH', (0.03, -0.032, 0.87), (0.07, 0.004, 0.015), 'preto', chanfro=0, rot=(0, 0.6, 0))
    m.caixa('ponteiroM', (-0.01, -0.033, 0.9), (0.012, 0.004, 0.11), 'vermelho', chanfro=0)
    return m.agrupar('relogio')


def janela():
    m.caixa('moldura', (0, 0, 0.72), (1.2, 0.08, 0.62), 'moldura', chanfro=0.01)
    m.caixa('vidro', (0, -0.045, 0.72), (1.08, 0.006, 0.52), 'vidro', chanfro=0)
    m.caixa('travessa', (0, -0.05, 0.72), (0.04, 0.008, 0.52), 'moldura', chanfro=0)
    m.caixa('peitoril', (0, -0.07, 0.4), (1.3, 0.14, 0.04), 'moldura', chanfro=0.005)
    return m.agrupar('janela')


def quadro_avisos():
    m.caixa('moldura', (0, 0, 0.75), (1.1, 0.04, 0.6), 'madeira', chanfro=0.01)
    m.caixa('cortica', (0, -0.022, 0.75), (1.0, 0.006, 0.5), 'cortica', chanfro=0)
    for i, (x, z, cor) in enumerate(((-0.3, 0.85, 'papelA'), (0.05, 0.8, 'papelB'), (0.32, 0.88, 'papelC'), (-0.15, 0.62, 'papelC'), (0.25, 0.62, 'papelA'))):
        m.caixa(f'papel{i}', (x, -0.027, z), (0.18, 0.004, 0.18), cor, chanfro=0, rot=(0, (i % 3 - 1) * 0.08, 0))
    return m.agrupar('quadro_avisos')


def lixeira():
    m.torno('cesto', [(0.13, 0), (0.16, 0.38), (0.15, 0.38), (0.12, 0.02), (0, 0.02)], 'metal', lados=12)
    return m.agrupar('lixeira')


def cabideiro():
    m.cilindro('base', (0, 0, 0.03), 0.2, 0.06, 'madeiraEscura', lados=10)
    m.cilindro('haste', (0, 0, 0.85), 0.03, 1.6, 'madeiraEscura', lados=8)
    for i in range(4):
        a = i * math.pi / 2
        m.cilindro(f'gancho{i}', (math.cos(a) * 0.1, math.sin(a) * 0.1, 1.55), 0.015, 0.2, 'madeiraEscura', lados=6, rot=(math.sin(a) * 0.9, -math.cos(a) * 0.9, 0))
    m.caixa('casaco', (0.08, -0.08, 1.3), (0.2, 0.08, 0.45), 'vermelho', chanfro=0.03)
    return m.agrupar('cabideiro')


def vaso_alto():
    m.torno('vaso', [(0.17, 0), (0.2, 0.5), (0, 0.5)], 'branco', lados=12)
    m.cilindro('cacto', (0, 0, 0.95), 0.1, 0.9, 'folha', lados=8)
    m.cilindro('braco1', (0.13, 0, 1.05), 0.06, 0.3, 'folha', lados=8)
    m.cilindro('braco2', (-0.12, 0, 0.9), 0.055, 0.25, 'folha', lados=8)
    return m.agrupar('vaso_alto')


def tapete_grande():
    m.caixa('tapete', (0, 0, 0.006), (5.2, 3.6, 0.012), 'tapeteGrande', chanfro=0)
    m.caixa('faixa', (0, 0, 0.009), (4.8, 3.2, 0.012), 'tapeteBorda', chanfro=0)
    m.caixa('miolo', (0, 0, 0.012), (4.6, 3.0, 0.012), 'tapeteGrande', chanfro=0)
    return m.agrupar('tapete_grande')


def tufo():
    for i in range(7):
        a = i / 7 * math.tau
        m.cilindro(f'folha{i}', (math.cos(a) * 0.05, math.sin(a) * 0.05, 0.1), 0.025, 0.22, 'folhaClara' if i % 2 else 'folha', lados=4, raio_topo=0.0, rot=(math.sin(a) * 0.35, -math.cos(a) * 0.35, 0))
    return m.agrupar('tufo')


def flores():
    cores = ['florRosa', 'florAmarela', 'florRoxa', 'branco']
    for i in range(5):
        a = i / 5 * math.tau + 0.4
        x, y = math.cos(a) * 0.12, math.sin(a) * 0.12
        m.cilindro(f'caule{i}', (x, y, 0.1), 0.01, 0.2, 'folha', lados=4)
        m.icosfera(f'flor{i}', (x, y, 0.21), 0.05, cores[i % 4])
    return m.agrupar('flores')

PECAS = [
    mesa_trabalho, cadeira, mesa_reuniao,
    lambda: estofado(2.0, 0.85, 'verde', 'sofa', 2),
    lambda: estofado(0.9, 0.9, 'mostarda', 'poltrona', 1),
    mesa_centro, mesa_redonda, banqueta, puff, planta, planta_grande, estante, lousa, jukebox,
    balcao, geladeira, bebedouro, rack_servidor, luminaria, tapete, tapete_redondo,
    arvore, arvore_pinheiro, arbusto, canteiro, banco_jardim, mesa_picnic, fonte, poste, pedra,
    tv, mesa_pingpong, arcade, sinuca, impressora, armario, divisoria,
    notebook, planta_mesa, pilha_livros,
    lambda: quadro('quadro_a', ('quadroA', 'quadroC', 'quadroB')),
    lambda: quadro('quadro_b', ('quadroB', 'livroD', 'quadroC')),
    relogio, janela, quadro_avisos, lixeira, cabideiro, vaso_alto, tapete_grande, tufo, flores,
]

if __name__ == '__main__':
    saida = comum.argumentos()
    comum.limpar()
    total = 0
    for construir in PECAS:
        obj = construir()
        total += comum.triangulos(obj)
        print(f'PECA {obj.name} {comum.triangulos(obj)}')
    print(f'TRIANGULOS {total}')
    comum.exportar(saida)
