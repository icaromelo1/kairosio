#!/usr/bin/env python3
"""Gera o mundo CIDADE (120x120) e imprime o JSON do mapa no stdout.

Malha irregular de quarteiroes (larguras/alturas variadas) separados por
avenidas de larguras diferentes (uma principal larga, ruas secundarias
estreitas), com 10 predios institucionais — cada um com salas pequenas
mobiliadas e um saguao/salao proprio (area + porta + mobilia densa) — e
6 pracas/jardins com identidade propria e alta densidade de mobiliario.
O prédio dos Correios tem planta em L (quarteirao de formato irregular).
Clima diurno e quente: paleta terrosa, sem tons roxos ou frios.
"""
import json

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


def mobiliar(rx, ry, itens):
    for kind, dx, dy, w, h, extra in itens:
        add(kind, rx + dx, ry + dy, w, h, **extra)


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


def predio_uma_sala(col, row, area_id, nome, cor, mob):
    ox, oy, largura, altura = envelope_de_celula(col, row)
    lado = "sul" if row < 3 else "norte"
    sala(ox, oy, largura, altura, area_id, nome, lado, cor)
    mob(ox, oy, largura, altura)
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
    mobiliar(rx, ry, [
        ("table", 4, 4, 3, 2, {}),
        ("chair", 3, 3, 1, 2, {}),
        ("chair", 7, 3, 1, 2, {}),
        ("chair", 3, 6, 1, 2, {}),
        ("chair", 7, 6, 1, 2, {}),
        ("board", 4, 1, 4, 1, {"glow": "cyan", "name": "Pauta da Reunião"}),
        ("plant", 1, 1, 1, 2, {}),
        ("plant", 10, 1, 1, 2, {}),
        ("lamp", 1, 8, 1, 1, {}),
        ("lamp", 10, 8, 1, 1, {}),
    ])


def mob_prefeitura_protocolo(rx, ry, rw, rh):
    mobiliar(rx, ry, [
        ("desk", 1, 2, 4, 2, {"name": "Balcão de Protocolo", "action": "Abrir Protocolo", "glow": "gold"}),
        ("chair", 2, 4, 1, 2, {}),
        ("desk", 7, 2, 4, 2, {}),
        ("chair", 8, 4, 1, 2, {}),
        ("shelf", 1, 7, 1, 3, {}),
        ("shelf", 3, 7, 1, 3, {}),
        ("shelf", 5, 7, 1, 3, {}),
        ("shelf", 7, 7, 1, 3, {}),
        ("lamp", 10, 1, 1, 1, {}),
        ("plant", 10, 7, 1, 2, {}),
    ])


def mob_prefeitura_saguao(rx, ry, rw, rh):
    mobiliar(rx, ry, [
        ("table", 2, 5, 3, 2, {}),
        ("chair", 1, 5, 1, 2, {}),
        ("chair", 6, 5, 1, 2, {}),
        ("bench", 2, 9, 2, 1, {}),
        ("bench", 23, 9, 2, 1, {}),
        ("shelf", 24, 4, 1, 3, {}),
        ("shelf", 1, 1, 1, 3, {}),
        ("plant", 24, 1, 1, 2, {}),
        ("lamp", 9, 10, 1, 1, {}),
        ("lamp", 17, 10, 1, 1, {}),
        ("rug", 10, 4, 7, 5, {"color": "rgba(217,164,65,0.15)"}),
        ("sofa", 23, 10, 3, 2, {}),
        ("column", 13, 1, 1, 2, {}),
    ])


def mob_biblioteca_leitura(rx, ry, rw, rh):
    mobiliar(rx, ry, [
        ("table", 1, 2, 3, 2, {}),
        ("table", 1, 6, 3, 2, {}),
        ("chair", 4, 2, 1, 2, {}),
        ("chair", 4, 6, 1, 2, {}),
        ("lamp", 5, 1, 1, 1, {}),
        ("lamp", 5, 9, 1, 1, {}),
        ("plant", 1, 8, 1, 2, {}),
        ("shelf", 6, 1, 1, 3, {}),
    ])


def mob_biblioteca_acervo(rx, ry, rw, rh):
    mobiliar(rx, ry, [
        ("shelf", 1, 1, 1, 3, {"name": "Acervo Geral"}),
        ("shelf", 1, 5, 1, 3, {}),
        ("shelf", 4, 1, 1, 3, {}),
        ("shelf", 4, 5, 1, 3, {}),
        ("chair", 6, 2, 1, 2, {}),
        ("lamp", 6, 6, 1, 1, {}),
        ("table", 1, 8, 3, 2, {}),
        ("plant", 6, 8, 1, 2, {}),
    ])


