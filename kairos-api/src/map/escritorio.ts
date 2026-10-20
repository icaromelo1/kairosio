type Giro = 0 | 90 | 180 | 270

interface Movel {
  id: string
  peca: string
  x: number
  y: number
  giro: Giro
  estacao?: string
  nome?: string
}

interface Area {
  id: string
  tipo: 'caminho' | 'pedra' | 'deck' | 'agua' | 'terra' | 'grama'
  forma: 'retangulo' | 'circulo'
  x: number
  y: number
  largura: number
  profundidade: number
}

const mobilia: Movel[] = []
const areas: Area[] = []
let seq = 0

function por(peca: string, x: number, y: number, giro: Giro = 0, extra: Partial<Movel> = {}) {
  mobilia.push({ id: `m${++seq}`, peca, x, y, giro, ...extra })
}

function area(tipo: Area['tipo'], forma: Area['forma'], x: number, y: number, largura: number, profundidade: number) {
  areas.push({ id: `a${areas.length + 1}`, tipo, forma, x, y, largura, profundidade })
}

const enfeitesDeMesa = ['notebook', 'planta_mesa', 'pilha_livros', 'notebook', 'planta_mesa', 'pilha_livros']

function ilhaDeMesas(cx: number, cy: number) {
  por('tapete_grande', cx, cy)
  for (const [k, dx] of [-1.4, 0, 1.4].entries()) {
    por(enfeitesDeMesa[k], cx + dx - 0.35, cy + 0.42, 0)
    por(enfeitesDeMesa[k + 3], cx + dx + 0.42, cy - 0.42, 180)
    por('mesa_trabalho', cx + dx, cy + 0.35, 0)
    por('cadeira', cx + dx, cy + 1.1, 180)
    por('mesa_trabalho', cx + dx, cy - 0.35, 180)
    por('cadeira', cx + dx, cy - 1.1, 0)
  }
}

ilhaDeMesas(18.5, 18.6)
ilhaDeMesas(25, 18.6)
ilhaDeMesas(18.5, 24)
ilhaDeMesas(25, 24)
por('armario', 14.4, 17.2, 90)
por('impressora', 14.5, 25.6, 90)
por('planta_grande', 14.7, 15.7)
por('planta_grande', 29.3, 15.7)
por('planta', 30.6, 21)
por('planta', 35.4, 21)
por('planta_grande', 35.3, 26.3)
por('tapete', 43, 21)
por('tv', 43, 17.3, 0, { nome: 'TV do salão' })
por('sofa', 43, 23.6, 180)
por('poltrona', 40.6, 21, 90)
por('poltrona', 45.4, 21, 270)
por('mesa_centro', 43, 21)
por('planta_grande', 49.3, 15.7)
por('bebedouro', 49.6, 17.2)
por('luminaria', 39.6, 17)
por('luminaria', 46.6, 26.3)
por('estante', 48.5, 26.4, 180, { nome: 'estante do salão' })

por('mesa_reuniao', 18, 11.6)
for (const x of [16.8, 18, 19.2]) {
  por('cadeira', x, 10.5, 0)
  por('cadeira', x, 12.7, 180)
}
por('cadeira', 15.9, 11.6, 90)
por('cadeira', 20.1, 11.6, 270)
por('tv', 18, 8.5, 0, { nome: 'TV da reunião' })
por('lousa', 21.4, 9.8, 270, { nome: 'lousa da reunião' })
por('planta', 14.6, 8.6)
por('planta', 14.6, 14.4)

por('balcao', 25.4, 8.6)
por('geladeira', 29.8, 8.6)
por('bebedouro', 30.5, 10.2)
por('jukebox', 30.4, 12.4, 270, { nome: 'jukebox da copa' })
for (const cx of [24.6, 27.8]) {
  por('mesa_redonda', cx, 12.4)
  por('banqueta', cx, 11.5, 0)
  por('banqueta', cx, 13.3, 180)
  por('banqueta', cx - 0.9, 12.4, 90)
  por('banqueta', cx + 0.9, 12.4, 270)
}
por('planta', 22.6, 14.4)

