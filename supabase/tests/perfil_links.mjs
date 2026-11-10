// Testes da migração "links sem o limite de 5" num Postgres local (PGlite) com todas as migrações.
// Rodar: npm run test:banco
import { setup, actor } from './harness.mjs'
const MIG = process.env.MIG_DIR || new URL('../migrations', import.meta.url).pathname
const { db } = await setup(MIG, { skip: ['pg_cron'] })
const as = actor(db)
const A = 'aaaaaaaa-0000-0000-0000-000000000001'
const B = 'bbbbbbbb-0000-0000-0000-000000000002'
for (const u of [A, B]) await db.query(`insert into auth.users(id,email) values ($1,$2)`, [u, u.slice(0, 1) + '@x.com'])
await as(A, `update profiles set username='ana', is_public=true where id=auth.uid()`)

const res = []
let n = 0
const t = async (name, fn, expectErr = false) => {
  n++
  try {
    const v = await fn()
    if (expectErr) res.push(`✗ ${name}: passou e devia falhar`)
    else res.push(`✓ ${name}${v !== undefined ? ' → ' + v : ''}`)
  } catch (e) {
    if (expectErr) res.push(`✓ ${name} (bloqueado: ${e.message.slice(0, 70)})`)
    else res.push(`✗ ${name}: ${e.message}`)
  }
}
const links = (k, extra = {}) => JSON.stringify(Array.from({ length: k }, (_, i) => ({ label: `L${i}`, url: `https://exemplo.com/${i}`, ...extra })))
const save = (uid, json) => as(uid, `update profiles set links=$1::jsonb where id=auth.uid() returning jsonb_array_length(links) n`, [json])

await t('6 links (antes era o limite de 5)', async () => (await save(A, links(6))).rows[0].n)
await t('20 links', async () => (await save(A, links(20))).rows[0].n)
await t('50 links (o teto)', async () => (await save(A, links(50))).rows[0].n)
await t('51 links: barrado', () => save(A, links(51)), true)
await t('link sem https continua barrado', () => save(A, JSON.stringify([{ label: 'x', url: 'http://exemplo.com' }])), true)
await t('javascript: continua barrado', () => save(A, JSON.stringify([{ label: 'x', url: 'javascript:alert(1)' }])), true)
await t('nome com mais de 40 continua barrado', () => save(A, JSON.stringify([{ label: 'x'.repeat(41), url: 'https://exemplo.com' }])), true)
await t('endereço com mais de 300 continua barrado', () => save(A, JSON.stringify([{ label: 'x', url: 'https://exemplo.com/' + 'a'.repeat(300) }])), true)
await t('B não muda os links de A', async () => {
  await as(B, `update profiles set links='[]' where id=$1`, [A])
  const k = (await db.query(`select jsonb_array_length(links) n from profiles where id=$1`, [A])).rows[0].n
  if (k !== 50) throw new Error('mudou: ' + k)
  return k
})
await t('perfil público devolve os 50', async () => (await as(null, `select jsonb_array_length(public_profile('ana')->'profile'->'links') n`)).rows[0].n)

console.log(res.join('\n'))
const bad = res.filter((r) => r.startsWith('✗')).length
console.log(`\n${n} cenários, ${bad} falha(s)`)
process.exit(bad ? 1 : 0)
