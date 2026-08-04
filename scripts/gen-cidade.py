#!/usr/bin/env python3
"""Gera o mundo CIDADE (120x120) e imprime o JSON do mapa no stdout.

Malha irregular de quarteiroes (larguras/alturas variadas) separados por
avenidas de larguras diferentes (uma principal larga, ruas secundarias
estreitas), com 10 predios institucionais — cada um com salas pequenas
mobiliadas e um saguao/salao proprio (area + porta + mobilia densa) — e
6 pracas/jardins com identidade propria e alta densidade de mobiliario.
O prédio dos Correios tem planta em L (quarteirao de formato irregular).
Todo movel tem w/h/hVis lidos de kairos-ui/src/game/furniture/canonico.json
— a pegada de colisao (w x h) e a altura desenhada (w x hVis) vem sempre da
fonte canonica, nunca de numero fixo no gerador. Clima diurno e quente:
paleta terrosa, sem tons roxos ou frios.
"""
import json
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CANONICO_PATH = os.path.join(RAIZ, "kairos-ui/src/game/furniture/canonico.json")
with open(CANONICO_PATH) as f:
    CANONICO = json.load(f)

ORIGEM_PATH = os.path.join(RAIZ, "kairos-ui/src/game/furniture/kenney/origem.json")
with open(ORIGEM_PATH) as f:
    ORIGEM_KENNEY = json.load(f)

TILES_POR_M = 2.0 / 1.70

objetos = []

SOLIDOS = {
    "wall", "desk", "table", "shelf", "servers", "sofa", "chair", "bench",
    "column", "jukebox", "fountain", "tree", "hedge", "board", "lamp",
    "plant", "water",
}

CELL_COLS = [(1, 32), (37, 60), (67, 94), (98, 118)]
CELL_ROWS = [(1, 30), (35, 58), (65, 92), (96, 118)]
AVENUE_V = [(33, 36), (61, 66), (95, 97)]
AVENUE_H = [(31, 34), (59, 64), (93, 95)]
MARGEM = 2

_contadores = {}


def novo_id(kind):
    _contadores[kind] = _contadores.get(kind, 0) + 1
    return f"{kind}-{_contadores[kind]}"


def add(kind, x, y, w, h, **extra):
    o = {"id": novo_id(kind), "kind": kind, "x": x, "y": y, "w": w, "h": h}
    if kind in SOLIDOS:
        o["solid"] = True
    o.update(extra)
    objetos.append(o)


def dims(kind):
    if kind in ORIGEM_KENNEY:
        px_w, px_h = ORIGEM_KENNEY[kind]["px"]
        hv = round(ORIGEM_KENNEY[kind]["alturaM"] * TILES_POR_M, 2)
        return round(hv * (px_w / px_h), 2), CANONICO[kind]["h"], hv
    d = CANONICO[kind]
    return d["w"], d["h"], d["hVis"]


def mob(kind, x, y, **extra):
    w, h, hv = dims(kind)
    if kind in ORIGEM_KENNEY:
        extra.setdefault("arte", "kenney")
    add(kind, round(x, 2), round(y, 2), w, h, hVis=hv, **extra)


def mesa_com_cadeiras(x, y, n=4, **extra_mesa):
    tw, th, _ = dims("table")
    mob("table", x, y, **extra_mesa)
    cw, ch, _ = dims("chair")
    vagas = [
        (x + (tw - cw) / 2, y - ch - 0.2),
        (x + (tw - cw) / 2, y + th + 0.2),
        (x - cw - 0.2, y + (th - ch) / 2),
        (x + tw + 0.2, y + (th - ch) / 2),
    ]
    for vx, vy in vagas[:n]:
        mob("chair", vx, vy)


def balcao_com_cadeira(x, y, **extra_desk):
    dw, dh, _ = dims("desk")
    mob("desk", x, y, **extra_desk)
    cw, ch, _ = dims("chair")
    mob("chair", x + (dw - cw) / 2, y + dh + 0.2)


def fileira(kind, x, y, n, passo=None, vertical=False, **extra):
    w, h, _ = dims(kind)
    p = passo if passo else ((h if vertical else w) + 0.3)
    for i in range(n):
        if vertical:
            mob(kind, x, y + i * p, **extra)
        else:
            mob(kind, x + i * p, y, **extra)


def envelope_de_celula(col, row, margem=MARGEM):
    cx0, cx1 = CELL_COLS[col]
    cy0, cy1 = CELL_ROWS[row]
    ox = cx0 + margem
    oy = cy0 + margem
    largura = (cx1 - cx0 + 1) - 2 * margem
    altura = (cy1 - cy0 + 1) - 2 * margem
    return ox, oy, largura, altura


def bounds(col, row):
    cx0, cx1 = CELL_COLS[col]
    cy0, cy1 = CELL_ROWS[row]
    return cx0, cy0, cx1, cy1