def mob_biblioteca_saguao(rx, ry, rw, rh):
    mobiliar(rx, ry, [
        ("table", 2, 4, 3, 2, {}),
        ("chair", 1, 4, 1, 2, {}),
        ("chair", 6, 4, 1, 2, {}),
        ("shelf", 15, 2, 1, 3, {}),
        ("shelf", 17, 2, 1, 3, {}),
        ("bench", 2, 9, 2, 1, {}),
        ("bench", 15, 9, 2, 1, {}),
        ("lamp", 8, 1, 1, 1, {}),
        ("lamp", 8, 11, 1, 1, {}),
        ("plant", 1, 9, 1, 2, {}),
        ("rug", 9, 4, 6, 4, {"color": "rgba(184,134,80,0.15)"}),
        ("column", 12, 1, 1, 2, {}),
    ])


def mob_hospital_consultorio(rx, ry, rw, rh):
    mobiliar(rx, ry, [
        ("desk", 1, 2, 4, 2, {"name": "Consultório", "action": "Consulta", "glow": "green"}),
        ("chair", 2, 4, 1, 2, {}),
        ("shelf", 6, 1, 1, 3, {"name": "Remédios"}),
        ("shelf", 6, 5, 1, 3, {}),
        ("plant", 1, 6, 1, 2, {}),
        ("lamp", 4, 7, 1, 1, {}),
        ("chair", 5, 5, 1, 2, {}),
        ("lamp", 1, 1, 1, 1, {}),
    ])


def mob_hospital_recepcao(rx, ry, rw, rh):
    mobiliar(rx, ry, [
        ("table", 1, 2, 3, 2, {}),
        ("chair", 4, 2, 1, 2, {}),
        ("chair", 1, 5, 1, 2, {}),
        ("plant", 5, 5, 1, 2, {}),
        ("shelf", 6, 1, 1, 3, {}),
        ("lamp", 1, 7, 1, 1, {}),
        ("lamp", 5, 7, 1, 1, {}),
        ("bench", 3, 5, 2, 1, {}),
    ])


def mob_hospital_saguao(rx, ry, rw, rh):
    mobiliar(rx, ry, [
        ("table", 2, 4, 3, 2, {}),
        ("chair", 1, 4, 1, 2, {}),
        ("chair", 6, 4, 1, 2, {}),
        ("bench", 2, 8, 2, 1, {}),
        ("bench", 15, 8, 2, 1, {}),
        ("shelf", 15, 2, 1, 3, {"name": "Suprimentos"}),
        ("plant", 17, 2, 1, 2, {}),
        ("plant", 1, 8, 1, 2, {}),
        ("lamp", 8, 1, 1, 1, {}),
        ("lamp", 8, 10, 1, 1, {}),
        ("rug", 9, 4, 6, 4, {"color": "rgba(224,113,106,0.15)"}),
        ("column", 12, 1, 1, 2, {}),
    ])


def mob_banco_atendimento(rx, ry, rw, rh):
    mobiliar(rx, ry, [
        ("desk", 1, 2, 4, 2, {"name": "Guichê do Banco", "action": "Abrir Conta", "glow": "gold"}),
        ("chair", 2, 4, 1, 2, {}),
        ("desk", 1, 6, 4, 2, {}),
        ("chair", 2, 8, 1, 2, {}),
        ("plant", 7, 1, 1, 2, {}),
        ("shelf", 7, 4, 1, 3, {}),
        ("plant", 7, 7, 1, 2, {}),
        ("lamp", 4, 9, 1, 1, {}),
    ])


def mob_banco_cofre(rx, ry, rw, rh):
    mobiliar(rx, ry, [
        ("shelf", 1, 1, 1, 3, {"name": "Cofre", "glow": "gold"}),
        ("shelf", 1, 5, 1, 3, {}),
        ("shelf", 4, 1, 1, 3, {}),
        ("shelf", 4, 5, 1, 3, {}),
        ("shelf", 7, 1, 1, 3, {}),
        ("shelf", 7, 5, 1, 3, {}),
        ("lamp", 4, 8, 1, 1, {}),
        ("column", 8, 8, 1, 2, {}),
    ])


