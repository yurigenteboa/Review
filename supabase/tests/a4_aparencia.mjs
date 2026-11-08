// Testes da migração A4 (aparência na conta) num Postgres local (PGlite) com todas as migrações.
// Rodar: npm i --no-save @electric-sql/pglite && node supabase/tests/a4_aparencia.mjs
import { setup, actor } from './harness.mjs'
const MIG = process.env.MIG_DIR || new URL('../migrations', import.meta.url).pathname
const { db } = await setup(MIG, { skip: ['pg_cron'] })
const as = actor(db)
const A = 'aaaaaaaa-0000-0000-0000-000000000001' // dono
const B = 'bbbbbbbb-0000-0000-0000-000000000002' // amigo de A
const C = 'cccccccc-0000-0000-0000-000000000003' // estranho
for (const u of [A, B, C]) await db.query(`insert into auth.users(id,email) values ($1,$2)`, [u, u.slice(0, 1) + '@x.com'])
await as(A, `update profiles set username='ana' where id=auth.uid()`)
await as(B, `update profiles set username='beto' where id=auth.uid()`)
// amizade A–B (par ordenado; direto no banco, como os outros testes)
await db.query(`insert into friendships(user_a,user_b,status,requested_by) values ($1,$2,'aceita',$1)`, [A, B]).catch(async () => {
  await db.query(`insert into friendships(user_a,user_b,status) values ($1,$2,'aceita')`, [A, B])
})

const one = async (uid, sql, p) => (await as(uid, sql, p)).rows[0]
const count = async (uid, sql, p) => (await as(uid, sql, p)).rows.length
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
const eq = (a, b, msg) => {
  if (String(a) !== String(b)) throw new Error(`${msg}: esperava ${b}, veio ${a}`)
  return a
}
const AP = JSON.stringify({ estilo: 'anos90', tema: 'escuro', destaque: 'roxo' })

// ---------- user_settings: só o dono ----------
await t('A grava a própria aparência (user_id vem sozinho)', async () => (await one(A, `insert into user_settings(aparencia) values ($1) returning user_id`, [AP])).user_id === A)
await t('A lê a própria', async () => (await one(A, `select aparencia->>'estilo' e from user_settings`)).e)
await t('A atualiza a própria', async () => {
  await as(A, `update user_settings set aparencia = aparencia || '{"tema":"claro"}', atualizado_em = now() where user_id = auth.uid()`)
  return (await one(A, `select aparencia->>'tema' t from user_settings`)).t
})
await t('amigo B não vê a de A', async () => eq(await count(B, `select * from user_settings where user_id=$1`, [A]), 0, 'linhas'))
await t('estranho C não vê nenhuma', async () => eq(await count(C, `select * from user_settings`), 0, 'linhas'))
await t('visitante não lê a tabela', () => as(null, `select * from user_settings`), true)
await t('visitante não grava', () => as(null, `insert into user_settings(user_id,aparencia) values ($1,'{}')`, [A]), true)
await t('B grava em nome de A', () => as(B, `insert into user_settings(user_id,aparencia) values ($1,'{}')`, [A]), true)
await t('B tenta mudar a de A: nada muda', async () => {
  await as(B, `update user_settings set aparencia='{"estilo":"vidro"}' where user_id=$1`, [A])
  return eq((await one(A, `select aparencia->>'estilo' e from user_settings`)).e, 'anos90', 'estilo')
})
await t('B tenta apagar a de A: continua lá', async () => {
  await as(B, `delete from user_settings where user_id=$1`, [A])
  return eq(await count(A, `select * from user_settings`), 1, 'linhas')
})
await t('A não consegue passar a linha para B', () => as(A, `update user_settings set user_id=$1`, [B]), true)
await t('aparência grande demais (> 2 KB)', () => as(B, `insert into user_settings(aparencia) values (jsonb_build_object('lixo', repeat('x', 5000)))`), true)
await t('aparência que não é objeto', () => as(B, `insert into user_settings(aparencia) values ('[1,2]')`), true)
await t('B grava a dele (uma linha por pessoa)', async () => (await one(B, `insert into user_settings(aparencia) values ('{"tema":"medio"}') returning 1 ok`)).ok)
await t('B não cria segunda linha', () => as(B, `insert into user_settings(aparencia) values ('{}')`), true)
await t('logado não tem TRUNCATE', () => as(A, `truncate user_settings`), true)
await t('A apaga a própria', async () => {
  await as(A, `delete from user_settings where user_id = auth.uid()`)
  return eq(await count(A, `select * from user_settings`), 0, 'linhas')
})

// ---------- profiles.cor_destaque: pública, lista fechada ----------
await t('A escolhe cor_destaque roxo', async () => (await one(A, `update profiles set cor_destaque='roxo' where id=auth.uid() returning cor_destaque c`)).c)
await t('cor fora da lista', () => as(A, `update profiles set cor_destaque='neon' where id=auth.uid()`), true)
await t('B não muda a cor de A', async () => {
  await as(B, `update profiles set cor_destaque='verde' where id=$1`, [A])
  return eq((await one(A, `select cor_destaque c from profiles where id=auth.uid()`)).c, 'roxo', 'cor')
})
await t('amigo B lê a cor de A', async () => (await one(B, `select cor_destaque c from profiles where id=$1`, [A])).c)
await t('A volta a cor para vazio', async () => {
  await as(A, `update profiles set cor_destaque=null where id=auth.uid()`)
  await as(A, `update profiles set cor_destaque='roxo' where id=auth.uid()`)
  return 'ok'
})

// ---------- public_profile ----------
await as(A, `insert into user_settings(aparencia) values ($1)`, [AP])
await t('visitante: public_profile traz cor_destaque', async () => (await one(null, `select public_profile('ana') j`)).j.profile.cor_destaque)
await t('visitante: public_profile não traz nada de user_settings', async () => {
  const j = JSON.stringify((await one(null, `select public_profile('@ana') j`)).j)
  if (j.includes('anos90') || j.includes('aparencia')) throw new Error('vazou: ' + j.slice(0, 120))
  return 'limpo'
})
await t('perfil privado: public_profile devolve nulo', async () => {
  await as(A, `update profiles set is_public=false where id=auth.uid()`)
  const j = (await one(null, `select public_profile('ana') j`)).j
  await as(A, `update profiles set is_public=true where id=auth.uid()`)
  return eq(j, null, 'retorno')
})
await t('apagar a conta leva a aparência junto', async () => {
  await db.query(`delete from friendships where user_a=$1 or user_b=$1`, [B]).catch(() => {})
  await db.query(`delete from auth.users where id=$1`, [B])
  return eq((await db.query(`select count(*) c from user_settings where user_id=$1`, [B])).rows[0].c, 0, 'linhas')
})

console.log(res.join('\n'))
const bad = res.filter((r) => r.startsWith('✗')).length
console.log(`\n${n} cenários, ${bad} falha(s)`)
process.exit(bad ? 1 : 0)