por('estante', 34, 8.4, 0, { nome: 'estante de notas' })
por('poltrona', 32.3, 12, 90)
por('poltrona', 35.7, 12, 270)
por('mesa_centro', 34, 12, 90)
por('luminaria', 31.6, 8.6)
por('planta', 36.4, 14.4)

por('lousa', 40, 8.35, 0, { nome: 'lousa de ideias' })
por('tapete_redondo', 40, 12)
por('puff', 38.8, 11.6, 180)
por('puff', 40, 12.4, 180)
por('puff', 41.2, 11.6, 180)
por('planta', 42.4, 14.4)

por('mesa_reuniao', 46.5, 11.6, 90)
for (const y of [10.7, 11.6, 12.5]) {
  por('cadeira', 45.2, y, 90)
  por('cadeira', 47.8, y, 270)
}
por('tv', 46.5, 8.5, 0, { nome: 'TV da reunião 2' })
por('planta', 43.6, 8.6)
por('planta', 49.4, 14.4)

for (const x of [15, 16, 17]) por('rack_servidor', x, 33.2, 180)
por('mesa_trabalho', 18.1, 30.5, 270, { nome: 'mesa do suporte' })
por('cadeira', 17.35, 30.5, 90)

por('mesa_pingpong', 21.6, 30.6)
por('sinuca', 25.2, 30.8, 90)
por('arcade', 20, 33.4, 180)
por('arcade', 21, 33.4, 180)
por('planta', 26.4, 33.4)

por('balcao', 34.9, 30.5, 270, { nome: 'balcão da recepção' })
por('cadeira', 35.8, 30.5, 270)
por('sofa', 28.3, 30.5, 90)
por('mesa_centro', 29.6, 30.5, 90)
por('tapete', 32, 30.5, 90)
por('planta', 27.6, 27.6)
por('planta', 36.4, 27.6)
por('planta_grande', 27.7, 33.3)
por('planta_grande', 36.3, 33.3)

por('poltrona', 38.75, 31, 0)
por('luminaria', 38.75, 33.4)
por('poltrona', 41.25, 31, 0)
por('luminaria', 41.25, 33.4)

por('tapete_redondo', 46, 31)
por('sofa', 46, 33.3, 180)
por('puff', 45, 30.4, 0)
por('puff', 47, 30.4, 0)
por('poltrona', 43.2, 31, 90)
por('estante', 49.6, 30.5, 270, { nome: 'estante da descompressão' })
por('planta_grande', 49.4, 27.8)

for (const [x, y, peca] of [
  [14.6, 15.2, 'lixeira'], [29.6, 26.5, 'lixeira'], [49.4, 26.6, 'cabideiro'], [27.6, 29.2, 'cabideiro'],
  [36.4, 29.6, 'vaso_alto'], [14.6, 27.4, 'vaso_alto'], [22.6, 8.6, 'lixeira'], [42.6, 26.6, 'vaso_alto'],
] as const) por(peca, x, y)

for (const x of [16, 20, 25, 28.5, 34, 40, 45.5, 48.5]) por('janela', x, 8.12, 0)
por('quadro_a', 17, 15.12, 0)
por('relogio', 23.5, 15.12, 0)
por('quadro_avisos', 33.4, 15.12, 0, { nome: 'quadro de avisos' })
por('quadro_b', 39.5, 15.12, 0)
por('quadro_a', 47.5, 15.12, 0)
por('quadro_b', 16.5, 27.12, 0)
por('relogio', 30, 27.12, 0)
por('quadro_a', 45, 27.12, 0)
for (const x of [16, 21, 25, 30, 34, 44, 48]) por('janela', x, 34.12, 0)