def mob_banco_saguao(rx, ry, rw, rh):
    mobiliar(rx, ry, [
        ("table", 2, 4, 3, 2, {}),
        ("chair", 1, 4, 1, 2, {}),
        ("chair", 6, 4, 1, 2, {}),
        ("bench", 2, 9, 2, 1, {}),
        ("bench", 19, 9, 2, 1, {}),
        ("shelf", 18, 2, 1, 3, {}),
        ("shelf", 20, 2, 1, 3, {}),
        ("plant", 1, 9, 1, 2, {}),
        ("plant", 21, 9, 1, 2, {}),
        ("lamp", 10, 1, 1, 1, {}),
        ("lamp", 10, 11, 1, 1, {}),
        ("rug", 9, 4, 8, 4, {"color": "rgba(143,174,107,0.15)"}),
        ("column", 15, 1, 1, 2, {}),
    ])


def mob_mercado(rx, ry, rw, rh):
    mobiliar(rx, ry, [
        ("table", 2, 3, 3, 2, {"name": "Mercado Municipal", "glow": "gold"}),
        ("table", 7, 3, 3, 2, {}),
        ("table", 12, 3, 3, 2, {}),
        ("table", 17, 3, 3, 2, {}),
        ("bench", 2, 8, 2, 1, {}),
        ("bench", 6, 8, 2, 1, {}),
        ("bench", 10, 8, 2, 1, {}),
        ("bench", 14, 8, 2, 1, {}),
        ("plant", 19, 3, 1, 2, {}),
        ("plant", 19, 8, 1, 2, {}),
        ("shelf", 1, 12, 1, 3, {}),
        ("shelf", 3, 12, 1, 3, {}),
        ("lamp", 10, 14, 1, 1, {}),
        ("lamp", 15, 14, 1, 1, {}),
    ])


def mob_teatro_palco(rx, ry, rw, rh):
    mobiliar(rx, ry, [
        ("table", 2, 3, 3, 2, {"name": "Palco", "action": "Assistir Espetáculo", "glow": "gold"}),
        ("lamp", 1, 1, 1, 1, {}),
        ("lamp", 8, 1, 1, 1, {}),
        ("chair", 1, 6, 1, 2, {}),
        ("chair", 3, 6, 1, 2, {}),
        ("chair", 5, 6, 1, 2, {}),
        ("chair", 7, 6, 1, 2, {}),
        ("plant", 8, 6, 1, 2, {}),
    ])


def mob_teatro_coxia(rx, ry, rw, rh):
    mobiliar(rx, ry, [
        ("shelf", 1, 1, 1, 3, {"name": "Figurinos"}),
        ("shelf", 3, 1, 1, 3, {}),
        ("chair", 6, 2, 1, 2, {}),
        ("table", 1, 6, 3, 2, {}),
        ("chair", 5, 6, 1, 2, {}),
        ("lamp", 8, 1, 1, 1, {}),
        ("plant", 8, 6, 1, 2, {}),
        ("column", 5, 1, 1, 2, {}),
    ])


def mob_teatro_saguao(rx, ry, rw, rh):
    mobiliar(rx, ry, [
        ("table", 2, 4, 3, 2, {}),
        ("chair", 1, 4, 1, 2, {}),
        ("chair", 6, 4, 1, 2, {}),
        ("bench", 2, 8, 2, 1, {}),
        ("bench", 19, 8, 2, 1, {}),
        ("shelf", 18, 2, 1, 3, {"name": "Adereços"}),
        ("plant", 21, 2, 1, 2, {}),
        ("plant", 1, 8, 1, 2, {}),
        ("lamp", 10, 1, 1, 1, {}),
        ("lamp", 10, 10, 1, 1, {}),
        ("rug", 9, 4, 8, 4, {"color": "rgba(194,80,74,0.15)"}),
        ("column", 15, 1, 1, 2, {}),
    ])


def mob_estacao_hall(rx, ry, rw, rh):
    mobiliar(rx, ry, [
        ("bench", 1, 1, 2, 1, {}),
        ("bench", 4, 1, 2, 1, {}),
        ("bench", 1, 3, 2, 1, {}),
        ("bench", 4, 3, 2, 1, {}),
        ("plant", 7, 1, 1, 2, {}),
        ("lamp", 7, 4, 1, 1, {}),
        ("plant", 4, 4, 1, 2, {}),
        ("lamp", 1, 5, 1, 1, {}),
    ])