def sala(ox, oy, largura, altura, area_id, nome, lado="sul", cor=None):
    porta_x = ox + largura // 2 - 2
    meio_y = oy + altura // 2
    if lado == "sul":
        add("wall", ox, oy, largura, 1, solid=True)
        add("wall", ox, oy + altura - 1, porta_x - ox, 1, solid=True)
        add("wall", porta_x + 3, oy + altura - 1, ox + largura - (porta_x + 3), 1, solid=True)
        add("door", porta_x, oy + altura - 1, 3, 1)
    else:
        add("wall", ox, oy + altura - 1, largura, 1, solid=True)
        add("wall", ox, oy, porta_x - ox, 1, solid=True)
        add("wall", porta_x + 3, oy, ox + largura - (porta_x + 3), 1, solid=True)
        add("door", porta_x, oy, 3, 1)
    # vao aberto no meio de cada parede lateral — sala deixa de ser cubiculo
    add("wall", ox, oy + 1, 1, meio_y - oy - 1, solid=True)
    add("wall", ox, meio_y + 2, 1, oy + altura - meio_y - 3, solid=True)
    add("door", ox, meio_y, 1, 2)
    add("wall", ox + largura - 1, oy + 1, 1, meio_y - oy - 1, solid=True)
    add("wall", ox + largura - 1, meio_y + 2, 1, oy + altura - meio_y - 3, solid=True)
    add("door", ox + largura - 1, meio_y, 1, 2)
    add("area", ox, oy, largura, altura, id=area_id, name=nome)
    if cor:
        add("panel", ox + 1, oy + 1, largura - 2, altura - 2, color=cor)


def contorno(ox, oy, largura, altura, lado, cor):
    porta_x = ox + largura // 2 - 1
    if lado == "sul":
        add("wall", ox, oy, largura, 1, solid=True)
        add("wall", ox, oy + altura - 1, porta_x - ox, 1, solid=True)
        add("wall", porta_x + 2, oy + altura - 1, ox + largura - (porta_x + 2), 1, solid=True)
        add("door", porta_x, oy + altura - 1, 2, 1)
    else:
        add("wall", ox, oy + altura - 1, largura, 1, solid=True)
        add("wall", ox, oy, porta_x - ox, 1, solid=True)
        add("wall", porta_x + 2, oy, ox + largura - (porta_x + 2), 1, solid=True)
        add("door", porta_x, oy, 2, 1)
    add("wall", ox, oy + 1, 1, altura - 2, solid=True)
    add("wall", ox + largura - 1, oy + 1, 1, altura - 2, solid=True)
    add("panel", ox + 1, oy + 1, largura - 2, altura - 2, color=cor)


def conectar_avenida(row, porta_x, oy, altura, lado):
    if lado == "sul":
        fundo = oy + altura - 1
        av_inicio = AVENUE_H[row][0]
        h = av_inicio - (fundo + 1)
        if h > 0:
            add("path", porta_x, fundo + 1, 2, h)
    else:
        av_fim = AVENUE_H[row - 1][1]
        y0 = av_fim + 1
        h = oy - y0
        if h > 0:
            add("path", porta_x, y0, 2, h)


def predio_uma_sala(col, row, area_id, nome, cor, mob_fn):
    ox, oy, largura, altura = envelope_de_celula(col, row)
    lado = "sul" if row < 3 else "norte"
    sala(ox, oy, largura, altura, area_id, nome, lado, cor)
    mob_fn(ox, oy, largura, altura)
    porta_x = ox + largura // 2 - 1
    conectar_avenida(row, porta_x, oy, altura, lado)


def predio_duas_salas(col, row, id1, nome1, mob1, id2, nome2, mob2, id_sag, nome_sag, mob_sag, cor):
    ox, oy, largura, altura = envelope_de_celula(col, row)
    lado = "sul" if row < 3 else "norte"
    contorno(ox, oy, largura, altura, lado, cor)
    room_h = altura // 2 - 2
    room_w = (largura - 3) // 2
    r1x = ox + 1
    r2x = ox + 1 + room_w + 1
    if lado == "sul":
        ry = oy + 1
        porta_sala = "sul"
        say0 = ry + room_h
        sah = altura - room_h - 1
    else:
        ry = oy + altura - 1 - room_h
        porta_sala = "norte"
        say0 = oy
        sah = ry - oy
    sala(r1x, ry, room_w, room_h, id1, nome1, porta_sala, cor)
    sala(r2x, ry, room_w, room_h, id2, nome2, porta_sala, cor)
    mob1(r1x, ry, room_w, room_h)
    mob2(r2x, ry, room_w, room_h)
    add("area", ox, say0, largura, sah, id=id_sag, name=nome_sag)
    mob_sag(ox, say0, largura, sah)
    porta_x = ox + largura // 2 - 1
    conectar_avenida(row, porta_x, oy, altura, lado)