area('grama', 'circulo', 4.5, 31, 12, 15)
area('grama', 'circulo', 4, 9, 9, 10)
area('grama', 'circulo', 61, 42, 8, 9)
area('grama', 'circulo', 3, 44, 7, 6)
area('caminho', 'retangulo', 32, 5, 48, 2.2)
area('caminho', 'retangulo', 9, 23, 2.4, 38)
area('caminho', 'retangulo', 55, 23, 2.4, 38)
area('caminho', 'retangulo', 32, 41, 48.4, 2.4)
area('caminho', 'retangulo', 11.5, 21, 5, 2.4)
area('caminho', 'retangulo', 52.5, 21, 5, 2.4)
area('caminho', 'retangulo', 32, 37.5, 3, 7)
area('pedra', 'circulo', 32, 41, 9, 9)
area('agua', 'circulo', 4, 31, 6, 8)
area('deck', 'retangulo', 60, 31, 6, 10)
area('terra', 'retangulo', 32, 2.2, 15, 2.6)

por('fonte', 32, 41)
por('banco_jardim', 27.3, 41, 90)
por('banco_jardim', 36.7, 41, 270)
por('banco_jardim', 32, 45.6, 180)
for (const [x, y] of [[30, 36], [34, 36], [28, 44.6], [36, 44.6], [10.4, 13], [10.4, 30], [53.6, 13], [53.6, 30], [20, 42.4], [44, 42.4]] as const) {
  por('poste', x, y)
}
por('canteiro', 29.4, 35.4)
por('canteiro', 34.6, 35.4)
for (const x of [26, 29, 32, 35, 38]) por('canteiro', x, 2.2)

const norte = [2, 5, 8, 11, 14, 17, 20, 23, 41, 44, 47, 50, 53, 56, 59, 62]
norte.forEach((x, i) => por(i % 3 === 1 ? 'arvore_pinheiro' : 'arvore', x, 1.6))
const sul = [3, 7, 11, 15, 19, 23, 41, 45, 49, 53, 57, 61]
sul.forEach((x, i) => por(i % 3 === 2 ? 'arvore_pinheiro' : 'arvore', x, 46.4))
for (const y of [10, 14, 28, 32]) {
  por('arbusto', 13.2, y)
  por('arbusto', 50.8, y)
}
for (const x of [16, 22, 28, 36, 42, 48]) por('arbusto', x, 7.1)
por('arvore', 3, 9)
por('arvore', 4, 17)
por('arvore_pinheiro', 12, 44)
por('arvore', 52, 44)
por('arvore', 61, 8)
por('arvore', 61, 16)
por('arvore_pinheiro', 62.3, 24)
por('arvore_pinheiro', 62.3, 38)
por('pedra', 1.2, 26.6)
por('pedra', 6.9, 26.8)
por('pedra', 1.2, 35.4)
por('pedra', 6.8, 35.6)
por('arbusto', 1.5, 22)
por('banco_jardim', 7.4, 31, 270)
por('mesa_picnic', 60, 28.2)
por('mesa_picnic', 60, 33.8)
por('arbusto', 20, 44.5)
por('arbusto', 44, 44.5)

let semente = 7
function aleatorio() {
  semente = (semente * 16807) % 2147483647
  return (semente - 1) / 2147483646
}

function livreNoJardim(x: number, y: number) {
  if (x > 12.5 && x < 51.5 && y > 6.5 && y < 35.5) return false
  for (const a of areas) {
    if (a.forma === 'circulo') {
      if (((x - a.x) / (a.largura / 2 + 0.6)) ** 2 + ((y - a.y) / (a.profundidade / 2 + 0.6)) ** 2 < 1) return false
    } else if (Math.abs(x - a.x) < a.largura / 2 + 0.3 && Math.abs(y - a.y) < a.profundidade / 2 + 0.3) return false
  }
  return !mobilia.some((m) => Math.hypot(m.x - x, m.y - y) < 1.1)
}