def mob_estacao_bilheteria(rx, ry, rw, rh):
    mobiliar(rx, ry, [
        ("desk", 1, 1, 4, 2, {"name": "Bilheteria", "action": "Comprar Passagem", "glow": "gold"}),
        ("chair", 2, 3, 1, 2, {}),
        ("shelf", 7, 1, 1, 3, {}),
        ("lamp", 4, 4, 1, 1, {}),
        ("plant", 6, 4, 1, 2, {}),
        ("column", 8, 1, 1, 2, {}),
        ("bench", 7, 5, 2, 1, {}),
        ("lamp", 1, 4, 1, 1, {}),
    ])


def mob_estacao_saguao(rx, ry, rw, rh):
    mobiliar(rx, ry, [
        ("bench", 2, 3, 2, 1, {}),
        ("bench", 6, 3, 2, 1, {}),
        ("bench", 14, 3, 2, 1, {}),
        ("bench", 18, 3, 2, 1, {}),
        ("plant", 1, 6, 1, 2, {}),
        ("plant", 21, 6, 1, 2, {}),
        ("lamp", 10, 1, 1, 1, {}),
        ("lamp", 10, 8, 1, 1, {}),
        ("shelf", 10, 4, 1, 3, {"name": "Informações"}),
        ("table", 2, 6, 3, 2, {}),
        ("chair", 6, 6, 1, 2, {}),
        ("column", 18, 6, 1, 2, {}),
    ])


def mob_escola_sala(rx, ry, rw, rh):
    mobiliar(rx, ry, [
        ("desk", 1, 2, 4, 2, {}),
        ("chair", 2, 4, 1, 2, {}),
        ("board", 1, 1, 4, 1, {"glow": "cyan", "name": "Quadro da Sala"}),
        ("plant", 5, 4, 1, 2, {}),
        ("lamp", 5, 1, 1, 1, {}),
        ("bench", 1, 6, 2, 1, {}),
        ("lamp", 4, 6, 1, 1, {}),
        ("chair", 3, 5, 1, 2, {}),
    ])


def mob_escola_professores(rx, ry, rw, rh):
    mobiliar(rx, ry, [
        ("table", 1, 2, 3, 2, {}),
        ("chair", 4, 2, 1, 2, {}),
        ("shelf", 5, 4, 1, 3, {}),
        ("lamp", 1, 5, 1, 1, {}),
        ("plant", 5, 1, 1, 2, {}),
        ("board", 1, 1, 4, 1, {}),
        ("chair", 2, 5, 1, 2, {}),
        ("lamp", 3, 6, 1, 1, {}),
    ])


def mob_escola_saguao(rx, ry, rw, rh):
    mobiliar(rx, ry, [
        ("table", 2, 3, 3, 2, {}),
        ("chair", 1, 3, 1, 2, {}),
        ("chair", 6, 3, 1, 2, {}),
        ("shelf", 12, 2, 1, 3, {}),
        ("bench", 2, 7, 2, 1, {}),
        ("bench", 10, 7, 2, 1, {}),
        ("lamp", 7, 1, 1, 1, {}),
        ("lamp", 7, 8, 1, 1, {}),
        ("plant", 14, 7, 1, 2, {}),
        ("column", 9, 1, 1, 2, {}),
    ])


def mob_delegacia(rx, ry, rw, rh):
    mobiliar(rx, ry, [
        ("desk", 2, 3, 4, 2, {"name": "Mesa de Investigação", "action": "Abrir Ocorrência", "glow": "purple"}),
        ("chair", 3, 5, 1, 2, {}),
        ("desk", 20, 3, 4, 2, {}),
        ("chair", 21, 5, 1, 2, {}),
        ("board", 2, 8, 4, 1, {"glow": "cyan", "name": "Quadro de Pistas"}),
        ("board", 20, 8, 4, 1, {}),
        ("shelf", 9, 3, 1, 3, {"name": "Arquivo"}),
        ("shelf", 11, 3, 1, 3, {}),
        ("shelf", 9, 8, 1, 3, {}),
        ("shelf", 11, 8, 1, 3, {}),
        ("lamp", 6, 12, 1, 1, {}),
        ("lamp", 20, 12, 1, 1, {}),
        ("table", 13, 12, 3, 2, {}),
        ("chair", 12, 12, 1, 2, {}),
    ])


add("grass", 1, 1, 118, 118)

