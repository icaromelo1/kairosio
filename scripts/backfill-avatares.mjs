// Dá um avatar a cada personagem que já existe.
//
// A tabela `avatares` nasce vazia de gente: o synchronize cria a estrutura, nunca o
// conteúdo. Sem esta passada, todo personagem anterior fica com avatarId nulo — ou
// seja, sem avatar — e o jogo cai no corpo padrão para todo mundo.
//
// Também é aqui que o hairStyle legado morre: o default do banco era 'short', que é
// resto do avatar procedural e não corresponde a corpo nenhum.
//
// Uso:
//   node scripts/backfill-avatares.mjs --seco      mostra o que faria
//   node scripts/backfill-avatares.mjs --aplicar   grava
import pg from 'pg'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))

function urlDoBanco() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const env = readFileSync(join(AQUI, '..', 'kairos-api/.env'), 'utf8')
  const linha = env.split('\n').find((l) => l.startsWith('DATABASE_URL='))
  if (!linha) throw new Error('DATABASE_URL não encontrada')
  return linha.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '')
}

const CORPOS = JSON.parse(
  readFileSync(join(AQUI, '..', 'kairos-ui/src/game/furniture/avatar/presets.json'), 'utf8'),
).map((c) => c.id)
const CORPO_PADRAO = CORPOS[0]

// sanitizeLook do front trata cor igual à padrão como "não escolheu"; o backfill
// segue a mesma regra, senão criaria avatar personalizado para quem nunca escolheu
const COR_PADRAO = { hairColor: '#3d2817', skin: '#e8b894', topColor: '#2c7441' }
const usar = (v, padrao) => (v && v.toLowerCase() !== padrao ? v : null)

const aplicar = process.argv.includes('--aplicar')
const seco = process.argv.includes('--seco')
if (aplicar === seco) {
  console.error('Escolha exatamente um: --seco ou --aplicar')
  process.exit(2)
}

const cliente = new pg.Client({ connectionString: urlDoBanco() })
await cliente.connect()

const { rows: personagens } = await cliente.query(
  `SELECT c.id, c."hairStyle", c."hairColor", c.skin, c."topColor", c."avatarId", c."userId"
   FROM characters c WHERE c."avatarId" IS NULL`,
)
const { rows: avatares } = await cliente.query(
  `SELECT id, base, pele, cabelo, roupa, origem FROM avatares`,
)

if (!avatares.length) {
  console.error('A tabela avatares está vazia — suba a API uma vez para semear os 6 corpos.')
  process.exit(1)
}

const chave = (base, pele, cabelo, roupa) => `${base}|${pele ?? ''}|${cabelo ?? ''}|${roupa ?? ''}`
const existente = new Map(avatares.map((a) => [chave(a.base, a.pele, a.cabelo, a.roupa), a.id]))

let reaproveitados = 0
let criados = 0
let corpoNormalizado = 0
const aCriar = []
const aLigar = []

for (const p of personagens) {
  const base = CORPOS.includes(p.hairStyle) ? p.hairStyle : CORPO_PADRAO
  if (base !== p.hairStyle) corpoNormalizado++
  const pele = usar(p.skin, COR_PADRAO.skin)
  const cabelo = usar(p.hairColor, COR_PADRAO.hairColor)
  const roupa = usar(p.topColor, COR_PADRAO.topColor)
  const k = chave(base, pele, cabelo, roupa)

  let idAvatar = existente.get(k)
  if (idAvatar) {
    reaproveitados++
  } else {
    idAvatar = `novo:${aCriar.length}`
    aCriar.push({ marcador: idAvatar, base, pele, cabelo, roupa, dono: p.userId })
    existente.set(k, idAvatar)
    criados++
  }
  aLigar.push({ personagem: p.id, avatar: idAvatar })
}

console.log(`personagens sem avatar: ${personagens.length}`)
console.log(`  reaproveitam avatar existente: ${reaproveitados}`)
console.log(`  exigem avatar novo:            ${criados}`)
console.log(`  hairStyle legado normalizado:  ${corpoNormalizado}`)

if (seco) {
  console.log(`\n[seco] ${aLigar.length} personagem(ns) ganhariam avatar — nada foi escrito.`)
  await cliente.end()
  process.exit(0)
}

await cliente.query('BEGIN')
try {
  const idReal = new Map()
  for (const novo of aCriar) {
    const { rows } = await cliente.query(
      `INSERT INTO avatares (base, pele, cabelo, roupa, acessorios, origem, "criadoPorId")
       VALUES ($1,$2,$3,$4,'[]'::jsonb,'usuario',$5) RETURNING id`,
      [novo.base, novo.pele, novo.cabelo, novo.roupa, novo.dono],
    )
    idReal.set(novo.marcador, rows[0].id)
  }
  for (const l of aLigar) {
    const id = l.avatar.startsWith('novo:') ? idReal.get(l.avatar) : l.avatar
    await cliente.query('UPDATE characters SET "avatarId" = $1 WHERE id = $2', [id, l.personagem])
  }
  await cliente.query('COMMIT')
} catch (e) {
  await cliente.query('ROLLBACK')
  throw e
}

const { rows: sobrou } = await cliente.query(
  'SELECT COUNT(*)::int AS n FROM characters WHERE "avatarId" IS NULL',
)
console.log(`\ngravado. personagens ainda sem avatar: ${sobrou[0].n} (tem que ser 0)`)
await cliente.end()
process.exit(sobrou[0].n === 0 ? 0 : 1)
