// Testes da migração da Fase 2a num Postgres local (PGlite) com todas as migrações.
// Rodar: npm i --no-save @electric-sql/pglite && node supabase/tests/fase2_lugares.mjs
import { setup, actor } from './harness.mjs'
const MIG = process.env.MIG_DIR || new URL('../migrations', import.meta.url).pathname
// para testar o "backfill", cria um drink da fase 1 ANTES de rodar a 2a
const { db } = await setup(MIG, { skip: ['pg_cron', 'fase2_lugares'] })
const as = actor(db)
const A='aaaaaaaa-0000-0000-0000-000000000001', B='bbbbbbbb-0000-0000-0000-000000000002', C='cccccccc-0000-0000-0000-000000000003'
for (const u of [A,B,C]) await db.query(`insert into auth.users(id,email) values ($1,$2)`, [u, u.slice(0,1)+'@x.com'])
await db.query(`insert into public.friendships(user_a,user_b,requested_by,status) values ($1,$2,$1,'aceita')`, [A,B])
const one = async (uid, sql, p) => (await as(uid, sql, p)).rows[0]
const barAntigo = (await one(A, `insert into items(category,title,subtitle) values ('bar','Bar Antigo','Pinheiros, São Paulo') returning id`)).id
const negAntigo = (await one(A, `select ensure_child_item($1,'drink','Negroni') as id`, [barAntigo])).id
await db.exec((await import('fs')).readFileSync(MIG + '/202611071700_fase2_lugares.sql', 'utf8'))

const res=[]; let n=0
const t = async (name, fn, expectErr=false) => { n++; try { const v = await fn(); if (expectErr) res.push(`✗ ${name}: passou e devia falhar`); else res.push(`✓ ${name}${v!==undefined?' → '+v:''}`) } catch(e){ if (expectErr) res.push(`✓ ${name} (bloqueado: ${e.message.slice(0,70)})`); else res.push(`✗ ${name}: ${e.message}`) } }
const eq = (a,b,msg) => { if (String(a)!==String(b)) throw new Error(`${msg}: esperava ${b}, veio ${a}`); return a }

let generico
await t('backfill: Negroni da fase 1 ganhou o genérico', async () => { generico = (await one(A, `select to_item from item_links where from_item=$1 and tipo='e_um'`, [negAntigo])).to_item; return eq((await one(A, `select source from items where id=$1`, [generico])).source, 'generico', 'source') })
await t('categorias novas e onde drink pode morar', async () => (await one(null, `select string_agg(slug||':'||modo_nota, ' ' order by sort_order) s from categories where grupo='lugar'`)).s)
const rest = (await one(B, `insert into items(category,title,subtitle) values ('restaurante','Cantina X','Bela Vista, São Paulo') returning id`)).id
const cafe = (await one(C, `insert into items(category,title,subtitle) values ('cafe','Café Y','Pinheiros, São Paulo') returning id`)).id
let negRest
await t('Negroni dentro de restaurante, ligado ao MESMO genérico', async () => { negRest = (await one(B, `select ensure_child_item($1,'drink',' NEGRONI ') as id`, [rest])).id; return eq((await one(B, `select to_item from item_links where from_item=$1`, [negRest])).to_item, generico, 'genérico') })
await t('prato dentro de café ganha genérico próprio', async () => { const id = (await one(C, `select ensure_child_item($1,'prato','Pão de queijo') as id`, [cafe])).id; return (await one(C, `select g.title from item_links l join items g on g.id=l.to_item where l.from_item=$1`, [id])).title })
await t('banheiro no café não ganha genérico', async () => { const id = (await one(C, `select ensure_child_item($1,'banheiro','Banheiro') as id`, [cafe])).id; return eq(Number((await one(C, `select count(*) c from item_links where from_item=$1`, [id])).c), 0, 'ligações') })
await t('só existe UM genérico "Negroni"', async () => eq(Number((await one(A, `select count(*) c from items where source='generico' and lower(title)='negroni'`)).c), 1, 'genéricos'))
await t('insert direto de genérico repetido', () => as(A, `insert into items(category,title,source) values ('drink','negroni','generico')`), true)
await t('anon chama link_generic / best_places_for', () => as(null, `select best_places_for($1)`, [generico]), true)

// notas: A (amigos) 5,0 no Bar Antigo; B (privado) 4 na Cantina; C (público) 3 na Cantina; A de novo 4,5 depois (mais recente vale)
await as(A, `insert into reviews(item_id,rating,visibility,experienced_at) values ($1,5,'amigos','2026-10-01')`, [negAntigo])
await as(A, `insert into reviews(item_id,rating,visibility,experienced_at) values ($1,4.5,'amigos','2026-11-01')`, [negAntigo])
await as(B, `insert into reviews(item_id,rating,visibility) values ($1,4,'privado')`, [negRest])
await as(C, `insert into reviews(item_id,rating,visibility) values ($1,3,'publico')`, [negRest])
const best = async (uid, area) => (await as(uid, `select place_title, avg_rating, ratings from best_places_for($1,$2)`, [generico, area ?? null])).rows.map(r=>`${r.place_title} ${r.avg_rating??'-'}(${r.ratings})`).join(' | ')
await t('A vê: Bar Antigo 4,5 (só a mais recente) e Cantina só com a nota pública de C', () => best(A))
await t('B (amigo de A) vê a nota de A e a própria privada', () => best(B))
await t('C (estranho) não vê notas de amigos nem privadas', () => best(C))
await t('filtro por área "Pinheiros"', () => best(A, 'pinheiros'))