for y0, y1 in AVENUE_H:
    add("path", 1, y0, 118, y1 - y0 + 1)
for x0, x1 in AVENUE_V:
    add("path", x0, 1, x1 - x0 + 1, 118)

predio_duas_salas(0, 0, "prefeitura-reuniao", "Prefeitura — Sala de Reunião", mob_prefeitura_reuniao,
                   "prefeitura-protocolo", "Prefeitura — Protocolo", mob_prefeitura_protocolo,
                   "prefeitura-saguao", "Prefeitura — Saguão", mob_prefeitura_saguao, "#c9ae76")

predio_duas_salas(1, 0, "biblioteca-leitura", "Biblioteca — Sala de Leitura", mob_biblioteca_leitura,
                   "biblioteca-acervo", "Biblioteca — Acervo", mob_biblioteca_acervo,
                   "biblioteca-saguao", "Biblioteca — Saguão", mob_biblioteca_saguao, "#ae865b")

predio_duas_salas(1, 2, "hospital-consultorio", "Hospital — Consultório", mob_hospital_consultorio,
                   "hospital-recepcao", "Hospital — Recepção", mob_hospital_recepcao,
                   "hospital-saguao", "Hospital — Saguão", mob_hospital_saguao, "#c48a86")

predio_duas_salas(2, 0, "banco-atendimento", "Banco — Atendimento", mob_banco_atendimento,
                   "banco-cofre", "Banco — Cofre", mob_banco_cofre,
                   "banco-saguao", "Banco — Saguão", mob_banco_saguao, "#8fae6b")

predio_uma_sala(2, 1, "mercado-armazem", "Mercado — Armazém", "#c2ab82", mob_mercado)

predio_duas_salas(2, 2, "teatro-palco", "Teatro — Palco", mob_teatro_palco,
                   "teatro-coxia", "Teatro — Coxia", mob_teatro_coxia,
                   "teatro-saguao", "Teatro — Saguão", mob_teatro_saguao, "#af615d")

predio_duas_salas(2, 3, "estacao-hall", "Estação — Hall", mob_estacao_hall,
                   "estacao-bilheteria", "Estação — Bilheteria", mob_estacao_bilheteria,
                   "estacao-saguao", "Estação — Saguão", mob_estacao_saguao, "#b5866c")

predio_duas_salas(3, 1, "escola-sala", "Escola — Sala de Aula", mob_escola_sala,
                   "escola-professores", "Escola — Sala dos Professores", mob_escola_professores,
                   "escola-saguao", "Escola — Saguão", mob_escola_saguao, "#b78f6c")

predio_uma_sala(0, 3, "delegacia-investigacao", "Delegacia — Investigação", "#8a7f6e", mob_delegacia)

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
add("panel", co_ox + 1, co_oy + 1, co_largura - co_notch_w - 2, co_notch_h - 1, color="#b18062")
add("panel", co_ox + 1, co_oy + co_notch_h + 1, co_largura - 2, co_altura - co_notch_h - 2, color="#b18062")

add("shelf", co_ox + 5, co_oy + 1, 1, 3)
add("shelf", co_ox + 8, co_oy + 1, 1, 3)
add("table", co_ox + 12, co_oy + 1, 3, 2)
add("chair", co_ox + 11, co_oy + 1, 1, 2)
add("lamp", co_ox + 18, co_oy + 1, 1, 1)
add("desk", co_ox + 5, co_oy + co_notch_h + 2, 4, 2, name="Balcão dos Correios", action="Enviar Encomenda", glow="gold")
add("chair", co_ox + 6, co_oy + co_notch_h + 5, 1, 2)
add("table", co_ox + 12, co_oy + co_notch_h + 2, 3, 2)
add("chair", co_ox + 13, co_oy + co_notch_h + 5, 1, 2)
add("shelf", co_ox + 22, co_oy + co_notch_h + 2, 1, 3)
add("shelf", co_ox + 24, co_oy + co_notch_h + 2, 1, 3)
add("shelf", co_ox + 26, co_oy + co_notch_h + 2, 1, 3)
add("bench", co_ox + 5, co_oy + co_notch_h + 8, 2, 1)
add("bench", co_ox + 12, co_oy + co_notch_h + 8, 2, 1)
add("plant", co_ox + 26, co_oy + co_notch_h + 8, 1, 2)
add("lamp", co_ox + 9, co_oy + co_notch_h + 8, 1, 1)

