// Testes da migração do acervo de álbuns (album_catalog, view albuns, busca, parecidos, posições)
// num Postgres local (PGlite) com todas as migrações.
// Rodar: node supabase/tests/albuns_acervo.mjs   (ou npm run test:banco)
import { setup, actor } from './harness.mjs'
const MIG = process.env.MIG_DIR || new URL('../migrations', import.meta.url).pathname
const { db } = await setup(MIG, { skip: ['pg_cron'] })
const as = actor(db)
const A = 'aaaaaaaa-0000-0000-0000-000000000001'
await db.query(`insert into auth.users(id,email) values ($1,'a@x.com')`, [A])
const MB = '6e335887-60ba-38f0-95af-fae7774336bf'
// carga (como postgres, igual ao import do CSV no painel): só texto e número
await db.exec(`insert into album_catalog(id,title,artists_txt,artist_slugs_txt,release_date,date_precision,date_text,year,chart,chart_pos,genres_txt,genres_sec_txt,ref_rating,ref_count,ref_reviews,score,cover_url,mbid) values
 ('album/david-bowie/ziggy','The Rise and Fall of Ziggy Stardust and The Spiders From Mars','David Bowie','david-bowie','1972-06-16','dia','16 June 1972',1972,'1972',1,'Glam Rock|Pop Rock','Art Rock|Rock Opera',4.26,74000,949,4.25,'https://e-cdns-images.dzcdn.net/x.jpg','${MB}'),
 ('album/nick-drake/pink-moon','Pink Moon','Nick Drake','nick-drake','1972-02-25','dia','25 February 1972',1972,'1972',2,'Contemporary Folk|Singer-Songwriter','Folk Baroque',4.19,56000,771,4.18,'',null),
 ('album/yes/close-to-the-edge','Close to the Edge','Yes','yes','1972-09-08','dia','8 September 1972',1972,'1972',3,'Symphonic Prog','',4.19,42000,637,4.17,'',null),
 ('album/david-bowie/hunky-dory','Hunky Dory','David Bowie','david-bowie','1971-12-17','dia','17 December 1971',1971,'1971',5,'Glam Rock|Art Pop','Singer-Songwriter',4.13,50000,600,4.12,'',null),
 ('album/t-rex/the-slider','The Slider','T. Rex','t-rex','1972-07-21','dia','21 July 1972',1972,'1972',40,'Glam Rock','Boogie Rock',3.85,9000,100,3.83,'',null),
 ('album/roxy-music/roxy-music','Roxy Music','Roxy Music','roxy-music','1972-06-16','mes','June 1972',1972,'1972',60,'Glam Rock|Art Rock','',3.9,8000,90,3.86,'',null),
 ('album/miles-davis/kind-of-blue','Kind of Blue','Miles Davis','miles-davis','1959-08-17','dia','17 August 1959',1959,'1950s',1,'Modal Jazz','Cool Jazz',4.3,80000,1000,4.29,'',null),
 ('album/various/collab','Duets','Artista A|Artista B','artista-a|artista-b','1975-01-01','ano','1975',1975,'1975',9,'Pop Rock','',3.2,200,3,3.35,'',null)`)
const res = []; let n = 0
const t = async (name, fn, expectErr = false) => { n++; try { const v = await fn(); res.push(expectErr ? `✗ ${name}: passou e devia falhar` : `✓ ${name}${v !== undefined ? ' → ' + v : ''}`) } catch (e) { res.push(expectErr ? `✓ ${name} (bloqueado: ${e.message.slice(0, 60)})` : `✗ ${name}: ${e.message}`) } }
const eq = (a, b, m) => { if (String(a) !== String(b)) throw new Error(`${m}: esperava ${b}, veio ${a}`); return a }
const titles = async (sql, p) => (await as(A, sql, p)).rows.map(r => r.title).join(' | ')

