#!/usr/bin/env python3
"""Gera o mundo CIDADE (120x120) e imprime o JSON do mapa no stdout.

Grade de 4x4 quarteiroes (16 celulas de ~26x26) separados por 3 avenidas
verticais e 3 horizontais (kind "path", largura 4). 10 predios institucionais
com salas internas (area + porta) ocupam 10 celulas; as outras 6 sao pracas e
jardins com grama, arvores, arbustos, flores, bancos e uma fonte central.
Clima diurno e quente: paleta terrosa/quente, sem tons roxos ou frios.
"""
import json

objetos = []

SOLIDOS = {
    "wall", "desk", "table", "shelf", "servers", "sofa", "chair", "bench",
    "column", "jukebox", "fountain", "tree", "hedge", "board", "lamp",
    "plant", "water",
}

CELL_COLS = [(1, 28), (33, 58), (63, 88), (93, 118)]
CELL_ROWS = [(1, 28), (33, 58), (63, 88), (93, 118)]
AVENUE = [(29, 32), (59, 62), (89, 92)]
MARGEM = 3

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
        av_inicio = AVENUE[row][0]
        h = av_inicio - (fundo + 1)
        if h > 0:
            add("path", porta_x, fundo + 1, 2, h)
    else:
        av_fim = AVENUE[row - 1][1]
        y0 = av_fim + 1
        h = oy - y0
        if h > 0:
            add("path", porta_x, y0, 2, h)


def predio_uma_sala(col, row, area_id, nome, cor, mobiliar):
    ox, oy, largura, altura = envelope_de_celula(col, row)
    lado = "sul" if row < 3 else "norte"
    sala(ox, oy, largura, altura, area_id, nome, lado, cor)
    mobiliar(ox, oy, largura, altura)
    porta_x = ox + largura // 2 - 1
    conectar_avenida(row, porta_x, oy, altura, lado)


def predio_duas_salas(col, row, id1, nome1, mob1, id2, nome2, mob2, cor):
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
    else:
        ry = oy + altura - 1 - room_h
        porta_sala = "norte"
    sala(r1x, ry, room_w, room_h, id1, nome1, porta_sala, cor)
    sala(r2x, ry, room_w, room_h, id2, nome2, porta_sala, cor)
    mob1(r1x, ry, room_w, room_h)
    mob2(r2x, ry, room_w, room_h)
    porta_x = ox + largura // 2 - 1
    conectar_avenida(row, porta_x, oy, altura, lado)


def mob_prefeitura_reuniao(rx, ry, rw, rh):
    add("table", rx + 3, ry + 3, 3, 2)
    add("chair", rx + 2, ry + 2, 1, 2)
    add("chair", rx + 6, ry + 2, 1, 2)
    add("board", rx + 2, ry + 1, 4, 1, glow="cyan", name="Pauta da Reunião")


def mob_prefeitura_protocolo(rx, ry, rw, rh):
    add("desk", rx + 1, ry + 2, 4, 2, name="Balcão de Protocolo", action="Abrir Protocolo", glow="gold")
    add("chair", rx + 2, ry + 4, 1, 2)
    add("shelf", rx + 6, ry + 1, 1, 3)
    add("lamp", rx + 6, ry + 5, 1, 1)


def mob_biblioteca_leitura(rx, ry, rw, rh):
    add("table", rx + 1, ry + 2, 3, 2)
    add("table", rx + 1, ry + 5, 3, 2)
    add("chair", rx + 4, ry + 2, 1, 2)
    add("lamp", rx + 5, ry + 4, 1, 1)


def mob_biblioteca_acervo(rx, ry, rw, rh):
    add("shelf", rx + 1, ry + 1, 1, 3, name="Acervo Geral")
    add("shelf", rx + 1, ry + 4, 1, 3)
    add("shelf", rx + 4, ry + 1, 1, 3)
    add("shelf", rx + 4, ry + 4, 1, 3)


def mob_banco_atendimento(rx, ry, rw, rh):
    add("desk", rx + 1, ry + 2, 4, 2, name="Guichê do Banco", action="Abrir Conta", glow="gold")
    add("chair", rx + 2, ry + 4, 1, 2)
    add("plant", rx + 6, ry + 1, 1, 2)