co_porta_x_final = co_ox + co_largura // 2 - 1
conectar_avenida(1, co_porta_x_final, co_oy, co_altura, "sul")

jn_x0, jn_y0, jn_x1, jn_y1 = bounds(3, 0)
add("tree", jn_x0 + 2, jn_y0 + 3, 3, 3)
add("tree", jn_x0 + 16, jn_y0 + 3, 3, 3)
add("tree", jn_x0 + 2, jn_y0 + 24, 3, 3)
add("tree", jn_x0 + 16, jn_y0 + 24, 3, 3)
add("tree", jn_x0 + 9, jn_y0 + 13, 3, 3)
add("hedge", jn_x0 + 2, jn_y0 + 8, 6, 1)
add("hedge", jn_x0 + 13, jn_y0 + 8, 6, 1)
add("hedge", jn_x0 + 2, jn_y0 + 19, 6, 1)
add("hedge", jn_x0 + 13, jn_y0 + 19, 6, 1)
add("flower", jn_x0 + 7, jn_y0 + 3, 3, 2)
add("flower", jn_x0 + 7, jn_y0 + 24, 3, 2)
add("flower", jn_x0 + 2, jn_y0 + 13, 3, 2)
add("flower", jn_x0 + 16, jn_y0 + 13, 3, 2)
add("bench", jn_x0 + 5, jn_y0 + 10, 2, 1)
add("bench", jn_x0 + 14, jn_y0 + 10, 2, 1)
add("bench", jn_x0 + 5, jn_y0 + 17, 2, 1)
add("bench", jn_x0 + 14, jn_y0 + 17, 2, 1)
add("lamp", jn_x0 + 1, jn_y0 + 6, 1, 1)
add("lamp", jn_x0 + 19, jn_y0 + 6, 1, 1)
add("lamp", jn_x0 + 1, jn_y0 + 23, 1, 1)
add("lamp", jn_x0 + 19, jn_y0 + 23, 1, 1)
add("plant", jn_x0 + 9, jn_y0 + 1, 1, 2)
add("plant", jn_x0 + 9, jn_y0 + 27, 1, 2)
add("column", jn_x0 + 9, jn_y0 + 9, 1, 2)
add("column", jn_x0 + 11, jn_y0 + 9, 1, 2)

pc_x0, pc_y0, pc_x1, pc_y1 = bounds(1, 1)
add("fountain", pc_x0 + 10, pc_y0 + 10, 4, 4, shape="circle", glow="gold", name="Fonte Central", action="Fazer um pedido")
add("bench", pc_x0 + 7, pc_y0 + 7, 2, 1)
add("bench", pc_x0 + 15, pc_y0 + 7, 2, 1)
add("bench", pc_x0 + 7, pc_y0 + 16, 2, 1)
add("bench", pc_x0 + 15, pc_y0 + 16, 2, 1)
add("bench", pc_x0 + 3, pc_y0 + 10, 2, 1)
add("bench", pc_x0 + 19, pc_y0 + 10, 2, 1)
add("bench", pc_x0 + 3, pc_y0 + 13, 2, 1)
add("bench", pc_x0 + 19, pc_y0 + 13, 2, 1)
add("hedge", pc_x0 + 3, pc_y0 + 2, 6, 1)
add("hedge", pc_x0 + 15, pc_y0 + 2, 6, 1)
add("hedge", pc_x0 + 3, pc_y0 + 21, 6, 1)
add("hedge", pc_x0 + 15, pc_y0 + 21, 6, 1)
add("flower", pc_x0 + 1, pc_y0 + 9, 3, 2)
add("flower", pc_x0 + 20, pc_y0 + 9, 3, 2)
add("flower", pc_x0 + 1, pc_y0 + 14, 3, 2)
add("flower", pc_x0 + 20, pc_y0 + 14, 3, 2)
add("lamp", pc_x0 + 10, pc_y0 + 3, 1, 1)
add("lamp", pc_x0 + 13, pc_y0 + 3, 1, 1)
add("lamp", pc_x0 + 10, pc_y0 + 20, 1, 1)
add("lamp", pc_x0 + 13, pc_y0 + 20, 1, 1)
add("column", pc_x0 + 9, pc_y0 + 8, 1, 2)
add("column", pc_x0 + 14, pc_y0 + 8, 1, 2)
add("bench", pc_x0 + 11, pc_y0 + 3, 2, 1)
add("column", pc_x0 + 9, pc_y0 + 13, 1, 2)