def mob_prefeitura_reuniao(rx, ry, rw, rh):
    mesa_com_cadeiras(rx + 5, ry + 4, n=4)
    mob("board", rx + 3.5, ry + 1.1, glow="cyan", name="Pauta da Reunião")
    mob("plant", rx + 1.2, ry + 1.1)
    mob("plant", rx + 9.8, ry + 1.1)
    mob("lamp", rx + 1.2, ry + 8.2)
    mob("lamp", rx + 8.2, ry + 8.2)


def mob_prefeitura_protocolo(rx, ry, rw, rh):
    balcao_com_cadeira(rx + 2, ry + 2.5, name="Balcão de Protocolo", action="Abrir Protocolo", glow="gold")
    balcao_com_cadeira(rx + 7, ry + 2.5)
    fileira("shelf", rx + 1.2, ry + 6.5, 4, passo=1.1)
    mob("lamp", rx + 8.3, ry + 7.5)
    mob("plant", rx + 9.8, ry + 1.3)


def mob_prefeitura_saguao(rx, ry, rw, rh):
    mesa_com_cadeiras(rx + 12, ry + 6, n=4)
    fileira("shelf", rx + 2, ry + 1.3, 3, passo=1.1)
    fileira("shelf", rx + 23, ry + 1.3, 3, passo=1.1)
    mob("bench", rx + 2, ry + 10.5)
    mob("bench", rx + 23, ry + 10.5)
    mob("column", rx + 1.2, ry + 7)
    add("rug", rx + 10, ry + 3, 8, 6, color="rgba(217,164,65,0.15)")


def mob_biblioteca_leitura(rx, ry, rw, rh):
    mesa_com_cadeiras(rx + 2.5, ry + 2.5, n=2)
    mesa_com_cadeiras(rx + 2.5, ry + 6.2, n=2)
    mob("shelf", rx + 1.2, ry + 1.1)
    mob("shelf", rx + 5.5, ry + 1.1)
    mob("lamp", rx + 1.2, ry + 8.6)
    mob("plant", rx + 5.5, ry + 8.6)


def mob_biblioteca_saguao(rx, ry, rw, rh):
    mesa_com_cadeiras(rx + 8, ry + 6, n=4)
    fileira("shelf", rx + 15, ry + 1.3, 3, passo=1.1)
    mob("bench", rx + 2, ry + 10.5)
    mob("column", rx + 1.2, ry + 7)
    mob("plant", rx + 17, ry + 3)


def mob_biblioteca_acervo(rx, ry, rw, rh):
    fileira("shelf", rx + 1.2, ry + 1.3, 4, passo=1.3)
    fileira("shelf", rx + 1.2, ry + 4.3, 4, passo=1.3)
    mesa_com_cadeiras(rx + 2.5, ry + 7.2, n=1, name="Mesa de Consulta")
    mob("lamp", rx + 4.2, ry + 8.3)


def mob_hospital_consultorio(rx, ry, rw, rh):
    balcao_com_cadeira(rx + 2, ry + 2, name="Consultório", action="Consulta", glow="green")
    mob("shelf", rx + 1.2, ry + 5.5, name="Remédios")
    mob("shelf", rx + 2.5, ry + 5.5)
    mob("shelf", rx + 3.8, ry + 5.5)
    mob("plant", rx + 5.8, ry + 2)
    mob("chair", rx + 5.8, ry + 5.5)
    mob("lamp", rx + 4.1, ry + 7.8)


def mob_hospital_recepcao(rx, ry, rw, rh):
    mesa_com_cadeiras(rx + 3, ry + 3, n=2)
    mob("shelf", rx + 1.2, ry + 1.2)
    mob("plant", rx + 5.8, ry + 1.2)
    mob("bench", rx + 1, ry + 6.5)
    mob("chair", rx + 4.5, ry + 6.6)
    mob("lamp", rx + 4, ry + 7.8)


def mob_hospital_saguao(rx, ry, rw, rh):
    mesa_com_cadeiras(rx + 8, ry + 5, n=4)
    fileira("shelf", rx + 15, ry + 1.3, 3, passo=1.1, name="Suprimentos")
    mob("bench", rx + 2, ry + 9.5)
    mob("plant", rx + 17, ry + 9.5)
    mob("column", rx + 1.2, ry + 6)


def mob_banco_atendimento(rx, ry, rw, rh):
    balcao_com_cadeira(rx + 2, ry + 2, name="Guichê do Banco", action="Abrir Conta", glow="gold")
    balcao_com_cadeira(rx + 2, ry + 5)
    fileira("shelf", rx + 7, ry + 1.3, 3, passo=1.1, vertical=True)
    mob("plant", rx + 7, ry + 6)
    mob("lamp", rx + 3, ry + 8.5)


def mob_banco_cofre(rx, ry, rw, rh):
    mob("shelf", rx + 1.2, ry + 1.3, name="Cofre", glow="gold")
    mob("shelf", rx + 2.3, ry + 1.3)
    mob("shelf", rx + 3.4, ry + 1.3)
    mob("shelf", rx + 1.2, ry + 3.6)
    mob("shelf", rx + 2.3, ry + 3.6)
    mob("shelf", rx + 3.4, ry + 3.6)
    mob("lamp", rx + 5.5, ry + 2)
    mob("column", rx + 6.5, ry + 7)


