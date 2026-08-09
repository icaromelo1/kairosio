import { readFileSync } from 'node:fs'
import { io } from 'socket.io-client'

const API = 'https://icaromelodev.com.br'
const SOCKET_PATH = '/kairos-api/socket.io'
const MAPA = 'cidade'

const tok = (n) => readFileSync(`/tmp/t-${n}.txt`, 'utf8').trim()

const BOTS = [
  { nome: 'bruno', sala: 'biblioteca-leitura', x: 43, y: 8, hair: 'operario' },
  { nome: 'caio', sala: 'biblioteca-leitura', x: 45, y: 11, hair: 'cabelo-lilas' },
  { nome: 'diana', sala: 'praca-central', x: 47, y: 42, hair: 'cabelo-lilas' },
  { nome: 'elias', sala: 'teatro-palco', x: 74, y: 72, hair: 'cientista' },
]

const ROTEIRO = [
  { de: 'diana', escopo: 'mundo', texto: 'bom dia gente!' },
  { de: 'elias', escopo: 'mundo', texto: 'bom dia diana' },
  { de: 'diana', escopo: 'mundo', texto: 'alguém sabe se a reunião é aqui ou na prefeitura?' },
  { de: 'bruno', escopo: 'mundo', texto: 'é na prefeitura, sala de reunião' },
  { de: 'diana', escopo: 'mundo', texto: 'valeu!' },
  { de: 'bruno', escopo: 'sala', texto: 'caio, achou o livro?' },
  { de: 'caio', escopo: 'sala', texto: 'achei, tava no acervo' },
  { de: 'bruno', escopo: 'sala', texto: 'boa, traz pra cá' },
  { de: 'caio', escopo: 'sala', texto: 'já tô indo' },
  { de: 'elias', escopo: 'mundo', texto: 'vou ensaiar no palco, se alguém quiser assistir' },
  { de: 'diana', escopo: 'sala', texto: 'tem alguém aqui na praça?' },
  { de: 'diana', escopo: 'sala', texto: 'vou esperar mais uns minutos' },
]

const sockets = new Map()
const espera = (ms) => new Promise((r) => setTimeout(r, ms))

for (const b of BOTS) {
  const s = io(API, { path: SOCKET_PATH, transports: ['websocket'], auth: { token: tok(b.nome) } })
  sockets.set(b.nome, s)
  await new Promise((ok, erro) => {
    s.once('connect', ok)
    s.once('connect_error', erro)
  })
  s.emit('join', {
    name: `${b.nome}${readFileSync('/tmp/sufixo.txt', 'utf8').trim()}`,
    avatar: { hairStyle: b.hair, escala: 0.8 },
    map: MAPA,
    x: b.x,
    y: b.y,
  })
  await espera(250)
  s.emit('move', { x: b.x, y: b.y, facing: 'down', pose: 'idle' })
  console.log(`${b.nome} entrou em ${b.sala} (${b.x},${b.y})`)
}

await espera(800)

for (const linha of ROTEIRO) {
  sockets.get(linha.de).emit('chat', { text: linha.texto, escopo: linha.escopo })
  console.log(`  [${linha.escopo}] ${linha.de}: ${linha.texto}`)
  await espera(700)
}

console.log('\nbots no ar. mantendo conexão — Ctrl+C ou kill para encerrar.')
setInterval(() => {
  for (const [nome, s] of sockets) {
    const b = BOTS.find((x) => x.nome === nome)
    s.emit('move', { x: b.x, y: b.y, facing: 'down', pose: 'idle' })
  }
}, 20000)