pm_x0, pm_y0, pm_x1, pm_y1 = bounds(0, 2)
add("jukebox", pm_x0 + 4, pm_y0 + 4, 2, 2, name="Jukebox da Praça", action="Tocar playlist", glow="gold")
add("bench", pm_x0 + 1, pm_y0 + 3, 2, 1)
add("bench", pm_x0 + 8, pm_y0 + 3, 2, 1)
add("bench", pm_x0 + 1, pm_y0 + 6, 2, 1)
add("bench", pm_x0 + 8, pm_y0 + 6, 2, 1)
add("bench", pm_x0 + 14, pm_y0 + 13, 2, 1)
add("bench", pm_x0 + 20, pm_y0 + 13, 2, 1)
add("bench", pm_x0 + 2, pm_y0 + 13, 2, 1)
add("bench", pm_x0 + 26, pm_y0 + 13, 2, 1)
add("table", pm_x0 + 14, pm_y0 + 3, 3, 2)
add("table", pm_x0 + 19, pm_y0 + 3, 3, 2)
add("table", pm_x0 + 24, pm_y0 + 3, 3, 2)
add("table", pm_x0 + 14, pm_y0 + 8, 3, 2)
add("table", pm_x0 + 19, pm_y0 + 8, 3, 2)
add("table", pm_x0 + 24, pm_y0 + 8, 3, 2)
add("lamp", pm_x0 + 12, pm_y0 + 1, 1, 1)
add("lamp", pm_x0 + 28, pm_y0 + 1, 1, 1)
add("lamp", pm_x0 + 12, pm_y0 + 20, 1, 1)
add("lamp", pm_x0 + 28, pm_y0 + 20, 1, 1)
add("flower", pm_x0 + 2, pm_y0 + 20, 3, 2)
add("flower", pm_x0 + 10, pm_y0 + 20, 3, 2)
add("flower", pm_x0 + 18, pm_y0 + 20, 3, 2)
add("flower", pm_x0 + 26, pm_y0 + 20, 3, 2)
add("plant", pm_x0 + 30, pm_y0 + 4, 1, 2)
add("plant", pm_x0 + 30, pm_y0 + 10, 1, 2)
add("rug", pm_x0 + 13, pm_y0 + 2, 15, 9, color="rgba(217,164,65,0.15)")

js_x0, js_y0, js_x1, js_y1 = bounds(3, 2)
add("water", js_x0 + 2, js_y0 + 3, 6, 5)
add("tree", js_x0 + 10, js_y0 + 2, 3, 3)
add("tree", js_x0 + 15, js_y0 + 2, 3, 3)
add("tree", js_x0 + 9, js_y0 + 9, 3, 3)
add("tree", js_x0 + 14, js_y0 + 9, 3, 3)
add("tree", js_x0 + 2, js_y0 + 15, 3, 3)
add("tree", js_x0 + 9, js_y0 + 20, 3, 3)
add("tree", js_x0 + 15, js_y0 + 20, 3, 3)
add("hedge", js_x0 + 2, js_y0 + 12, 6, 1)
add("hedge", js_x0 + 2, js_y0 + 24, 6, 1)
add("flower", js_x0 + 11, js_y0 + 15, 3, 2)
add("flower", js_x0 + 4, js_y0 + 22, 3, 2)
add("bench", js_x0 + 5, js_y0 + 10, 2, 1)
add("bench", js_x0 + 13, js_y0 + 13, 2, 1)
add("bench", js_x0 + 5, js_y0 + 24, 2, 1)
add("bench", js_x0 + 15, js_y0 + 24, 2, 1)
add("lamp", js_x0 + 1, js_y0 + 1, 1, 1)
add("lamp", js_x0 + 19, js_y0 + 1, 1, 1)
add("lamp", js_x0 + 1, js_y0 + 26, 1, 1)
add("lamp", js_x0 + 19, js_y0 + 26, 1, 1)
add("plant", js_x0 + 17, js_y0 + 10, 1, 2)
add("plant", js_x0 + 17, js_y0 + 17, 1, 2)
add("bench", js_x0 + 9, js_y0 + 17, 2, 1)
add("lamp", js_x0 + 10, js_y0 + 13, 1, 1)