def mob_banco_saguao(rx, ry, rw, rh):
    mesa_com_cadeiras(rx + 10, ry + 6, n=4)
    fileira("shelf", rx + 2, ry + 1.3, 3, passo=1.1)
    fileira("shelf", rx + 19, ry + 1.3, 3, passo=1.1)
    mob("bench", rx + 2, ry + 10.5)
    mob("bench", rx + 19, ry + 10.5)
    mob("column", rx + 1.2, ry + 7)
    mob("column", rx + 21, ry + 7)
    mob("plant", rx + 1.2, ry + 3.5)


def mob_mercado(rx, ry, rw, rh):
    mesa_com_cadeiras(rx + 3, ry + 3, n=2, name="Mercado Municipal", glow="gold")
    mesa_com_cadeiras(rx + 8, ry + 3, n=2)
    mesa_com_cadeiras(rx + 13, ry + 3, n=2)
    fileira("bench", rx + 2, ry + 9, 3, passo=3)
    fileira("shelf", rx + 1.2, ry + 13, 2, passo=1.1)
    mob("plant", rx + 20, ry + 9)
    mob("lamp", rx + 10, ry + 16)
    mob("lamp", rx + 16, ry + 16)


def mob_teatro_palco(rx, ry, rw, rh):
    mob("table", rx + 3, ry + 2, name="Palco", action="Assistir Espetáculo", glow="gold")
    mob("lamp", rx + 1, ry + 1)
    mob("lamp", rx + 6, ry + 1)
    fileira("chair", rx + 1.5, ry + 6, 4, passo=1.3)
    mob("plant", rx + 7.5, ry + 6)


def mob_teatro_coxia(rx, ry, rw, rh):
    mob("shelf", rx + 1.2, ry + 1.3, name="Figurinos")
    mob("shelf", rx + 2.3, ry + 1.3)
    mob("shelf", rx + 3.4, ry + 1.3)
    mob("chair", rx + 6, ry + 2)
    mesa_com_cadeiras(rx + 3, ry + 6, n=2)
    mob("lamp", rx + 6.3, ry + 6.5)


def mob_teatro_saguao(rx, ry, rw, rh):
    mesa_com_cadeiras(rx + 10, ry + 5, n=4)
    fileira("shelf", rx + 19, ry + 1.3, 3, passo=1.1, name="Adereços")
    mob("bench", rx + 2, ry + 9.5)
    mob("bench", rx + 19, ry + 9.5)
    mob("column", rx + 1.2, ry + 6)
    mob("plant", rx + 21, ry + 6)


def mob_estacao_hall(rx, ry, rw, rh):
    fileira("bench", rx + 1, ry + 1.5, 2, passo=2.3)
    fileira("bench", rx + 1, ry + 3.5, 2, passo=2.3)
    mob("plant", rx + 7, ry + 1.5)
    mob("lamp", rx + 6.3, ry + 3.8)
    mob("chair", rx + 1, ry + 5)
    mob("chair", rx + 2, ry + 5)


def mob_estacao_bilheteria(rx, ry, rw, rh):
    balcao_com_cadeira(rx + 2, ry + 2, name="Bilheteria", action="Comprar Passagem", glow="gold")
    mob("shelf", rx + 6.5, ry + 1.3)
    mob("column", rx + 6.8, ry + 3.5)
    mob("plant", rx + 1, ry + 4.5)
    mob("bench", rx + 3.5, ry + 4.5)
    mob("lamp", rx + 1, ry + 1)
    mob("chair", rx + 4.5, ry + 1.3)


def mob_estacao_saguao(rx, ry, rw, rh):
    mesa_com_cadeiras(rx + 10, ry + 5, n=4)
    fileira("bench", rx + 2, ry + 1.5, 3, passo=2.3)
    fileira("shelf", rx + 19, ry + 2, 3, passo=1.1)
    mob("column", rx + 1.2, ry + 7)
    mob("plant", rx + 21, ry + 7)


def mob_escola_sala(rx, ry, rw, rh):
    balcao_com_cadeira(rx + 1.5, ry + 2)
    mob("board", rx + 1, ry + 1, glow="cyan", name="Quadro da Sala")
    mob("plant", rx + 4.5, ry + 2)
    mob("lamp", rx + 3, ry + 5.5)
    mob("bench", rx + 1, ry + 5.5)
    mob("shelf", rx + 4.8, ry + 4.5)
    mob("chair", rx + 1, ry + 4)


def mob_escola_professores(rx, ry, rw, rh):
    mesa_com_cadeiras(rx + 2.5, ry + 3.6, n=2)
    mob("shelf", rx + 4.8, ry + 2.3)
    mob("lamp", rx + 1, ry + 5.8)
    mob("board", rx + 1, ry + 1)
    mob("plant", rx + 4.8, ry + 5.8)
    mob("chair", rx + 5.3, ry + 3.6)