def mob_banco_cofre(rx, ry, rw, rh):
    add("shelf", rx + 1, ry + 1, 1, 3, name="Cofre", glow="gold")
    add("shelf", rx + 1, ry + 4, 1, 3)
    add("lamp", rx + 5, ry + 3, 1, 1)


def mob_correios(rx, ry, rw, rh):
    add("desk", rx + 2, ry + 2, 4, 2, name="Balcão dos Correios", action="Enviar Encomenda", glow="gold")
    add("chair", rx + 3, ry + 5, 1, 2)
    add("table", rx + 8, ry + 2, 3, 2)
    add("shelf", rx + 15, ry + 2, 1, 3)
    add("shelf", rx + 18, ry + 2, 1, 3)
    add("lamp", rx + 10, ry + 10, 1, 1)


def mob_mercado(rx, ry, rw, rh):
    add("table", rx + 2, ry + 3, 3, 2, name="Mercado Municipal", glow="gold")
    add("table", rx + 7, ry + 3, 3, 2)
    add("table", rx + 12, ry + 3, 3, 2)
    add("bench", rx + 2, ry + 10, 2, 1)
    add("bench", rx + 10, ry + 10, 2, 1)
    add("plant", rx + 16, ry + 2, 1, 2)


def mob_escola_sala(rx, ry, rw, rh):
    add("desk", rx + 1, ry + 2, 4, 2)
    add("chair", rx + 2, ry + 4, 1, 2)
    add("board", rx + 1, ry + 1, 4, 1, glow="cyan", name="Quadro da Sala")


def mob_escola_professores(rx, ry, rw, rh):
    add("table", rx + 2, ry + 2, 3, 2)
    add("chair", rx + 1, ry + 2, 1, 2)
    add("shelf", rx + 5, ry + 1, 1, 3)


def mob_hospital_consultorio(rx, ry, rw, rh):
    add("desk", rx + 1, ry + 2, 4, 2, name="Consultório", action="Consulta", glow="green")
    add("chair", rx + 2, ry + 4, 1, 2)
    add("shelf", rx + 5, ry + 1, 1, 3, name="Remédios")


def mob_hospital_recepcao(rx, ry, rw, rh):
    add("table", rx + 2, ry + 2, 3, 2)
    add("chair", rx + 1, ry + 2, 1, 2)
    add("plant", rx + 5, ry + 4, 1, 2)


def mob_teatro_palco(rx, ry, rw, rh):
    add("table", rx + 2, ry + 2, 3, 2, name="Palco", action="Assistir Espetáculo", glow="gold")
    add("lamp", rx + 1, ry + 1, 1, 1)
    add("lamp", rx + 6, ry + 1, 1, 1)


def mob_teatro_coxia(rx, ry, rw, rh):
    add("shelf", rx + 1, ry + 1, 1, 3, name="Figurinos")
    add("chair", rx + 4, ry + 2, 1, 2)


def mob_delegacia(rx, ry, rw, rh):
    add("desk", rx + 2, ry + 2, 4, 2, name="Mesa de Investigação", action="Abrir Ocorrência", glow="purple")
    add("board", rx + 2, ry + 6, 4, 1, glow="cyan", name="Quadro de Pistas")
    add("shelf", rx + 10, ry + 2, 1, 3, name="Arquivo")
    add("chair", rx + 3, ry + 4, 1, 2)
    add("lamp", rx + 15, ry + 10, 1, 1)


def mob_estacao_hall(rx, ry, rw, rh):
    add("bench", rx + 1, ry + 2, 2, 1)
    add("bench", rx + 1, ry + 4, 2, 1)
    add("plant", rx + 5, ry + 1, 1, 2)


def mob_estacao_bilheteria(rx, ry, rw, rh):
    add("desk", rx + 1, ry + 2, 4, 2, name="Bilheteria", action="Comprar Passagem", glow="gold")
    add("chair", rx + 2, ry + 4, 1, 2)


add("grass", 1, 1, 118, 118)

for y0, y1 in AVENUE:
    add("path", 1, y0, 118, y1 - y0 + 1)
for x0, x1 in AVENUE:
    add("path", x0, 1, x1 - x0 + 1, 118)

