// Testes da migração da Fase 1 num Postgres local (PGlite) com todas as migrações.
// Rodar: npm i --no-save @electric-sql/pglite && node supabase/tests/fase1_ligacoes.mjs
import { setup, actor } from './harness.mjs'
const { db } = await setup(new URL('../migrations', import.meta.url).pathname, { skip: ['pg_cron'] })
const as = actor(db)
const A='aaaaaaaa-0000-0000-0000-000000000001', B='bbbbbbbb-0000-0000-0000-000000000002', C='cccccccc-0000-0000-0000-000000000003'
for (const u of [A,B,C]) await db.query(`insert into auth.users(id,email) values ($1,$2)`, [u, u.slice(0,1)+'@x.com'])
await db.query(`insert into public.friendships(user_a,user_b,requested_by,status) values ($1,$2,$1,'aceita')`, [A,B])
const res=[]; let n=0
const t = async (name, fn, expectErr=false) => { n++; try { const v = await fn(); if (expectErr) res.push(`✗ ${name}: passou e devia falhar`); else res.push(`✓ ${name}${v!==undefined?' → '+v:''}`) } catch(e){ if (expectErr) res.push(`✓ ${name} (bloqueado: ${e.message.slice(0,70)})`); else res.push(`✗ ${name}: ${e.message}`) } }
const one = async (uid, sql, p) => (await as(uid, sql, p)).rows[0]
const eq = (a,b,msg) => { if (a!==b) throw new Error(`${msg}: esperava ${b}, veio ${a}`); return a }

const bar = (await one(A, `insert into items(category,title) values ('bar','Bar Brahma') returning id`)).id
const album = (await one(A, `insert into items(category,title) values ('album','Clube da Esquina') returning id`)).id
let negroni
await t('A cria Negroni no bar (ensure_child_item)', async () => { negroni = (await one(A, `select ensure_child_item($1,'drink','Negroni') as id`, [bar])).id; return 'ok' })
await t('A de novo com " negroni " devolve o mesmo item', async () => eq((await one(A, `select ensure_child_item($1,'drink',' negroni ') as id`, [bar])).id, negroni, 'id'))
await t('B (amigo) pede Negroni no mesmo bar: mesmo item, sem duplicar', async () => eq((await one(B, `select ensure_child_item($1,'drink','NEGRONI') as id`, [bar])).id, negroni, 'id'))
await t('C (estranho) também usa o catálogo: mesmo item', async () => eq((await one(C, `select ensure_child_item($1,'drink','Negroni') as id`, [bar])).id, negroni, 'id'))
await t('insert direto de duplicado no mesmo bar', () => as(A, `insert into items(category,title,parent_id) values ('drink','negroni',$1)`, [bar]), true)
await t('drink dentro de álbum', () => as(A, `select ensure_child_item($1,'drink','x')`, [album]), true)
await t('drink dentro de drink', () => as(A, `select ensure_child_item($1,'drink','x')`, [negroni]), true)
await t('álbum dentro de bar', () => as(A, `insert into items(category,title,parent_id) values ('album','x',$1)`, [bar]), true)
let banheiro, prato
await t('banheiro dentro do bar', async () => { banheiro = (await one(A, `select ensure_child_item($1,'banheiro','Banheiro') as id`, [bar])).id; return 'ok' })
await t('prato dentro do bar', async () => { prato = (await one(B, `select ensure_child_item($1,'prato','Coxinha') as id`, [bar])).id; return 'ok' })
await t('visitante (anon) não chama ensure_child_item', () => as(null, `select ensure_child_item($1,'drink','x')`, [bar]), true)
await t('nome vazio', () => as(A, `select ensure_child_item($1,'drink','   ')`, [bar]), true)
await t('item morar em si mesmo', () => as(A, `update items set parent_id = id where id = $1`, [bar]), true)

// entrada composta
let mae, filha
await t('A registra a noite no bar (amigos, 06/11)', async () => { mae = (await one(A, `insert into reviews(item_id,rating,visibility,experienced_at) values ($1,4,'amigos','2026-11-06') returning id`, [bar])).id; return 'ok' })
await t('A registra Negroni como filha pedindo "publico" e outra data: herda amigos e 06/11', async () => {
  const r = await one(A, `insert into reviews(item_id,rating,visibility,experienced_at,parent_review_id) values ($1,4.5,'publico','2026-01-01',$2) returning id, visibility, experienced_at::text as d`, [negroni, mae]); filha = r.id
  eq(r.visibility,'amigos','visibilidade'); return eq(r.d,'2026-11-06','data') })