def mob_escola_saguao(rx, ry, rw, rh):
    mesa_com_cadeiras(rx + 7, ry + 5, n=4)
    fileira("shelf", rx + 13, ry + 1.3, 2, passo=1.1)
    mob("bench", rx + 1.2, ry + 8)
    mob("lamp", rx + 1.5, ry + 4)


def mob_delegacia(rx, ry, rw, rh):
    balcao_com_cadeira(rx + 3, ry + 3, name="Mesa de Investigação", action="Abrir Ocorrência", glow="purple")
    balcao_com_cadeira(rx + 3, ry + 7)
    mob("shelf", rx + 9, ry + 3, name="Arquivo")
    mob("shelf", rx + 9, ry + 4.3)
    mob("shelf", rx + 9, ry + 5.6)
    mob("board", rx + 12, ry + 3, glow="cyan", name="Quadro de Pistas")
    mesa_com_cadeiras(rx + 18, ry + 12, n=2)
    mob("lamp", rx + 3, ry + 15)
    mob("lamp", rx + 20, ry + 15)


add("grass", 1, 1, 118, 118)

for y0, y1 in AVENUE_H:
    add("path", 1, y0, 118, y1 - y0 + 1)
for x0, x1 in AVENUE_V:
    add("path", x0, 1, x1 - x0 + 1, 118)

predio_duas_salas(0, 0, "prefeitura-reuniao", "Prefeitura — Sala de Reunião", mob_prefeitura_reuniao,
                   "prefeitura-protocolo", "Prefeitura — Protocolo", mob_prefeitura_protocolo,
                   "prefeitura-saguao", "Prefeitura — Saguão", mob_prefeitura_saguao, "#f0b03c")

predio_duas_salas(1, 0, "biblioteca-leitura", "Biblioteca — Sala de Leitura", mob_biblioteca_leitura,
                   "biblioteca-acervo", "Biblioteca — Acervo", mob_biblioteca_acervo,
                   "biblioteca-saguao", "Biblioteca — Saguão", mob_biblioteca_saguao, "#f0d9a8")

predio_duas_salas(1, 2, "hospital-consultorio", "Hospital — Consultório", mob_hospital_consultorio,
                   "hospital-recepcao", "Hospital — Recepção", mob_hospital_recepcao,
                   "hospital-saguao", "Hospital — Saguão", mob_hospital_saguao, "#f7c0cf")

predio_duas_salas(2, 0, "banco-atendimento", "Banco — Atendimento", mob_banco_atendimento,
                   "banco-cofre", "Banco — Cofre", mob_banco_cofre,
                   "banco-saguao", "Banco — Saguão", mob_banco_saguao, "#b8dcb0")

predio_uma_sala(2, 1, "mercado-armazem", "Mercado — Armazém", "#fbe8b0", mob_mercado)

predio_duas_salas(2, 2, "teatro-palco", "Teatro — Palco", mob_teatro_palco,
                   "teatro-coxia", "Teatro — Coxia", mob_teatro_coxia,
                   "teatro-saguao", "Teatro — Saguão", mob_teatro_saguao, "#f0b8b8")

predio_duas_salas(2, 3, "estacao-hall", "Estação — Hall", mob_estacao_hall,
                   "estacao-bilheteria", "Estação — Bilheteria", mob_estacao_bilheteria,
                   "estacao-saguao", "Estação — Saguão", mob_estacao_saguao, "#c76b45")

predio_duas_salas(3, 1, "escola-sala", "Escola — Sala de Aula", mob_escola_sala,
                   "escola-professores", "Escola — Sala dos Professores", mob_escola_professores,
                   "escola-saguao", "Escola — Saguão", mob_escola_saguao, "#ffd9a0")

predio_uma_sala(0, 3, "delegacia-investigacao", "Delegacia — Investigação", "#b39b74", mob_delegacia)

co_ox, co_oy, co_largura, co_altura = envelope_de_celula(0, 1)
co_notch_w, co_notch_h = 8, 6
co_nx0 = co_ox + co_largura - co_notch_w
co_porta_x = co_ox + co_largura // 2 - 1

add("wall", co_ox, co_oy, co_largura - co_notch_w, 1, solid=True)
add("wall", co_nx0, co_oy, 1, co_notch_h, solid=True)
add("wall", co_nx0, co_oy + co_notch_h, co_largura - (co_nx0 - co_ox), 1, solid=True)
add("wall", co_ox, co_oy + 1, 1, co_altura - 2, solid=True)
add("wall", co_ox + co_largura - 1, co_oy + co_notch_h + 1, 1, co_altura - co_notch_h - 2, solid=True)
add("wall", co_ox, co_oy + co_altura - 1, co_porta_x - co_ox, 1, solid=True)
add("wall", co_porta_x + 2, co_oy + co_altura - 1, co_ox + co_largura - (co_porta_x + 2), 1, solid=True)
add("door", co_porta_x, co_oy + co_altura - 1, 2, 1)
add("area", co_ox + 1, co_oy + co_notch_h + 1, co_largura - 2, co_altura - co_notch_h - 1,
    id="correios-triagem", name="Correios — Triagem")