predio_duas_salas(0, 0, "prefeitura-reuniao", "Prefeitura — Sala de Reunião", mob_prefeitura_reuniao,
                   "prefeitura-protocolo", "Prefeitura — Protocolo", mob_prefeitura_protocolo, "#d9a441")

predio_uma_sala(0, 1, "correios-triagem", "Correios — Triagem", "#c97b4a", mob_correios)

predio_uma_sala(0, 3, "delegacia-investigacao", "Delegacia — Investigação", "#8a7f6e", mob_delegacia)

predio_duas_salas(1, 0, "biblioteca-leitura", "Biblioteca — Sala de Leitura", mob_biblioteca_leitura,
                   "biblioteca-acervo", "Biblioteca — Acervo", mob_biblioteca_acervo, "#b98650")

predio_duas_salas(1, 2, "hospital-consultorio", "Hospital — Consultório", mob_hospital_consultorio,
                   "hospital-recepcao", "Hospital — Recepção", mob_hospital_recepcao, "#e0716a")

predio_duas_salas(2, 0, "banco-atendimento", "Banco — Atendimento", mob_banco_atendimento,
                   "banco-cofre", "Banco — Cofre", mob_banco_cofre, "#8fae6b")

predio_uma_sala(2, 1, "mercado-armazem", "Mercado — Armazém", "#e0b464", mob_mercado)

predio_duas_salas(2, 2, "teatro-palco", "Teatro — Palco", mob_teatro_palco,
                   "teatro-coxia", "Teatro — Coxia", mob_teatro_coxia, "#c2504a")

predio_duas_salas(2, 3, "estacao-hall", "Estação — Hall", mob_estacao_hall,
                   "estacao-bilheteria", "Estação — Bilheteria", mob_estacao_bilheteria, "#b5603f")

predio_duas_salas(3, 1, "escola-sala", "Escola — Sala de Aula", mob_escola_sala,
                   "escola-professores", "Escola — Sala dos Professores", mob_escola_professores, "#d98c4a")

jn_x0, jn_y0, jn_x1, jn_y1 = bounds(3, 0)
add("tree", jn_x0 + 3, jn_y0 + 3, 3, 3)
add("tree", jn_x0 + 19, jn_y0 + 3, 3, 3)
add("tree", jn_x0 + 3, jn_y0 + 19, 3, 3)
add("tree", jn_x0 + 19, jn_y0 + 19, 3, 3)
add("hedge", jn_x0 + 6, jn_y0 + 9, 6, 1)
add("hedge", jn_x0 + 6, jn_y0 + 15, 6, 1)
add("flower", jn_x0 + 11, jn_y0 + 3, 3, 2)
add("flower", jn_x0 + 11, jn_y0 + 19, 3, 2)
add("bench", jn_x0 + 7, jn_y0 + 12, 2, 1)
add("bench", jn_x0 + 19, jn_y0 + 12, 2, 1)
add("lamp", jn_x0 + 5, jn_y0 + 7, 1, 1)
add("lamp", jn_x0 + 21, jn_y0 + 7, 1, 1)

pc_x0, pc_y0, pc_x1, pc_y1 = bounds(1, 1)
add("fountain", pc_x0 + 10, pc_y0 + 10, 4, 4, shape="circle", glow="gold", name="Fonte Central", action="Fazer um pedido")
add("bench", pc_x0 + 3, pc_y0 + 7, 2, 1)
add("bench", pc_x0 + 19, pc_y0 + 7, 2, 1)
add("bench", pc_x0 + 3, pc_y0 + 17, 2, 1)
add("bench", pc_x0 + 19, pc_y0 + 17, 2, 1)
add("hedge", pc_x0 + 3, pc_y0 + 2, 6, 1)
add("hedge", pc_x0 + 13, pc_y0 + 2, 6, 1)
add("hedge", pc_x0 + 3, pc_y0 + 22, 6, 1)
add("hedge", pc_x0 + 13, pc_y0 + 22, 6, 1)
add("flower", pc_x0 + 1, pc_y0 + 11, 3, 2)
add("flower", pc_x0 + 18, pc_y0 + 11, 3, 2)
add("lamp", pc_x0 + 7, pc_y0 + 15, 1, 1)
add("lamp", pc_x0 + 15, pc_y0 + 15, 1, 1)

