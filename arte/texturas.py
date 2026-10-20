import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

TAM = 512
SAIDA = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'kairos-ui', 'public', 'texturas')


def ruido_periodico(celulas, semente):
    rng = np.random.default_rng(semente)
    grade = rng.random((celulas, celulas))
    eixo = np.arange(TAM) * celulas / TAM
    i0 = np.floor(eixo).astype(int)
    f = eixo - i0
    u = f * f * (3 - 2 * f)
    i1 = (i0 + 1) % celulas
    a = grade[np.ix_(i0, i0)]
    b = grade[np.ix_(i0, i1)]
    c = grade[np.ix_(i1, i0)]
    d = grade[np.ix_(i1, i1)]
    uy = u[:, None]
    ux = u[None, :]
    return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy


def fbm(semente, base=4, oitavas=5):
    total = np.zeros((TAM, TAM))
    amplitude = 0.5
    soma = 0
    for k in range(oitavas):
        total += ruido_periodico(base * 2 ** k, semente + k * 31) * amplitude
        soma += amplitude
        amplitude *= 0.5
    return total / soma


def voronoi_periodico(pontos, semente):
    rng = np.random.default_rng(semente)
    sementes = rng.random((pontos, 2)) * TAM
    ys, xs = np.mgrid[0:TAM, 0:TAM]
    d1 = np.full((TAM, TAM), 1e9)
    d2 = np.full((TAM, TAM), 1e9)
    ident = np.zeros((TAM, TAM))
    for k, (sx, sy) in enumerate(sementes):
        dx = np.abs(xs - sx)
        dy = np.abs(ys - sy)
        dx = np.minimum(dx, TAM - dx)
        dy = np.minimum(dy, TAM - dy)
        d = np.sqrt(dx * dx + dy * dy)
        menor = d < d1
        d2 = np.where(menor, d1, np.minimum(d2, d))
        ident = np.where(menor, k, ident)
        d1 = np.where(menor, d, d1)
    return d1, d2 - d1, ident / pontos


def desenhar_envolvido(desenho_func):
    grande = Image.new('L', (TAM * 3, TAM * 3), 0)
    d = ImageDraw.Draw(grande)
    for ox in (0, TAM, 2 * TAM):
        for oy in (0, TAM, 2 * TAM):
            desenho_func(d, ox, oy)
    return np.asarray(grande.crop((TAM, TAM, 2 * TAM, 2 * TAM)), dtype=float) / 255


def tracos(semente, quantidade, comprimento, largura, inclinacao):
    rng = random.Random(semente)
    itens = []
    for _ in range(quantidade):
        x, y = rng.random() * TAM, rng.random() * TAM
        a = -math.pi / 2 + (rng.random() - 0.5) * inclinacao
        c = comprimento * (0.5 + rng.random())
        itens.append((x, y, x + math.cos(a) * c, y + math.sin(a) * c, rng.random()))

    def f(d, ox, oy):
        for x, y, x2, y2, v in itens:
            d.line((x + ox, y + oy, x2 + ox, y2 + oy), fill=int(80 + v * 175), width=largura)
    return desenhar_envolvido(f)


def manchas(semente, quantidade, raio):
    rng = random.Random(semente)
    itens = [(rng.random() * TAM, rng.random() * TAM, raio * (0.4 + rng.random()), rng.random()) for _ in range(quantidade)]

    def f(d, ox, oy):
        for x, y, r, v in itens:
            d.ellipse((x + ox - r, y + oy - r * 0.75, x + ox + r, y + oy + r * 0.75), fill=int(60 + v * 195))
    return desenhar_envolvido(f)


def salvar(nome, valores, contraste=2.0):
    media = valores.mean()
    valores = np.clip(0.84 + (valores - media) * contraste, 0.5, 1)
    img = Image.fromarray((valores * 255).astype(np.uint8)).convert('RGB')
    img.save(os.path.join(SAIDA, f'{nome}.jpg'), quality=86)
    print('TEXTURA', nome, float(valores.mean()))


def grama():
    base = 0.72 + fbm(1, 2) * 0.3
    tufos = manchas(2, 90, 26)
    folhas = tracos(3, 260, 42, 7, 0.8)
    claras = tracos(4, 120, 34, 5, 0.6)
    return base * (1 - (tufos > 0) * 0.16) * (1 - (folhas > 0) * 0.14) + (claras > 0) * 0.16