add("panel", co_ox + 1, co_oy + 1, co_largura - co_notch_w - 2, co_notch_h - 1, color="#f5c9a0")
add("panel", co_ox + 1, co_oy + co_notch_h + 1, co_largura - 2, co_altura - co_notch_h - 2, color="#f5c9a0")

mob("shelf", co_ox + 2, co_oy + 1.3)
mob("shelf", co_ox + 3.2, co_oy + 1.3)
mesa_com_cadeiras(co_ox + 8, co_oy + 2.3, n=1)
mob("lamp", co_ox + 13, co_oy + 1.3)

balcao_com_cadeira(co_ox + 3, co_oy + co_notch_h + 2, name="Balcão dos Correios", action="Enviar Encomenda", glow="gold")
mesa_com_cadeiras(co_ox + 9, co_oy + co_notch_h + 2, n=2)
fileira("shelf", co_ox + 18, co_oy + co_notch_h + 2, 4, passo=1.1)
fileira("bench", co_ox + 3, co_oy + co_notch_h + 7, 2, passo=3)
mob("plant", co_ox + 22, co_oy + co_notch_h + 7)
mob("lamp", co_ox + 9, co_oy + co_notch_h + 7)

co_porta_x_final = co_ox + co_largura // 2 - 1
conectar_avenida(1, co_porta_x_final, co_oy, co_altura, "sul")

jn_x0, jn_y0, jn_x1, jn_y1 = bounds(3, 0)
add("area", jn_x0, jn_y0, jn_x1 - jn_x0, jn_y1 - jn_y0, id="jardim-norte", name="Jardim Norte", aberta=True)
mob("tree", jn_x0 + 1, jn_y0 + 2)
mob("tree", jn_x0 + 14, jn_y0 + 2)
mob("tree", jn_x0 + 1, jn_y0 + 24)
mob("tree", jn_x0 + 14, jn_y0 + 24)
mob("tree", jn_x0 + 7.5, jn_y0 + 13)
mob("hedge", jn_x0 + 2, jn_y0 + 9)
mob("hedge", jn_x0 + 13, jn_y0 + 9)
mob("hedge", jn_x0 + 2, jn_y0 + 19)
mob("hedge", jn_x0 + 13, jn_y0 + 19)
add("flower", jn_x0 + 7, jn_y0 + 3, 3, 2)
add("flower", jn_x0 + 7, jn_y0 + 24, 3, 2)
mob("bench", jn_x0 + 5, jn_y0 + 10.5)
mob("bench", jn_x0 + 14, jn_y0 + 10.5)
mob("bench", jn_x0 + 5, jn_y0 + 17.5)
mob("bench", jn_x0 + 14, jn_y0 + 17.5)
mob("lamp", jn_x0 + 1, jn_y0 + 6)
mob("lamp", jn_x0 + 17, jn_y0 + 6)
mob("lamp", jn_x0 + 1, jn_y0 + 23)
mob("lamp", jn_x0 + 17, jn_y0 + 23)
mob("plant", jn_x0 + 9.5, jn_y0 + 1)
mob("plant", jn_x0 + 9.5, jn_y0 + 27.5)
mob("column", jn_x0 + 9, jn_y0 + 9)
mob("column", jn_x0 + 11, jn_y0 + 9)

pc_x0, pc_y0, pc_x1, pc_y1 = bounds(1, 1)
add("area", pc_x0, pc_y0, pc_x1 - pc_x0, pc_y1 - pc_y0, id="praca-central", name="Praça Central", aberta=True)
mob("fountain", pc_x0 + 11.2, pc_y0 + 11, shape="circle", glow="gold", name="Fonte Central", action="Fazer um pedido")
mob("bench", pc_x0 + 11, pc_y0 + 4)
mob("bench", pc_x0 + 11, pc_y0 + 19)
mob("bench", pc_x0 + 3, pc_y0 + 11.5)
mob("bench", pc_x0 + 19, pc_y0 + 11.5)
mob("bench", pc_x0 + 6, pc_y0 + 6)
mob("bench", pc_x0 + 16, pc_y0 + 6)
mob("bench", pc_x0 + 6, pc_y0 + 17)
mob("bench", pc_x0 + 16, pc_y0 + 17)
mob("bench", pc_x0 + 3, pc_y0 + 3)
mob("bench", pc_x0 + 19, pc_y0 + 3)
mob("bench", pc_x0 + 3, pc_y0 + 20)
mob("bench", pc_x0 + 19, pc_y0 + 20)
mob("hedge", pc_x0 + 2, pc_y0 + 2)
mob("hedge", pc_x0 + 16, pc_y0 + 2)
mob("hedge", pc_x0 + 2, pc_y0 + 21)
mob("hedge", pc_x0 + 16, pc_y0 + 21)
add("flower", pc_x0 + 1, pc_y0 + 9, 3, 2)
add("flower", pc_x0 + 20, pc_y0 + 9, 3, 2)
mob("lamp", pc_x0 + 9, pc_y0 + 2.2)
mob("lamp", pc_x0 + 13, pc_y0 + 2.2)
mob("column", pc_x0 + 11, pc_y0 + 9)
mob("column", pc_x0 + 14, pc_y0 + 9)

