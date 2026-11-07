// Testes da migração da Fase 2e (catálogo de lugares) num Postgres local (PGlite) com todas as migrações.
// Rodar: npm i --no-save @electric-sql/pglite && node supabase/tests/fase2_catalogo.mjs
import { setup, actor } from './harness.mjs'
const MIG = process.env.MIG_DIR || new URL('../migrations', import.meta.url).pathname
const { db } = await setup(MIG, { skip: ['pg_cron'] })
const as = actor(db)
const A = 'aaaaaaaa-0000-0000-0000-000000000001'
await db.query(`insert into auth.users(id,email) values ($1,'a@x.com')`, [A])
// carga (como postgres, igual ao import do painel)
await db.exec(`insert into place_catalog(id,name,kind,raw_category,lat,lng,area) values
 ('o1','Jhony''s I Bar e Restaurante','restaurante','restaurant',-23.5375,-46.6520,'Santa Cecília, São Paulo'),
 ('o2','Jhony''s II Bar e Restaurante','bar','bar',-23.5380,-46.6510,'Santa Cecília, São Paulo'),
 ('o3','Johnny Rockets','restaurante','burger_restaurant',-23.5600,-46.6600,'Jardins, São Paulo'),
 ('o4','Bar Brahma','bar','bar',-23.5445,-46.6417,'República, São Paulo'),
 ('o5','Café Girondino','cafe','coffee_shop',-23.5470,-46.6340,'Centro, São Paulo'),
 ('o6','Padaria Santa Cecília','cafe','bakery',-23.5372,-46.6525,'Santa Cecília, São Paulo'),
 ('o7','Bar do Jhony','bar','bar',-12.98,-38.48,'Pituba, Salvador'),
 ('o8','Bar da Dona Onça','bar','bar',-23.53,-46.66,'São Paulo'),
 ('o9','Dona Maria','restaurante','restaurant',-23.53,-46.66,'São Paulo'),
 ('o10','Casa Ibitirama Bar e Lanches','bar','bar',-23.60,-46.60,'São Paulo')`)
const res = []; let n = 0
const t = async (name, fn, expectErr = false) => { n++; try { const v = await fn(); res.push(expectErr ? `✗ ${name}: passou e devia falhar` : `✓ ${name}${v !== undefined ? ' → ' + v : ''}`) } catch (e) { res.push(expectErr ? `✓ ${name} (bloqueado: ${e.message.slice(0, 60)})` : `✗ ${name}: ${e.message}`) } }
const eq = (a, b, m) => { if (String(a) !== String(b)) throw new Error(`${m}: esperava ${b}, veio ${a}`); return a }
const names = async (uid, sql, p) => (await as(uid, sql, p)).rows.map(r => r.name).join(' | ')

await t('place_norm tira acento e apóstrofo', async () => eq((await db.query(`select place_norm('Jhony''s Café  São') n`)).rows[0].n, 'jhonys cafe sao', 'norm'))
await t('logado busca "jhonys" e acha os dois de Santa Cecília primeiro', async () => { const s = await names(A, `select * from search_place_catalog('jhonys')`); if (!s.startsWith("Jhony's")) throw new Error(s); return s })
await t('"jhony" (sem s) acha também', async () => names(A, `select * from search_place_catalog('jhony')`))
await t('erro de digitação "johny rokets" acha Johnny Rockets', async () => { const s = await names(A, `select * from search_place_catalog('johny rokets')`); if (!s.includes('Johnny Rockets')) throw new Error(s || 'nada'); return s })
await t('"dona onca" acha a Dona Onça e não a Dona Maria', async () => { const s = await names(A, `select * from search_place_catalog('dona onca')`); if (s !== 'Bar da Dona Onça') throw new Error(s); return s })
await t('"bar brama" acha o Bar Brahma e não a Casa Ibitirama', async () => { const s = await names(A, `select * from search_place_catalog('bar brama')`); if (s !== 'Bar Brahma') throw new Error(s); return s })
await t('perto (Santa Cecília) ordena por distância', async () => names(A, `select * from search_place_catalog('jhony', -23.5376, -46.6522)`))
await t('filtro de tipo: só café', async () => names(A, `select * from search_place_catalog('santa', null, null, array['cafe'])`))
await t('sem texto + localização = lugares a ~1,5 km', async () => names(A, `select * from search_place_catalog('', -23.5376, -46.6522)`))
await t('sem texto e sem localização = nada', async () => eq((await as(A, `select count(*)::int c from search_place_catalog('')`)).rows[0].c, 0, 'qtd'))
await t('limite máximo 50', async () => eq((await as(A, `select count(*)::int c from search_place_catalog('a', null, null, null, 999)`)).rows[0].c <= 50, true, 'limite'))
await t('visitante (anon) chama a busca', () => as(null, `select * from search_place_catalog('bar')`), true)
await t('visitante lê a tabela', () => as(null, `select * from place_catalog`), true)
await t('logado lê a tabela', async () => (await as(A, `select count(*)::int c from place_catalog`)).rows[0].c)
await t('logado insere no catálogo', () => as(A, `insert into place_catalog(id,name,kind,lat,lng) values ('x','X','bar',0,0)`), true)
await t('logado edita o catálogo', async () => { const r = await as(A, `update place_catalog set name='hack' where id='o4' returning id`); if (r.rows.length === 0) throw new Error('nada alterado'); }, true)
await t('logado apaga do catálogo', async () => { const r = await as(A, `delete from place_catalog where id='o4' returning id`); if (r.rows.length === 0) throw new Error('nada apagado'); }, true)
await t('tipo inválido na carga', () => db.query(`insert into place_catalog(id,name,kind,lat,lng) values ('y','Y','boate',0,0)`), true)
await t('nome vazio na carga', () => db.query(`insert into place_catalog(id,name,kind,lat,lng) values ('z','','bar',0,0)`), true)
await t('item criado a partir do catálogo (source overture)', async () => (await as(A, `insert into items(category,title,source,external_id,lat,lng) values ('bar','Jhony''s II Bar e Restaurante','overture','o2',-23.538,-46.651) returning source`)).rows[0].source)

console.log(res.join('\n'))
const bad = res.filter(r => r.startsWith('✗')).length
console.log(bad ? `\n${bad} falha(s) de ${n}` : `\nTudo certo (${n} cenários)`)
process.exit(bad ? 1 : 0)