await t('A registra banheiro e prato como filhas (lote)', async () => { const r = await as(A, `insert into reviews(item_id,rating,parent_review_id) values ($1,2,$3),($2,3.5,$3) returning id`, [banheiro, prato, mae]); return eq(r.rows.length,2,'linhas') })
await t('B (amigo) vê as filhas', async () => eq(Number((await one(B, `select count(*) c from reviews where parent_review_id=$1`, [mae])).c), 3, 'filhas'))
await t('C (estranho) não vê as filhas', async () => eq(Number((await one(C, `select count(*) c from reviews where parent_review_id=$1`, [mae])).c), 0, 'filhas'))
await t('A muda a mãe para publico: filhas acompanham', async () => { await as(A, `update reviews set visibility='publico', experienced_at='2026-11-05' where id=$1`, [mae]); const r = await one(A, `select visibility, experienced_at::text d from reviews where id=$1`, [filha]); eq(r.visibility,'publico','vis'); return eq(r.d,'2026-11-05','data') })
await t('C agora vê as filhas', async () => eq(Number((await one(C, `select count(*) c from reviews where parent_review_id=$1`, [mae])).c), 3, 'filhas'))
await t('A tenta mudar só a filha para privado: continua como a mãe', async () => { await as(A, `update reviews set visibility='privado' where id=$1`, [filha]); return eq((await one(A, `select visibility from reviews where id=$1`, [filha])).visibility, 'publico', 'vis') })
await t('B pendura filha na entrada de A', () => as(B, `insert into reviews(item_id,rating,parent_review_id) values ($1,5,$2)`, [negroni, mae]), true)
await t('A pendura filha de item que não mora no bar (álbum)', () => as(A, `insert into reviews(item_id,rating,parent_review_id) values ($1,5,$2)`, [album, mae]), true)
await t('neta (filha de filha)', () => as(A, `insert into reviews(item_id,rating,parent_review_id) values ($1,5,$2)`, [negroni, filha]), true)
await t('B vê a mãe pública e curte a filha', async () => { await as(B, `insert into likes(review_id) values ($1)`, [filha]); return 'ok' })
await t('A não consegue apagar o bar que tem coisas dentro', () => as(A, `delete from items where id=$1`, [bar]), true)
await t('A apaga a noite: as filhas vão junto', async () => { await as(A, `delete from reviews where id=$1`, [mae]); return eq(Number((await one(A, `select count(*) c from reviews where parent_review_id=$1 or id=$2`, [mae, filha])).c), 0, 'restou') })

// ligações
let generico
await t('A cria o Negroni genérico (sem lugar)', async () => { generico = (await one(A, `insert into items(category,title) values ('drink','Negroni') returning id`)).id; return 'ok' })
await t('A liga Negroni do Bar Brahma É UM Negroni', async () => { await as(A, `insert into item_links(from_item,to_item,tipo) values ($1,$2,'e_um')`, [negroni, generico]); return 'ok' })
await t('segundo e_um para o mesmo item', async () => { const g2 = (await one(A, `insert into items(category,title) values ('drink','Negroni Sbagliato') returning id`)).id; return as(A, `insert into item_links(from_item,to_item,tipo) values ($1,$2,'e_um')`, [negroni, g2]) }, true)
await t('e_um ao contrário (genérico -> do bar)', () => as(A, `insert into item_links(from_item,to_item,tipo) values ($1,$2,'e_um')`, [generico, negroni]), true)
await t('e_um entre categorias diferentes', () => as(A, `insert into item_links(from_item,to_item,tipo) values ($1,$2,'e_um')`, [prato, generico]), true)
await t('tipo de ligação desconhecido', () => as(A, `insert into item_links(from_item,to_item,tipo) values ($1,$2,'qualquer')`, [prato, generico]), true)
const coxGen = (await one(B, `insert into items(category,title) values ('prato','Coxinha') returning id`)).id
await t('B cria ligação válida em nome de A (RLS)', () => as(B, `insert into item_links(from_item,to_item,tipo,created_by) values ($1,$2,'e_um',$3)`, [prato, coxGen, A]), true)
await t('B cria a mesma ligação em nome próprio', async () => { await as(B, `insert into item_links(from_item,to_item,tipo) values ($1,$2,'e_um')`, [prato, coxGen]); return 'ok' })
await t('B apaga a própria ligação', async () => { await as(B, `delete from item_links where from_item=$1`, [prato]); return eq(Number((await one(A, `select count(*) c from item_links`)).c), 1, 'ligações') })
await t('B lê as ligações', async () => eq(Number((await one(B, `select count(*) c from item_links`)).c), 1, 'ligações'))
await t('B tenta apagar a ligação de A: nada some', async () => { await as(B, `delete from item_links`); return eq(Number((await one(A, `select count(*) c from item_links`)).c), 1, 'ligações') })
await t('B tenta editar a ligação de A', () => as(B, `update item_links set tipo='e_um'`), true)
await t('visitante lê ligações', () => as(null, `select * from item_links`), true)
await t('visitante lê categorias com os campos novos', async () => (await one(null, `select string_agg(slug||':'||grupo||':'||array_to_string(mora_em,','), ' ' order by sort_order) s from categories`)).s)