pm_x0, pm_y0, pm_x1, pm_y1 = bounds(0, 2)
add("area", pm_x0, pm_y0, pm_x1 - pm_x0, pm_y1 - pm_y0, id="praca-mercado", name="Praça do Mercado", aberta=True)
mob("jukebox", pm_x0 + 4, pm_y0 + 4, name="Jukebox da Praça", action="Tocar playlist", glow="gold")
mob("bench", pm_x0 + 1, pm_y0 + 2)
mob("bench", pm_x0 + 7, pm_y0 + 2)
mob("bench", pm_x0 + 1, pm_y0 + 6)
mob("bench", pm_x0 + 7, pm_y0 + 6)
mesa_com_cadeiras(pm_x0 + 13, pm_y0 + 3, n=2, name="Mercado Municipal", glow="gold")
mesa_com_cadeiras(pm_x0 + 18, pm_y0 + 3, n=2)
mesa_com_cadeiras(pm_x0 + 13, pm_y0 + 8, n=2)
mesa_com_cadeiras(pm_x0 + 18, pm_y0 + 8, n=2)
mob("bench", pm_x0 + 14, pm_y0 + 13)
mob("bench", pm_x0 + 20, pm_y0 + 13)
mob("lamp", pm_x0 + 9, pm_y0 + 1)
mob("lamp", pm_x0 + 28, pm_y0 + 1)
mob("lamp", pm_x0 + 11, pm_y0 + 20)
mob("lamp", pm_x0 + 28, pm_y0 + 20)
add("flower", pm_x0 + 2, pm_y0 + 20, 3, 2)
add("flower", pm_x0 + 18, pm_y0 + 20, 3, 2)
mob("plant", pm_x0 + 30, pm_y0 + 4)
mob("plant", pm_x0 + 30, pm_y0 + 10)
add("rug", pm_x0 + 12, pm_y0 + 2, 10, 9, color="rgba(217,164,65,0.15)")

js_x0, js_y0, js_x1, js_y1 = bounds(3, 2)
add("area", js_x0, js_y0, js_x1 - js_x0, js_y1 - js_y0, id="jardim-sul", name="Jardim Sul", aberta=True)
add("water", js_x0 + 2, js_y0 + 3, 6, 5)
mob("tree", js_x0 + 9, js_y0 + 1)
mob("tree", js_x0 + 14, js_y0 + 1)
mob("tree", js_x0 + 8, js_y0 + 9)
mob("tree", js_x0 + 13, js_y0 + 9)
mob("tree", js_x0 + 1, js_y0 + 16)
mob("tree", js_x0 + 9, js_y0 + 20)
mob("tree", js_x0 + 14, js_y0 + 20)
mob("hedge", js_x0 + 1, js_y0 + 13)
mob("hedge", js_x0 + 1, js_y0 + 25)
add("flower", js_x0 + 11, js_y0 + 15, 3, 2)
add("flower", js_x0 + 4, js_y0 + 22, 3, 2)
mob("bench", js_x0 + 5, js_y0 + 11)
mob("bench", js_x0 + 13, js_y0 + 13.5)
mob("bench", js_x0 + 5, js_y0 + 24)
mob("bench", js_x0 + 15, js_y0 + 24)
mob("lamp", js_x0 + 1, js_y0 + 1)
mob("lamp", js_x0 + 17, js_y0 + 4.5)
mob("lamp", js_x0 + 1, js_y0 + 26)
mob("lamp", js_x0 + 17, js_y0 + 26)
mob("plant", js_x0 + 18, js_y0 + 10)
mob("plant", js_x0 + 17, js_y0 + 17)
mob("column", js_x0 + 10, js_y0 + 13.5)

