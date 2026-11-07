// Testes da migração da Fase 2d (ficha do lugar e sugestões) num Postgres local (PGlite) com todas as migrações.
// Rodar: npm i --no-save @electric-sql/pglite && node supabase/tests/fase2_sugestoes.mjs
import { setup, actor } from './harness.mjs'
const MIG = process.env.MIG_DIR || new URL('../migrations', import.meta.url).pathname
const { db } = await setup(MIG, { skip: ['pg_cron'] })
const as = actor(db)
const A='aaaaaaaa-0000-0000-0000-000000000001', B='bbbbbbbb-0000-0000-0000-000000000002', C='cccccccc-0000-0000-0000-000000000003', D='dddddddd-0000-0000-0000-000000000004'
for (const u of [A,B,C,D]) await db.query(`insert into auth.users(id,email) values ($1,$2)`, [u, u.slice(0,1)+'@x.com'])
const one = async (uid, sql, p) => (await as(uid, sql, p)).rows[0]
const res=[]; let n=0
const t = async (name, fn, expectErr=false) => { n++; try { const v = await fn(); if (expectErr) res.push(`✗ ${name}: passou e devia falhar`); else res.push(`✓ ${name}${v!==undefined?' → '+v:''}`) } catch(e){ if (expectErr) res.push(`✓ ${name} (bloqueado: ${e.message.slice(0,70)})`); else res.push(`✗ ${name}: ${e.message}`) } }
const eq = (a,b,msg) => { if (String(a)!==String(b)) throw new Error(`${msg}: esperava ${b}, veio ${a}`); return a }

// A cadastrou o bar; B foi 3 vezes; C foi 1 vez; D nunca foi
const bar = (await one(A, `insert into items(category,title,subtitle) values ('bar','Bar Brahma','Centro') returning id`)).id
for (let i=0;i<3;i++) await as(B, `insert into reviews(item_id,rating,visibility) values ($1,4,'privado')`, [bar])
await as(C, `insert into reviews(item_id,rating) values ($1,3)`, [bar])
const album = (await one(A, `insert into items(category,title) values ('album','Disco') returning id`)).id

let s1
await t('C sugere horário: fica pendente (só 1 registro)', async () => { const r = await one(C, `insert into place_suggestions(item_id,field,value) values ($1,'horario','"Seg a sáb, 11h–1h"') returning id, status`, [bar]); s1 = r.id; return eq(r.status, 'pendente', 'status') })
await t('...e a ficha ainda não mudou', async () => eq((await one(A, `select metadata->'ficha'->>'horario' h from items where id=$1`, [bar])).h, null, 'horario'))
await t('C tenta aprovar a própria sugestão', () => as(C, `select decide_suggestion($1,true)`, [s1]), true)
await t('D (nunca foi) tenta aprovar', () => as(D, `select decide_suggestion($1,true)`, [s1]), true)
await t('B (3 registros, mesmo privados) aprova', async () => (await one(B, `select decide_suggestion($1,true) r`, [s1])).r)
await t('...a ficha mudou', async () => (await one(D, `select metadata->'ficha'->>'horario' h from items where id=$1`, [bar])).h)
await t('decidir de novo a mesma sugestão', () => as(A, `select decide_suggestion($1,false)`, [s1]), true)
await t('B sugere faixa de preço: aplica na hora (pode decidir)', async () => { const r = await one(B, `insert into place_suggestions(item_id,field,value) values ($1,'faixa_preco','2') returning status`, [bar]); eq(r.status,'aprovada','status'); return (await one(D, `select metadata->'ficha'->>'faixa_preco' f from items where id=$1`, [bar])).f })
await t('A (criador) muda o bairro: aplica na hora no subtitle', async () => { await as(A, `insert into place_suggestions(item_id,field,value) values ($1,'area','"Centro, São Paulo"')`, [bar]); return (await one(D, `select subtitle from items where id=$1`, [bar])).subtitle })
await t('as duas chaves da ficha convivem', async () => (await one(D, `select metadata->'ficha' f from items where id=$1`, [bar])).f && JSON.stringify((await one(D, `select metadata->'ficha' f from items where id=$1`, [bar])).f))
let s2
await t('D sugere atributos; A (criador) recusa', async () => { s2 = (await one(D, `insert into place_suggestions(item_id,field,value) values ($1,'atributos','["musica_ao_vivo","pet_friendly"]') returning id`, [bar])).id; return (await one(A, `select decide_suggestion($1,false) r`, [s2])).r })
await t('...recusada não muda a ficha', async () => eq((await one(D, `select metadata->'ficha'->'atributos' a from items where id=$1`, [bar])).a, null, 'atributos'))
await t('atributo desconhecido', () => as(D, `insert into place_suggestions(item_id,field,value) values ($1,'atributos','["festa_do_pijama"]')`, [bar]), true)
await t('faixa de preço 7', () => as(D, `insert into place_suggestions(item_id,field,value) values ($1,'faixa_preco','7')`, [bar]), true)
await t('link sem https', () => as(D, `insert into place_suggestions(item_id,field,value) values ($1,'link','"http://x.com"')`, [bar]), true)
await t('campo desconhecido', () => as(D, `insert into place_suggestions(item_id,field,value) values ($1,'dono','"eu"')`, [bar]), true)
await t('sugestão em álbum (não é lugar)', () => as(D, `insert into place_suggestions(item_id,field,value) values ($1,'horario','"sempre"')`, [album]), true)
await t('D sugere em nome de C', () => as(D, `insert into place_suggestions(item_id,user_id,field,value) values ($1,$2,'horario','"x y z"')`, [bar, C]), true)
await t('D tenta forçar status aprovada no insert: vira pendente', async () => (await one(D, `insert into place_suggestions(item_id,field,value,status) values ($1,'endereco','"Av. São João, 677"','aprovada') returning status`, [bar])).status)
await t('...e o endereço NÃO foi aplicado', async () => eq((await one(D, `select metadata->'ficha'->>'endereco' e from items where id=$1`, [bar])).e, null, 'endereço'))
await t('D tenta aprovar via update direto', async () => { await as(D, `update place_suggestions set status='aprovada'`); return 'sem efeito?' }, true)
await t('D tenta apagar sugestões', () => as(D, `delete from place_suggestions`), true)
await t('todos logados leem as sugestões', async () => Number((await one(C, `select count(*) c from place_suggestions where item_id=$1`, [bar])).c))
await t('visitante não lê sugestões', () => as(null, `select * from place_suggestions`), true)
await t('visitante não chama decide_suggestion', () => as(null, `select decide_suggestion(gen_random_uuid(), true)`), true)
await t('logado não lê app_admins', () => as(A, `select * from app_admins`), true)
// admin
await db.query(`insert into app_admins(user_id) values ($1)`, [D])
const pend = (await one(C, `select id from place_suggestions where field='endereco' and status='pendente'`)).id
await t('D virou admin: aprova a própria sugestão', async () => (await one(D, `select decide_suggestion($1,true) r`, [pend])).r)
await t('...endereço aplicado', async () => (await one(C, `select metadata->'ficha'->>'endereco' e from items where id=$1`, [bar])).e)
await t('can_curate_item: C não, B sim', async () => `${(await one(C, `select can_curate_item($1) v`, [bar])).v}/${(await one(B, `select can_curate_item($1) v`, [bar])).v}`)
console.log(res.join('\n')); const bad = res.filter(r=>r.startsWith('✗')).length; console.log(`\n${n} cenários, ${bad} falha(s)`)