pf_x0, pf_y0, pf_x1, pf_y1 = bounds(1, 3)
add("fountain", pf_x0 + 9, pf_y0 + 8, 4, 4, shape="circle", glow="gold", name="Fonte das Flores")
add("flower", pf_x0 + 2, pf_y0 + 2, 3, 2)
add("flower", pf_x0 + 16, pf_y0 + 2, 3, 2)
add("flower", pf_x0 + 2, pf_y0 + 9, 3, 2)
add("flower", pf_x0 + 16, pf_y0 + 9, 3, 2)
add("flower", pf_x0 + 2, pf_y0 + 16, 3, 2)
add("flower", pf_x0 + 9, pf_y0 + 16, 3, 2)
add("flower", pf_x0 + 16, pf_y0 + 16, 3, 2)
add("hedge", pf_x0 + 8, pf_y0 + 1, 6, 1)
add("hedge", pf_x0 + 8, pf_y0 + 20, 6, 1)
add("bench", pf_x0 + 5, pf_y0 + 6, 2, 1)
add("bench", pf_x0 + 17, pf_y0 + 6, 2, 1)
add("bench", pf_x0 + 5, pf_y0 + 14, 2, 1)
add("bench", pf_x0 + 17, pf_y0 + 14, 2, 1)
add("bench", pf_x0 + 10, pf_y0 + 18, 2, 1)
add("lamp", pf_x0 + 1, pf_y0 + 10, 1, 1)
add("lamp", pf_x0 + 21, pf_y0 + 10, 1, 1)
add("plant", pf_x0 + 1, pf_y0 + 5, 1, 2)
add("plant", pf_x0 + 21, pf_y0 + 5, 1, 2)
add("plant", pf_x0 + 1, pf_y0 + 18, 1, 2)
add("plant", pf_x0 + 21, pf_y0 + 18, 1, 2)
add("bench", pf_x0 + 10, pf_y0 + 3, 2, 1)
add("bench", pf_x0 + 3, pf_y0 + 18, 2, 1)
add("column", pf_x0 + 14, pf_y0 + 8, 1, 2)
add("column", pf_x0 + 6, pf_y0 + 8, 1, 2)
add("lamp", pf_x0 + 9, pf_y0 + 21, 1, 1)
add("lamp", pf_x0 + 13, pf_y0 + 21, 1, 1)

ps_x0, ps_y0, ps_x1, ps_y1 = bounds(3, 3)
add("table", ps_x0 + 3, ps_y0 + 3, 3, 2)
add("table", ps_x0 + 14, ps_y0 + 3, 3, 2)
add("table", ps_x0 + 8, ps_y0 + 10, 3, 2)
add("bench", ps_x0 + 2, ps_y0 + 6, 2, 1)
add("bench", ps_x0 + 6, ps_y0 + 6, 2, 1)
add("bench", ps_x0 + 13, ps_y0 + 6, 2, 1)
add("bench", ps_x0 + 17, ps_y0 + 6, 2, 1)
add("bench", ps_x0 + 7, ps_y0 + 13, 2, 1)
add("bench", ps_x0 + 11, ps_y0 + 13, 2, 1)
add("tree", ps_x0 + 1, ps_y0 + 10, 3, 3)
add("tree", ps_x0 + 17, ps_y0 + 10, 3, 3)
add("tree", ps_x0 + 1, ps_y0 + 18, 3, 3)
add("tree", ps_x0 + 17, ps_y0 + 18, 3, 3)
add("flower", ps_x0 + 7, ps_y0 + 17, 3, 2)
add("flower", ps_x0 + 11, ps_y0 + 17, 3, 2)
add("lamp", ps_x0 + 1, ps_y0 + 1, 1, 1)
add("lamp", ps_x0 + 19, ps_y0 + 1, 1, 1)
add("lamp", ps_x0 + 1, ps_y0 + 20, 1, 1)
add("lamp", ps_x0 + 19, ps_y0 + 20, 1, 1)
add("plant", ps_x0 + 9, ps_y0 + 6, 1, 2)
add("plant", ps_x0 + 9, ps_y0 + 20, 1, 2)
add("column", ps_x0 + 9, ps_y0 + 1, 1, 2)

mapa = {
    "id": "cidade",
    "name": "Cidade",
    "blurb": "Cidade grande e ensolarada: avenidas de tamanhos variados conectando quarteirões, prédios institucionais com saguões vivos e praças com identidade própria.",
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
    "spawn": {"x": 41, "y": 44},
    "objects": objetos,
}

print(json.dumps(mapa))