pf_x0, pf_y0, pf_x1, pf_y1 = bounds(1, 3)
add("area", pf_x0, pf_y0, pf_x1 - pf_x0, pf_y1 - pf_y0, id="praca-flores", name="Praça das Flores", aberta=True)
mob("fountain", pf_x0 + 9, pf_y0 + 8, shape="circle", glow="gold", name="Fonte das Flores")
mob("hedge", pf_x0 + 8, pf_y0 + 1)
mob("hedge", pf_x0 + 8, pf_y0 + 20)
add("flower", pf_x0 + 2, pf_y0 + 2, 3, 2)
add("flower", pf_x0 + 16, pf_y0 + 2, 3, 2)
add("flower", pf_x0 + 2, pf_y0 + 16, 3, 2)
add("flower", pf_x0 + 16, pf_y0 + 16, 3, 2)
mob("bench", pf_x0 + 5, pf_y0 + 6)
mob("bench", pf_x0 + 17, pf_y0 + 6)
mob("bench", pf_x0 + 5, pf_y0 + 14)
mob("bench", pf_x0 + 17, pf_y0 + 14)
mob("bench", pf_x0 + 10, pf_y0 + 18)
mob("bench", pf_x0 + 2, pf_y0 + 2)
mob("bench", pf_x0 + 19, pf_y0 + 2)
mob("lamp", pf_x0 + 1, pf_y0 + 10)
mob("lamp", pf_x0 + 20, pf_y0 + 10)
mob("plant", pf_x0 + 1, pf_y0 + 5)
mob("plant", pf_x0 + 21, pf_y0 + 5)
mob("plant", pf_x0 + 1, pf_y0 + 18)
mob("plant", pf_x0 + 21, pf_y0 + 18)
mob("column", pf_x0 + 6, pf_y0 + 8)
mob("column", pf_x0 + 15, pf_y0 + 8)
mob("column", pf_x0 + 2, pf_y0 + 11)
mob("column", pf_x0 + 21, pf_y0 + 11)

ps_x0, ps_y0, ps_x1, ps_y1 = bounds(3, 3)
add("area", ps_x0, ps_y0, ps_x1 - ps_x0, ps_y1 - ps_y0, id="parque-sul", name="Parque Sul", aberta=True)
mesa_com_cadeiras(ps_x0 + 4, ps_y0 + 3, n=2)
mesa_com_cadeiras(ps_x0 + 13, ps_y0 + 3, n=2)
mesa_com_cadeiras(ps_x0 + 8, ps_y0 + 10, n=2)
mob("tree", ps_x0 + 1, ps_y0 + 15)
mob("tree", ps_x0 + 15, ps_y0 + 15)
mob("bench", ps_x0 + 2, ps_y0 + 7)
mob("bench", ps_x0 + 13, ps_y0 + 7)
mob("bench", ps_x0 + 6, ps_y0 + 14)
mob("bench", ps_x0 + 10, ps_y0 + 14)
mob("lamp", ps_x0 + 1, ps_y0 + 1)
mob("lamp", ps_x0 + 17, ps_y0 + 1)
mob("lamp", ps_x0 + 1, ps_y0 + 20)
mob("lamp", ps_x0 + 17, ps_y0 + 20)
add("flower", ps_x0 + 7, ps_y0 + 17, 3, 2)
add("flower", ps_x0 + 11, ps_y0 + 17, 3, 2)
mob("plant", ps_x0 + 9, ps_y0 + 7)
mob("plant", ps_x0 + 9, ps_y0 + 20)
mob("column", ps_x0 + 9, ps_y0 + 1)


def ruido(x, y, sal=0):
    n = (x * 73856093) ^ (y * 19349663) ^ (sal * 83492791)
    return (n >> 8) & 0xFF


def jardinar():
    passo = 6
    for bx in range(MARGEM + 2, 120 - MARGEM - 3, passo):
        for by in range(MARGEM + 2, 120 - MARGEM - 3, passo):
            r = ruido(bx, by)
            if r % 5 == 0:
                continue
            dx, dy = r % 4, ruido(bx, by, 1) % 4
            fx, fy = bx + dx, by + dy
            if livre(fx, fy, 2, 2) and r % 3 != 2:
                add("flower", fx, fy, 2, 2)
            vx, vy = bx + ruido(bx, by, 2) % 5, by + ruido(bx, by, 3) % 5
            if livre(vx, vy, 1, 1) and r % 3 == 0:
                mob("plant", vx, vy)
            hx, hy = bx + ruido(bx, by, 4) % 4, by + ruido(bx, by, 5) % 4
            if livre(hx, hy, 2, 1) and r % 7 == 1:
                mob("hedge", hx, hy)


def livre(x, y, w, h):
    if x < 1 or y < 1 or x + w > 119 or y + h > 119:
        return False
    for o in objetos:
        if o["kind"] in ("area", "grass", "path", "panel", "flower"):
            continue
        if x < o["x"] + o["w"] and x + w > o["x"] and y < o["y"] + o["h"] and y + h > o["y"]:
            return False
    return True


jardinar()

mapa = {
    "id": "cidade",
    "name": "Cidade",
    "blurb": "Cidade grande e ensolarada: avenidas de tamanhos variados conectando quarteirões, prédios institucionais com saguões vivos e praças com identidade própria.",
    "hours": "meio-dia",
    "label": "cidade",
    "width": 120,
    "height": 120,
    "palette": {
        "floor": ["#e9dcbe", "#ded0ae"],
        "floorTrim": "#b39b74",
        "wall": "#d9b98a",
        "wallTop": "#c76b45",
        "accent": "#f0b03c",
    },
    "spawn": {"x": 41, "y": 44},
    "objects": objetos,
}

print(json.dumps(mapa))