def cascalho():
    base = 0.72 + fbm(11, 3) * 0.25
    pedrinhas = manchas(12, 420, 7)
    sombra = np.asarray(Image.fromarray((pedrinhas * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)), dtype=float) / 255
    return base - sombra * 0.1 + (pedrinhas > 0) * (0.06 + pedrinhas * 0.1)


def pavimento():
    d1, borda, ident = voronoi_periodico(18, 21)
    rejunte = np.clip((borda - 2) / 5, 0, 1)
    rejunte = np.asarray(Image.fromarray((rejunte * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0)), dtype=float) / 255
    laje = 0.78 + (ident - 0.5) * 0.14 + fbm(22, 6) * 0.1
    return laje * (0.62 + 0.38 * rejunte)


def tabuas(semente, colunas, linhas, rejunte, veio):
    rng = np.random.default_rng(semente)
    ys, xs = np.mgrid[0:TAM, 0:TAM]
    largura = TAM / colunas
    coluna = (xs // largura).astype(int)
    deslocamento = rng.random(colunas) * TAM
    comprimento = TAM / linhas
    pos = (ys + deslocamento[coluna]) % TAM
    linha = (pos // comprimento).astype(int)
    tom = rng.random((colunas, linhas + 1))[coluna, linha]
    fx = xs - coluna * largura
    fy = pos - linha * comprimento
    junta = (np.minimum(fx, largura - fx) < rejunte) | (np.minimum(fy, comprimento - fy) < rejunte)
    fibras = ruido_periodico(4, semente + 7)[:, :]
    linhas_veio = 0.5 + 0.5 * np.sin((fy / comprimento * 1.5 + fibras * 1.2 + tom * 9) * math.pi * veio)
    v = 0.8 + (tom - 0.5) * 0.12 + linhas_veio * 0.035 + fbm(semente + 3, 8, 3) * 0.05
    return np.where(junta, v * 0.62, v)


def madeira():
    return tabuas(31, 6, 3, 1.6, 3)


def deck():
    return tabuas(41, 5, 2, 3, 2)


def carpete():
    rng = np.random.default_rng(51)
    fibra = rng.random((TAM, TAM))
    fibra = np.asarray(Image.fromarray((fibra * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8)), dtype=float) / 255
    return 0.8 + (fibra - 0.5) * 0.25 + fbm(52, 3) * 0.12


def ladrilho():
    ys, xs = np.mgrid[0:TAM, 0:TAM]
    lado = TAM / 8
    fx = xs % lado
    fy = ys % lado
    junta = (np.minimum(fx, lado - fx) < 2.2) | (np.minimum(fy, lado - fy) < 2.2)
    rng = np.random.default_rng(61)
    tom = rng.random((8, 8))[(ys // lado).astype(int) % 8, (xs // lado).astype(int) % 8]
    v = 0.86 + (tom - 0.5) * 0.06 + fbm(62, 10, 3) * 0.06
    return np.where(junta, 0.62, v)


def reboco():
    return 0.84 + fbm(71, 8) * 0.14 + (np.random.default_rng(72).random((TAM, TAM)) - 0.5) * 0.05


def gramado():
    ys, xs = np.mgrid[0:TAM, 0:TAM]
    faixas = 0.5 + 0.5 * np.cos((xs / TAM) * math.pi * 4)
    base = 0.86 + (faixas - 0.5) * 0.07 + fbm(91, 4, 4) * 0.06
    folhinhas = tracos(92, 520, 9, 2, 0.5)
    pontos = (np.random.default_rng(93).random((TAM, TAM)) > 0.9985).astype(float)
    pontos = np.asarray(Image.fromarray((pontos * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)), dtype=float) / 255
    return base - (folhinhas > 0) * 0.05 + pontos * 0.14


def variacao():
    return 0.7 + fbm(81, 1, 3) * 0.6


os.makedirs(SAIDA, exist_ok=True)
for nome, f, contraste in (
    ('grama', grama, 0.75), ('gramado', gramado, 1.0), ('cascalho', cascalho, 0.7), ('pavimento', pavimento, 0.8), ('madeira', madeira, 0.85),
    ('deck', deck, 0.85), ('carpete', carpete, 0.6), ('ladrilho', ladrilho, 0.8), ('reboco', reboco, 0.6), ('variacao', variacao, 0.5),
):
    salvar(nome, f(), contraste)
print('FIM')