// fusão
await t('logado chama admin.merge_items', () => as(A, `select admin.merge_items($1,$2)`, [generico, generico]), true)
await t('logado escreve em item_redirects', () => as(A, `insert into item_redirects(old_id,new_id) values (gen_random_uuid(),$1)`, [bar]), true)
const bar2 = (await one(B, `insert into items(category,title) values ('bar','Bar Brahma (dup)') returning id`)).id
await as(B, `insert into reviews(item_id,rating,visibility) values ($1,3,'publico')`, [bar2])
await as(B, `insert into watchlist(item_id) values ($1)`, [bar2]); await as(B, `insert into watchlist(item_id) values ($1)`, [bar])
const chope = (await one(B, `select ensure_child_item($1,'drink','Chope') as id`, [bar2])).id
await t('dono funde o duplicado no bar certo', async () => (await db.query(`select admin.merge_items($1,$2) r`, [bar2, bar])).rows[0].r)
await t('review de B passou para o bar certo', async () => eq(Number((await one(B, `select count(*) c from reviews where item_id=$1 and user_id=$2`, [bar, B])).c), 1, 'reviews'))
await t('quero ver de B não ficou repetido', async () => eq(Number((await one(B, `select count(*) c from watchlist where user_id=$1`, [B])).c), 1, 'watchlist'))
await t('Chope passou a morar no bar certo', async () => eq((await one(B, `select parent_id from items where id=$1`, [chope])).parent_id, bar, 'parent'))
await t('link antigo do duplicado redireciona', async () => eq((await one(C, `select new_id from item_redirects where old_id=$1`, [bar2])).new_id, bar, 'redirect'))
const bar3 = (await one(C, `insert into items(category,title) values ('bar','Brahma 3') returning id`)).id
await as(C, `select ensure_child_item($1,'drink','Negroni')`, [bar3])
await t('fusão com filho de mesmo nome dos dois lados para e não mexe em nada', () => db.query(`select admin.merge_items($1,$2)`, [bar3, bar]), true)
await t('...e o duplicado continua lá', async () => eq(Number((await one(C, `select count(*) c from items where id=$1`, [bar3])).c), 1, 'item'))

// o que já existia continua igual
await t('B não edita item de A (regra antiga)', async () => { await as(B, `update items set title='x' where id=$1`, [bar]); return eq((await one(A, `select title from items where id=$1`, [bar])).title, 'Bar Brahma', 'título') })
await t('registro comum (sem mãe) segue igual', async () => { await as(C, `insert into reviews(item_id,rating,visibility) values ($1,5,'privado')`, [album]); return eq(Number((await one(A, `select count(*) c from reviews where user_id=$1`, [C])).c), 0, 'A vê privado de C') })

console.log(res.join('\n')); const bad = res.filter(r=>r.startsWith('✗')).length; console.log(`\n${n} cenários, ${bad} falha(s)`)
