-- =====================================================================
-- MMisc · Álbuns · acervo de referência (13/11)
--
-- Por quê: o dono tem as paradas anuais de álbuns de 1909 a 2017 (78.520 álbuns, vindos dos .docx
-- da pasta Albuns). Elas viram um catálogo de referência: paradas por ano/década/gênero, página do
-- artista e do gênero, e a página do álbum com gêneros, data e a nota de referência do público.
--
-- 1. album_catalog: só leitura pelo app, igual ao place_catalog (catálogo, não conteúdo de ninguém):
--    todo logado lê, ninguém escreve pelo app, visitante nada. A carga é feita pelo dono no painel
--    (Table Editor > Import data from CSV, as partes de Albuns/saida), como postgres.
--    O CSV só tem texto e número (o importador do painel não lida bem com listas; célula vazia vira nulo): as listas vêm
--    separadas por "|" (artists_txt, genres_txt…) e as colunas de lista são geradas a partir delas.
-- 2. View `albuns` (security_invoker: a RLS da tabela vale) com as colunas que o app usa. É nela que
--    o app filtra as paradas (ano, década, gênero, artista) e ordena pela nota ponderada (`score`).
-- 3. Funções (security invoker, só logado):
--    search_album_catalog(q, limite)   busca por título ou artista, tolera erro de digitação (pg_trgm)
--    album_catalog_for(source, ext_id, título, artista)  acha o álbum do acervo de um item do app
--    album_similar(id, limite)         parecidos (gêneros em comum, época, nota)
--    album_positions(id)               posição no ano, na década, no gênero principal e geral
-- 4. Itens só nascem em `items` quando alguém abre ou registra: source 'musicbrainz' (quando o álbum
--    foi ligado ao MusicBrainz, o mesmo item da busca do app) ou 'acervo' (external_id = id do acervo).
--    Nenhuma policy de outras tabelas muda.
-- =====================================================================

create table public.album_catalog (
  id               text primary key check (char_length(id) between 3 and 400),  -- caminho da página de origem (album/artista/titulo)
  title            text not null check (char_length(title) between 1 and 500),
  artists_txt      text,                        -- "Nome|Nome" (mesma ordem de artist_slugs_txt)
  artist_slugs_txt text,
  release_date     date,                         -- dia de lançamento (1º do mês/ano quando a precisão é menor)
  date_precision   text check (date_precision in ('dia', 'mes', 'ano')),
  date_text        text,                         -- data como veio ("16 June 1972")
  year             int not null check (year between 1850 and 2100),
  chart            text not null,                -- parada de onde veio: '1972', '1950s'…
  chart_pos        int check (chart_pos > 0),    -- posição nessa parada
  genres_txt       text,                        -- gêneros principais (a linha de destaque)
  genres_sec_txt   text,                        -- gêneros secundários
  ref_rating       numeric(3, 2) check (ref_rating between 0 and 5),   -- média de referência do público
  ref_count        int not null default 0 check (ref_count >= 0),      -- quantas notas
  ref_reviews      int not null default 0 check (ref_reviews >= 0),    -- quantas resenhas
  score            numeric(6, 4) not null default 0,  -- nota ponderada (bayesiana; ver scripts/albuns/acervo.py)
  cover_url        text check (cover_url is null or cover_url = '' or cover_url ~ '^https://'),
  mbid             uuid,                         -- release-group do MusicBrainz, quando ligado
  -- geradas a partir dos textos
  artists          text[] generated always as (string_to_array(nullif(artists_txt, ''), '|')) stored,
  artist_slugs     text[] generated always as (string_to_array(nullif(artist_slugs_txt, ''), '|')) stored,
  genres           text[] generated always as (string_to_array(nullif(genres_txt, ''), '|')) stored,
  genres_sec       text[] generated always as (string_to_array(nullif(genres_sec_txt, ''), '|')) stored,
  genre_main       text generated always as (nullif(split_part(coalesce(genres_txt, ''), '|', 1), '')) stored,
  decade           int generated always as ((year / 10) * 10) stored,
  title_norm       text generated always as (public.place_norm(title)) stored,
  search_norm      text generated always as (public.place_norm(title || ' ' || replace(coalesce(artists_txt, ''), '|', ' '))) stored,
  updated_at       timestamptz not null default now()
);

create index album_catalog_score   on public.album_catalog (score desc);
create index album_catalog_year    on public.album_catalog (year, score desc);
create index album_catalog_decade  on public.album_catalog (decade, score desc);
create index album_catalog_gmain   on public.album_catalog (genre_main, score desc);
create index album_catalog_genres  on public.album_catalog using gin (genres);
create index album_catalog_gsec    on public.album_catalog using gin (genres_sec);
create index album_catalog_artists on public.album_catalog using gin (artist_slugs);
create index album_catalog_mbid    on public.album_catalog (mbid) where mbid is not null;
create index album_catalog_trgm    on public.album_catalog using gin (search_norm extensions.gin_trgm_ops);

alter table public.album_catalog enable row level security;
create policy "acervo de álbuns: logado lê" on public.album_catalog for select to authenticated using (true);
revoke all on public.album_catalog from anon, authenticated;
grant select on public.album_catalog to authenticated;