// apagar
await t('A não apaga o Bar Antigo (tem coisas dentro)', async () => { await as(A, `delete from items where id=$1`, [barAntigo]); return eq(Number((await one(A, `select count(*) c from items where id=$1`, [barAntigo])).c), 1, 'continua') })
const soMeu = (await one(A, `insert into items(category,title) values ('album','Meu álbum') returning id`)).id
await as(A, `insert into reviews(item_id,rating) values ($1,4)`, [soMeu])
await t('A apaga item que só ele usa', async () => { await as(A, `delete from items where id=$1`, [soMeu]); return eq(Number((await one(A, `select count(*) c from items where id=$1`, [soMeu])).c), 0, 'apagado') })
const usado = (await one(A, `insert into items(category,title) values ('filme','Filme de A') returning id`)).id
await as(B, `insert into reviews(item_id,rating,visibility) values ($1,2,'privado')`, [usado])
await t('A NÃO apaga item que B registrou (mesmo privado): reviews de B ficam', async () => { await as(A, `delete from items where id=$1`, [usado]); return eq(Number((await one(B, `select count(*) c from reviews where item_id=$1`, [usado])).c), 1, 'review de B') })
const naLista = (await one(A, `insert into items(category,title) values ('livro','Livro de A') returning id`)).id
await as(B, `insert into watchlist(item_id) values ($1)`, [naLista])
await t('A NÃO apaga item que está no "quero ler" de B', async () => { await as(A, `delete from items where id=$1`, [naLista]); return eq(Number((await one(A, `select count(*) c from items where id=$1`, [naLista])).c), 1, 'continua') })
await t('B não apaga item de A', async () => { const x = (await one(A, `insert into items(category,title) values ('jogo','Jogo de A') returning id`)).id; await as(B, `delete from items where id=$1`, [x]); return eq(Number((await one(A, `select count(*) c from items where id=$1`, [x])).c), 1, 'continua') })
await t('genérico não pode ser apagado (tem ligações)', async () => { await db.query(`update items set created_by=$1 where id=$2`, [A, generico]); await as(A, `delete from items where id=$1`, [generico]); return eq(Number((await one(A, `select count(*) c from items where id=$1`, [generico])).c), 1, 'continua') })
await t('anon chama item_in_use_by_others', () => as(null, `select item_in_use_by_others($1)`, [generico]), true)

// ranking por comparação
await t('A põe o Bar Antigo em "gostei" (amigos)', async () => { await as(A, `insert into place_ranks(category,item_id,bucket,pos) values ('bar',$1,3,1)`, [barAntigo]); return 'ok' })
await t('A põe a Cantina (restaurante) em "ok", público', async () => { await as(A, `insert into place_ranks(category,item_id,bucket,pos,visibility) values ('restaurante',$1,2,1,'publico')`, [rest]); return 'ok' })
await t('categoria errada (café como bar)', () => as(A, `insert into place_ranks(category,item_id,bucket,pos) values ('bar',$1,3,2)`, [cafe]), true)
await t('grupo inválido (4)', () => as(A, `insert into place_ranks(category,item_id,bucket,pos) values ('cafe',$1,4,2)`, [cafe]), true)
await t('B grava no ranking de A', () => as(B, `insert into place_ranks(user_id,category,item_id,bucket,pos) values ($1,'cafe',$2,3,1)`, [A, cafe]), true)
await t('B (amigo) vê os 2 do ranking de A', async () => eq(Number((await one(B, `select count(*) c from place_ranks where user_id=$1`, [A])).c), 2, 'linhas'))
await t('C (estranho) vê só o público', async () => eq(Number((await one(C, `select count(*) c from place_ranks where user_id=$1`, [A])).c), 1, 'linhas'))
await t('visitante não lê ranking', () => as(null, `select * from place_ranks`), true)
await t('B tenta mudar a ordem de A: nada muda', async () => { await as(B, `update place_ranks set pos=99 where user_id=$1`, [A]); return eq((await one(A, `select max(pos) m from place_ranks where user_id=$1`, [A])).m, 1, 'pos') })
await t('A reordena o próprio (pos entre vizinhos)', async () => { await as(A, `update place_ranks set pos=0.5 where item_id=$1`, [barAntigo]); return (await one(A, `select pos from place_ranks where item_id=$1`, [barAntigo])).pos })

// o que já existia continua
await t('fase 1: filha ainda copia a visibilidade da mãe', async () => { const mae = (await one(A, `insert into reviews(item_id,rating,visibility) values ($1,4,'publico') returning id`, [barAntigo])).id; return (await one(A, `insert into reviews(item_id,rating,visibility,parent_review_id) values ($1,4,'privado',$2) returning visibility`, [negAntigo, mae])).visibility })

console.log(res.join('\n')); const bad = res.filter(r=>r.startsWith('✗')).length; console.log(`\n${n} cenários, ${bad} falha(s)`)
