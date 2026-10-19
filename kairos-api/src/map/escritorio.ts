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

const mobilia: Movel[] = []
let seq = 0

function por(peca: string, x: number, y: number, giro: Giro = 0, extra: Partial<Movel> = {}) {
  mobilia.push({ id: `m${++seq}`, peca, x, y, giro, ...extra })
}

function ilhaDeMesas(cx: number, cy: number) {
  for (const dx of [-0.7, 0.7]) {
    por('mesa_trabalho', cx + dx, cy + 0.35, 0)
    por('cadeira', cx + dx, cy + 1.1, 180)
    por('mesa_trabalho', cx + dx, cy - 0.35, 180)
    por('cadeira', cx + dx, cy - 1.1, 0)
  }
}

ilhaDeMesas(6, 11.5)
ilhaDeMesas(15, 11.5)
ilhaDeMesas(24, 11.5)
por('planta_grande', 0.8, 7.8)
por('planta_grande', 0.8, 15.2)
por('planta_grande', 29.2, 15.2)
por('bebedouro', 29.4, 7.7)
por('luminaria', 10.5, 7.6)
por('luminaria', 19.5, 7.6)

por('mesa_reuniao', 4.5, 3.4)
for (const x of [3.3, 4.5, 5.7]) {
  por('cadeira', x, 2.3, 0)
  por('cadeira', x, 4.5, 180)
}
por('cadeira', 2.4, 3.4, 90)
por('cadeira', 6.6, 3.4, 270)
por('lousa', 4.5, 0.35, 0, { nome: 'lousa da reunião' })
por('planta', 0.6, 0.6)
por('planta', 8.4, 0.6)

por('balcao', 12.2, 0.6)
por('geladeira', 16.4, 0.6)
por('jukebox', 16.4, 2.4, 270, { nome: 'jukebox da copa' })
por('mesa_redonda', 11.4, 4.3)
por('banqueta', 11.4, 3.4, 0)
por('banqueta', 11.4, 5.2, 180)
por('banqueta', 10.5, 4.3, 90)
por('banqueta', 12.3, 4.3, 270)
por('sofa', 15.9, 5.2, 270)

por('estante', 20, 0.4, 0, { nome: 'estante de notas' })
por('poltrona', 18.6, 3.6, 90)
por('poltrona', 21.4, 3.6, 270)
por('mesa_centro', 20, 3.6, 0)
por('luminaria', 17.6, 0.6)
por('planta', 22.4, 6.4)

por('lousa', 26.5, 0.35, 0, { nome: 'lousa de ideias' })
por('tapete_redondo', 26.5, 3.9)
por('puff', 25.2, 3.6, 180)
por('puff', 26.5, 4.2, 180)
por('puff', 27.8, 3.6, 180)
por('planta', 29.4, 6.4)

for (const x of [1.2, 2.2, 3.2]) por('rack_servidor', x, 20.6, 180)
por('mesa_trabalho', 6, 20.6, 180)
por('cadeira', 6, 19.85, 0)

por('tapete', 12.6, 20)
por('balcao', 15, 18.4, 180, { nome: 'balcão da recepção' })
por('sofa', 18, 20.9, 180)
por('mesa_centro', 18, 19.7)
por('planta', 10.6, 16.6)
por('planta', 19.4, 16.6)

por('tapete_redondo', 25, 19.6)
por('puff', 24.2, 19.2, 0)
por('puff', 25.8, 20.2, 0)
por('sofa', 28.6, 19.4, 270)
por('planta_grande', 22.7, 21.3)
por('luminaria', 29.4, 21.4)

por('planta_grande', 9, 17)
por('planta_grande', 21, 17)

export const ESCRITORIO = {
  id: 'escritorio',
  name: 'Escritório',
  largura: 30,
  profundidade: 22,
  piso: '#eadfc8',
  spawn: { x: 12.6, y: 20 },
  salas: [
    { id: 'reuniao', nome: 'Sala de reunião', x: 0, y: 0, largura: 9, profundidade: 7, piso: '#cdd8e2', portas: [{ lado: 'sul', centro: 4.5, largura: 1.4 }] },
    { id: 'copa', nome: 'Copa', x: 9, y: 0, largura: 8, profundidade: 7, piso: '#efdcb8', portas: [{ lado: 'sul', centro: 4, largura: 1.4 }] },
    { id: 'foco', nome: 'Sala de foco', x: 17, y: 0, largura: 6, profundidade: 7, piso: '#d5e2cc', portas: [{ lado: 'sul', centro: 3, largura: 1.2 }] },
    { id: 'ideias', nome: 'Sala de ideias', x: 23, y: 0, largura: 7, profundidade: 7, piso: '#e8d2de', portas: [{ lado: 'sul', centro: 3.5, largura: 1.4 }] },
    { id: 'salao', nome: 'Salão', x: 0, y: 7, largura: 30, profundidade: 9, piso: '#eadfc8', aberta: true, portas: [] },
    { id: 'servidores', nome: 'Sala de servidores', x: 0, y: 16, largura: 8, profundidade: 6, piso: '#cfd4d8', portas: [{ lado: 'norte', centro: 4, largura: 1.2 }] },
    { id: 'recepcao', nome: 'Recepção', x: 10, y: 16, largura: 10, profundidade: 6, piso: '#e9d6b4', portas: [{ lado: 'norte', centro: 5, largura: 2.4 }] },
    { id: 'descompressao', nome: 'Descompressão', x: 22, y: 16, largura: 8, profundidade: 6, piso: '#e3dcef', portas: [{ lado: 'norte', centro: 4, largura: 1.4 }] },
  ],
  mobilia,
}