-- o que o app lê (sem as colunas de texto da carga)
create view public.albuns with (security_invoker = true) as
  select id, title, artists, artist_slugs, release_date, date_precision, year, decade, chart, chart_pos,
         genres, genres_sec, genre_main, ref_rating, ref_count, ref_reviews, score,
         nullif(cover_url, '') as cover_url, mbid
    from public.album_catalog;
revoke all on public.albuns from anon, authenticated;
grant select on public.albuns to authenticated;

-- busca: título ou artista; trecho ("ziggy") ou parecido ("radiohed ok computer")
create or replace function public.search_album_catalog(p_q text, p_limit int default 20)
returns setof public.albuns
language sql stable security invoker
set search_path = ''
as $$
  with q as (select public.place_norm(p_q) as n)
  select a.*
    from public.albuns a
    join public.album_catalog c on c.id = a.id, q
   where q.n <> ''
     -- trecho, ou palavra inteira parecida (operador <<% = strict_word_similarity >= 0,5, o padrão do
     -- pg_trgm); os dois usam o índice trigram
     and (c.search_norm like '%' || q.n || '%' or q.n operator(extensions.<<%) c.search_norm)
   order by (c.title_norm = q.n) desc,
            (c.title_norm like q.n || '%') desc,
            (c.search_norm like '%' || q.n || '%') desc,
            extensions.strict_word_similarity(q.n, c.search_norm) desc,
            c.score desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

-- o álbum do acervo de um item do app: pelo id do acervo, pelo MusicBrainz ou (último caso) por título + artista
create or replace function public.album_catalog_for(p_source text, p_external_id text, p_title text, p_artist text)
returns setof public.albuns
language plpgsql stable security invoker
set search_path = ''
as $$
declare r public.albuns;
begin
  if p_source = 'acervo' then
    select * into r from public.albuns where id = p_external_id;
  elsif p_source = 'musicbrainz' and p_external_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select * into r from public.albuns where mbid = p_external_id::uuid order by score desc limit 1;
  end if;
  if r.id is not null then
    return next r;
    return;
  end if;
  if public.place_norm(p_title) = '' then
    return;
  end if;
  return query
    select a.* from public.albuns a
      join public.album_catalog c on c.id = a.id
     where c.title_norm = public.place_norm(p_title)
       and (public.place_norm(p_artist) = '' or c.search_norm like '%' || public.place_norm(p_artist) || '%')
     order by c.score desc
     limit 1;
end;
$$;

-- parecidos: mais gêneros em comum (principal pesa mais), época perto, nota ponderada
create or replace function public.album_similar(p_id text, p_limit int default 12)
returns setof public.albuns
language sql stable security invoker
set search_path = ''
as $$
  with alvo as (select * from public.album_catalog where id = p_id)
  select a.*
    from public.albuns a, alvo
   where a.id <> alvo.id
     and a.genres && alvo.genres
     and not (a.artist_slugs && alvo.artist_slugs)
   order by (case when a.genre_main = alvo.genre_main then 3 else 0 end
             + cardinality(array(select unnest(a.genres) intersect select unnest(alvo.genres))) * 2
             + cardinality(array(select unnest(coalesce(a.genres_sec, '{}')) intersect select unnest(coalesce(alvo.genres_sec, '{}'))))
             - least(abs(a.year - alvo.year), 30) / 6.0
             + a.score * 2
             + ln(greatest(a.ref_count, 1)) / 2) desc
   limit least(greatest(coalesce(p_limit, 12), 1), 30);
$$;

-- posições: na parada do ano (a da origem), na década, no gênero principal e no acervo todo
create or replace function public.album_positions(p_id text)
returns table (no_ano int, no_ano_total int, na_decada int, na_decada_total int,
               no_genero int, no_genero_total int, geral int, geral_total int)
language sql stable security invoker
set search_path = ''
as $$
  with alvo as (select * from public.album_catalog where id = p_id)
  select
    (select 1 + count(*) from public.album_catalog c where c.year = alvo.year and c.score > alvo.score)::int,
    (select count(*) from public.album_catalog c where c.year = alvo.year)::int,
    (select 1 + count(*) from public.album_catalog c where c.decade = alvo.decade and c.score > alvo.score)::int,
    (select count(*) from public.album_catalog c where c.decade = alvo.decade)::int,
    (select 1 + count(*) from public.album_catalog c where c.genre_main = alvo.genre_main and c.score > alvo.score)::int,
    (select count(*) from public.album_catalog c where c.genre_main = alvo.genre_main)::int,
    (select 1 + count(*) from public.album_catalog c where c.score > alvo.score)::int,
    (select count(*) from public.album_catalog)::int
  from alvo;
$$;

revoke execute on function public.search_album_catalog(text, int) from public, anon;
revoke execute on function public.album_catalog_for(text, text, text, text) from public, anon;
revoke execute on function public.album_similar(text, int) from public, anon;
revoke execute on function public.album_positions(text) from public, anon;
grant  execute on function public.search_album_catalog(text, int) to authenticated;
grant  execute on function public.album_catalog_for(text, text, text, text) to authenticated;
grant  execute on function public.album_similar(text, int) to authenticated;
grant  execute on function public.album_positions(text) to authenticated;