for (let i = 0, colocados = 0; i < 4000 && colocados < 260; i++) {
  const x = 1 + aleatorio() * 62
  const y = 1 + aleatorio() * 46
  if (!livreNoJardim(x, y)) continue
  por(aleatorio() < 0.72 ? 'tufo' : 'flores', Math.round(x * 10) / 10, Math.round(y * 10) / 10, ([0, 90, 180, 270] as const)[Math.floor(aleatorio() * 4)])
  colocados++
}

export const ESCRITORIO = {
  id: 'escritorio',
  name: 'Escritório',
  largura: 64,
  profundidade: 48,
  piso: '#93c96b',
  spawn: { x: 32, y: 37 },
  salas: [
    { id: 'salao', nome: 'Salão', x: 14, y: 8, largura: 36, profundidade: 26, piso: '#e2c49a', aberta: true, murada: true, textura: 'madeira', portas: [{ lado: 'oeste', centro: 13, largura: 2 }, { lado: 'leste', centro: 13, largura: 2 }] },
    { id: 'reuniao', nome: 'Sala de reunião', x: 14, y: 8, largura: 8, profundidade: 7, piso: '#cdd8e2', textura: 'carpete', portas: [{ lado: 'sul', centro: 4, largura: 1.4 }] },
    { id: 'copa', nome: 'Copa', x: 22, y: 8, largura: 9, profundidade: 7, piso: '#efdcb8', textura: 'ladrilho', portas: [{ lado: 'sul', centro: 4.5, largura: 1.6 }] },
    { id: 'foco', nome: 'Sala de foco', x: 31, y: 8, largura: 6, profundidade: 7, piso: '#cfa877', textura: 'madeira', portas: [{ lado: 'sul', centro: 3, largura: 1.2 }] },
    { id: 'ideias', nome: 'Sala de ideias', x: 37, y: 8, largura: 6, profundidade: 7, piso: '#e8d2de', textura: 'carpete', portas: [{ lado: 'sul', centro: 3, largura: 1.4 }] },
    { id: 'reuniao2', nome: 'Sala de reunião 2', x: 43, y: 8, largura: 7, profundidade: 7, piso: '#d2dbe8', textura: 'carpete', portas: [{ lado: 'sul', centro: 3.5, largura: 1.4 }] },
    { id: 'servidores', nome: 'Sala de servidores', x: 14, y: 27, largura: 5, profundidade: 7, piso: '#cfd4d8', textura: 'ladrilho', portas: [{ lado: 'norte', centro: 2.5, largura: 1.2 }] },
    { id: 'jogos', nome: 'Sala de jogos', x: 19, y: 27, largura: 8, profundidade: 7, piso: '#d9b48a', textura: 'madeira', portas: [{ lado: 'norte', centro: 4, largura: 1.6 }] },
    { id: 'recepcao', nome: 'Recepção', x: 27, y: 27, largura: 10, profundidade: 7, piso: '#d8b27e', textura: 'madeira', portas: [{ lado: 'norte', centro: 5, largura: 2.4 }, { lado: 'sul', centro: 5, largura: 2.4 }] },
    { id: 'cabine1', nome: 'Cabine 1', x: 37, y: 27, largura: 2.5, profundidade: 7, piso: '#dfe7d6', textura: 'carpete', portas: [{ lado: 'norte', centro: 1.25, largura: 1 }] },
    { id: 'cabine2', nome: 'Cabine 2', x: 39.5, y: 27, largura: 2.5, profundidade: 7, piso: '#dfe7d6', textura: 'carpete', portas: [{ lado: 'norte', centro: 1.25, largura: 1 }] },
    { id: 'descompressao', nome: 'Descompressão', x: 42, y: 27, largura: 8, profundidade: 7, piso: '#e3dcef', textura: 'carpete', portas: [{ lado: 'norte', centro: 4, largura: 1.4 }] },
  ],
  mobilia,
  areas,
}