await t('colunas geradas: listas e gênero principal', async () => {
  const r = (await as(A, `select artists, genres, genres_sec, genre_main, decade from albuns where id='album/david-bowie/ziggy'`)).rows[0]
  eq(r.genres.join(','), 'Glam Rock,Pop Rock', 'genres'); eq(r.genres_sec.join(','), 'Art Rock,Rock Opera', 'sec')
  eq(r.genre_main, 'Glam Rock', 'principal'); return eq(r.decade, 1970, 'década')
})
await t('lista vazia vira nulo (sem gênero secundário)', async () => eq((await as(A, `select genres_sec from albuns where id='album/yes/close-to-the-edge'`)).rows[0].genres_sec, 'null', 'sec'))
await t('vários artistas viram lista', async () => eq((await as(A, `select artist_slugs from albuns where id='album/various/collab'`)).rows[0].artist_slugs.join(','), 'artista-a,artista-b', 'slugs'))
await t('capa vazia vira nula na view', async () => eq((await as(A, `select cover_url from albuns where id='album/nick-drake/pink-moon'`)).rows[0].cover_url, 'null', 'capa'))
await t('parada de 1972 pela posição de origem', async () => eq(await titles(`select title from albuns where year=1972 order by chart_pos limit 3`), 'The Rise and Fall of Ziggy Stardust and The Spiders From Mars | Pink Moon | Close to the Edge', 'ordem'))
await t('década de 70 pela nota ponderada', async () => titles(`select title from albuns where decade=1970 order by score desc limit 3`))
await t('gênero (principal ou secundário) com @>', async () => titles(`select title from albuns where genres @> array['Glam Rock'] or genres_sec @> array['Glam Rock'] order by score desc`))
await t('discografia do artista', async () => eq(await titles(`select title from albuns where artist_slugs @> array['david-bowie'] order by year`), 'Hunky Dory | The Rise and Fall of Ziggy Stardust and The Spiders From Mars', 'bowie'))
await t('busca "ziggy" acha pelo título', async () => { const s = await titles(`select title from search_album_catalog('ziggy')`); if (!s.startsWith('The Rise and Fall')) throw new Error(s || 'nada'); return s })
await t('busca pelo artista "nick drake"', async () => eq(await titles(`select title from search_album_catalog('nick drake')`), 'Pink Moon', 'drake'))
await t('busca com erro de digitação "pink mon"', async () => { const s = await titles(`select title from search_album_catalog('pink mon')`); if (!s.includes('Pink Moon')) throw new Error(s || 'nada'); return s })
await t('busca vazia = nada', async () => eq((await as(A, `select count(*)::int c from search_album_catalog('')`)).rows[0].c, 0, 'qtd'))
await t('limite máximo 50', async () => eq((await as(A, `select count(*)::int c from search_album_catalog('a', 999)`)).rows[0].c <= 50, true, 'limite'))
await t('item do acervo acha o álbum (source acervo)', async () => eq((await as(A, `select title from album_catalog_for('acervo','album/yes/close-to-the-edge',null,null)`)).rows[0]?.title, 'Close to the Edge', 'acervo'))
await t('item do MusicBrainz acha pelo mbid', async () => eq((await as(A, `select id from album_catalog_for('musicbrainz','${MB}','x','y')`)).rows[0]?.id, 'album/david-bowie/ziggy', 'mbid'))
await t('item manual acha por título + artista (sem acento/caixa)', async () => eq((await as(A, `select id from album_catalog_for('manual',null,'PINK MOON','nick drake')`)).rows[0]?.id, 'album/nick-drake/pink-moon', 'título'))
await t('título igual, artista diferente = nada', async () => eq((await as(A, `select count(*)::int c from album_catalog_for('manual',null,'Pink Moon','Outro')`)).rows[0].c, 0, 'qtd'))
await t('id externo que não é uuid não quebra', async () => eq((await as(A, `select count(*)::int c from album_catalog_for('musicbrainz','abc','','')`)).rows[0].c, 0, 'qtd'))
await t('parecidos de Ziggy: glam de outros artistas, sem o próprio Bowie', async () => { const s = await titles(`select title from album_similar('album/david-bowie/ziggy')`); if (s.includes('Hunky') || s.includes('Ziggy') || !s.includes('Slider')) throw new Error(s); return s })
await t('posições de Pink Moon', async () => { const r = (await as(A, `select * from album_positions('album/nick-drake/pink-moon')`)).rows[0]; eq(r.no_ano, 2, 'ano'); eq(r.no_ano_total, 5, 'total ano'); eq(r.na_decada, 2, 'década'); return `${r.geral}º de ${r.geral_total}` })
await t('posições de álbum inexistente = nada', async () => eq((await as(A, `select count(*)::int c from album_positions('nao/existe')`)).rows[0].c, 0, 'qtd'))
await t('visitante (anon) lê a view', () => as(null, `select * from albuns`), true)
await t('visitante lê a tabela', () => as(null, `select * from album_catalog`), true)
await t('visitante chama a busca', () => as(null, `select * from search_album_catalog('ziggy')`), true)
await t('visitante chama parecidos', () => as(null, `select * from album_similar('album/david-bowie/ziggy')`), true)
await t('logado lê a tabela', async () => (await as(A, `select count(*)::int c from album_catalog`)).rows[0].c)
await t('logado insere no acervo', () => as(A, `insert into album_catalog(id,title,year,chart) values ('x/y/z','X',2000,'2000')`), true)
await t('logado edita o acervo', async () => { const r = await as(A, `update album_catalog set title='hack' where id='album/yes/close-to-the-edge' returning id`); if (r.rows.length === 0) throw new Error('nada alterado') }, true)
await t('logado apaga do acervo', async () => { const r = await as(A, `delete from album_catalog where id='album/yes/close-to-the-edge' returning id`); if (r.rows.length === 0) throw new Error('nada apagado') }, true)
await t('logado escreve pela view', () => as(A, `update albuns set title='hack'`), true)
await t('capa sem https na carga', () => db.query(`insert into album_catalog(id,title,year,chart,cover_url) values ('a/b/c','X',2000,'2000','http://x')`), true)
await t('nota fora de 0–5 na carga', () => db.query(`insert into album_catalog(id,title,year,chart,ref_rating) values ('a/b/d','X',2000,'2000',7)`), true)
await t('item criado a partir do acervo (source acervo)', async () => (await as(A, `insert into items(category,title,subtitle,source,external_id,year,created_by) values ('album','Pink Moon','Nick Drake','acervo','album/nick-drake/pink-moon',1972,'${A}') returning source`)).rows[0].source)

console.log(res.join('\n'))
const bad = res.filter(r => r.startsWith('✗')).length
console.log(bad ? `\n${bad} falha(s) de ${n}` : `\nTudo certo (${n} cenários)`)
process.exit(bad ? 1 : 0)
