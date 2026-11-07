-- =====================================================================
-- MMISC · Fase 2e · Catálogo próprio de lugares (São Paulo primeiro)
--
-- Por quê: a busca de lugares depende do Nominatim/Photon/Overpass na hora. Eles caem, limitam
-- IPs de nuvem e às vezes têm o lugar com outro tipo. Um catálogo nosso, carregado de uma base
-- aberta (Overture Maps, licença CDLA Permissive 2.0, que junta OSM e outras fontes), responde
-- rápido e tolera erro de digitação.
--
-- 1. place_catalog: só leitura pelo app. É "catálogo", não conteúdo de ninguém (como `categories`),
--    então não tem privado/amigos/publico: todo logado lê, ninguém escreve pelo app.
--    A carga é feita pelo dono no painel (importar CSV), como postgres.
-- 2. Itens só nascem em `items` quando alguém registra (source 'overture', external_id = id do catálogo).
-- 3. search_place_catalog(q, lat, lng, tipos, limite): busca por trecho e por semelhança (pg_trgm),
--    ordena por "começa com", semelhança e distância. security invoker (a RLS da tabela vale).
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

-- nome comparável: minúsculas, sem acento, sem pontuação ("Jhony's Bar" -> "jhonys bar")
create or replace function public.place_norm(t text)
returns text
language sql immutable parallel safe set search_path = ''
as $$
  select btrim(regexp_replace(regexp_replace(
           translate(lower(coalesce(t, '')),
                     'áàâãäåéèêëíìîïóòôõöúùûüçñý',
                     'aaaaaaeeeeiiiiooooouuuucny'),
           '[^a-z0-9 ]', '', 'g'), '\s+', ' ', 'g'));
$$;

create table public.place_catalog (
  id            text primary key,                         -- id da fonte (Overture: gers id)
  source        text not null default 'overture' check (source in ('overture', 'fsq', 'osm')),
  name          text not null check (char_length(name) between 1 and 200),
  name_norm     text generated always as (public.place_norm(name)) stored,
  kind          text not null check (kind in ('bar', 'restaurante', 'cafe')),
  raw_category  text,                                     -- categoria original (ex.: cocktail_bar)
  lat           double precision not null check (lat between -90 and 90),
  lng           double precision not null check (lng between -180 and 180),
  address       text,
  area          text,                                     -- "bairro, cidade" quando houver
  confidence    real,
  updated_at    timestamptz not null default now()
);
create index place_catalog_name_trgm on public.place_catalog using gin (name_norm extensions.gin_trgm_ops);
create index place_catalog_geo on public.place_catalog (lat, lng);

alter table public.place_catalog enable row level security;
create policy "catálogo de lugares: logado lê" on public.place_catalog for select to authenticated using (true);
revoke all on public.place_catalog from anon, authenticated;
grant select on public.place_catalog to authenticated;

-- busca: texto (trecho ou parecido) e/ou perto de um ponto
create or replace function public.search_place_catalog(
  p_q text, p_lat double precision default null, p_lng double precision default null,
  p_kinds text[] default null, p_limit int default 20)
returns table (id text, name text, kind text, raw_category text, lat double precision, lng double precision,
               address text, area text, dist_m int)
language sql stable security invoker
set search_path = ''
-- "parecido" a partir de 0,5 (padrão do pg_trgm é 0,6): "johny rokets" acha "Johnny Rockets" (0,56)
set pg_trgm.word_similarity_threshold = 0.5
as $$
  with q as (
    select public.place_norm(p_q) as n,
           -- sem localização: centro de São Paulo só para ordenar
           coalesce(p_lat, -23.55) as lat0, coalesce(p_lng, -46.64) as lng0
  ), hits as (
    select c.*, q.n,
           (6371000 * 2 * asin(sqrt(
              power(sin(radians(c.lat - q.lat0) / 2), 2) +
              cos(radians(q.lat0)) * cos(radians(c.lat)) * power(sin(radians(c.lng - q.lng0) / 2), 2))))::int as d
      from public.place_catalog c, q
     where (p_kinds is null or c.kind = any (p_kinds))
       and (
         -- com texto: trecho do nome ou palavra parecida (tolera "jhonys" x "johnnys")
         (q.n <> '' and (c.name_norm like '%' || q.n || '%' or q.n operator(extensions.<%) c.name_norm))
         -- sem texto: perto do ponto (~1,5 km)
         or (q.n = '' and p_lat is not null and p_lng is not null
             and c.lat between p_lat - 0.0135 and p_lat + 0.0135
             and c.lng between p_lng - 0.015 and p_lng + 0.015)
       )
  )
  select h.id, h.name, h.kind, h.raw_category, h.lat, h.lng, h.address, h.area, h.d
    from hits h
   order by (h.n <> '' and h.name_norm like h.n || '%') desc,
            (h.n <> '' and h.name_norm like '%' || h.n || '%') desc,
            case when h.n <> '' then extensions.word_similarity(h.n, h.name_norm) else 0 end desc,
            h.d asc
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;
revoke execute on function public.search_place_catalog(text, double precision, double precision, text[], int) from public, anon;
grant  execute on function public.search_place_catalog(text, double precision, double precision, text[], int) to authenticated;