pm_x0, pm_y0, pm_x1, pm_y1 = bounds(0, 2)
add("rug", pm_x0 + 7, pm_y0 + 3, 14, 10, color="rgba(217,164,65,0.18)")
add("jukebox", pm_x0 + 3, pm_y0 + 5, 2, 2, name="Jukebox da Praça", action="Tocar playlist", glow="gold")
add("bench", pm_x0 + 9, pm_y0 + 7, 2, 1)
add("bench", pm_x0 + 17, pm_y0 + 7, 2, 1)
add("bench", pm_x0 + 9, pm_y0 + 15, 2, 1)
add("bench", pm_x0 + 17, pm_y0 + 15, 2, 1)
add("lamp", pm_x0 + 5, pm_y0 + 9, 1, 1)
add("lamp", pm_x0 + 21, pm_y0 + 9, 1, 1)
add("flower", pm_x0 + 3, pm_y0 + 17, 3, 2)
add("flower", pm_x0 + 19, pm_y0 + 17, 3, 2)

js_x0, js_y0, js_x1, js_y1 = bounds(3, 2)
add("tree", js_x0 + 3, js_y0 + 3, 3, 3)
add("tree", js_x0 + 19, js_y0 + 3, 3, 3)
add("tree", js_x0 + 3, js_y0 + 19, 3, 3)
add("tree", js_x0 + 19, js_y0 + 19, 3, 3)
add("hedge", js_x0 + 6, js_y0 + 9, 6, 1)
add("hedge", js_x0 + 6, js_y0 + 15, 6, 1)
add("flower", js_x0 + 11, js_y0 + 3, 3, 2)
add("flower", js_x0 + 11, js_y0 + 19, 3, 2)
add("bench", js_x0 + 7, js_y0 + 12, 2, 1)
add("bench", js_x0 + 19, js_y0 + 12, 2, 1)
add("lamp", js_x0 + 5, js_y0 + 7, 1, 1)
add("lamp", js_x0 + 21, js_y0 + 7, 1, 1)

pf_x0, pf_y0, pf_x1, pf_y1 = bounds(1, 3)
add("flower", pf_x0 + 3, pf_y0 + 3, 3, 2)
add("flower", pf_x0 + 15, pf_y0 + 3, 3, 2)
add("flower", pf_x0 + 3, pf_y0 + 15, 3, 2)
add("flower", pf_x0 + 15, pf_y0 + 15, 3, 2)
add("flower", pf_x0 + 9, pf_y0 + 9, 3, 2)
add("bench", pf_x0 + 7, pf_y0 + 7, 2, 1)
add("bench", pf_x0 + 7, pf_y0 + 19, 2, 1)
add("lamp", pf_x0 + 1, pf_y0 + 9, 1, 1)
add("lamp", pf_x0 + 21, pf_y0 + 9, 1, 1)
add("hedge", pf_x0 + 3, pf_y0 + 23, 6, 1)

ps_x0, ps_y0, ps_x1, ps_y1 = bounds(3, 3)
add("water", ps_x0 + 3, ps_y0 + 3, 10, 8)
add("tree", ps_x0 + 17, ps_y0 + 3, 3, 3)
add("tree", ps_x0 + 3, ps_y0 + 17, 3, 3)
add("tree", ps_x0 + 19, ps_y0 + 19, 3, 3)
add("bench", ps_x0 + 7, ps_y0 + 15, 2, 1)
add("bench", ps_x0 + 15, ps_y0 + 7, 2, 1)
add("flower", ps_x0 + 15, ps_y0 + 15, 3, 2)
add("lamp", ps_x0 + 11, ps_y0 + 11, 1, 1)

mapa = {
    "id": "cidade",
    "name": "Cidade",
    "blurb": "Cidade grande e ensolarada: avenidas conectando quarteirões, prédios institucionais e praças verdes.",
    "hours": "meio-dia",
    "label": "cidade",
    "width": 120,
    "height": 120,
    "palette": {
        "floor": ["#c9b79c", "#bfa987"],
        "floorTrim": "#8a7f6e",
        "wall": "#9a8b74",
        "wallTop": "#b5603f",
        "accent": "#d9a441",
    },
    "spawn": {"x": 40, "y": 46},
    "objects": objetos,
}

print(json.dumps(mapa))
