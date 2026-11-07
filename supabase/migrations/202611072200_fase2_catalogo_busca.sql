-- =====================================================================
-- MMISC · Fase 2e · ajuste da busca do catálogo (07/11)
-- Com o catálogo real (64.902 lugares), "dona onca" trazia "Dona Maria" e "Dona Ines" (semelhança
-- por pedaço de palavra, 0,5). Troca para semelhança de palavra inteira (strict_word_similarity) com
-- limite 0,55 (sem parâmetro de sessão: o Supabase não deixa a função fixar `pg_trgm.*`; a versão
-- anterior tinha `set pg_trgm.word_similarity_threshold`, que este arquivo remove). Só a função muda.
-- =====================================================================

-- busca: texto (trecho ou parecido) e/ou perto de um ponto
create or replace function public.search_place_catalog(
  p_q text, p_lat double precision default null, p_lng double precision default null,
  p_kinds text[] default null, p_limit int default 20)
returns table (id text, name text, kind text, raw_category text, lat double precision, lng double precision,
               address text, area text, dist_m int)
language sql stable security invoker
set search_path = ''
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
         -- com texto: trecho do nome ou palavra inteira parecida a partir de 0,55 ("johny rokets" acha
         -- "Johnny Rockets" com 0,56; "bar brama" acha "Bar Brahma" com 0,58; "dona onca" não traz
         -- "Dona Maria", 0,50). Limite escrito aqui porque o Supabase não deixa a função mudar o parâmetro.
         (q.n <> '' and (c.name_norm like '%' || q.n || '%' or extensions.strict_word_similarity(q.n, c.name_norm) >= 0.55))
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
            case when h.n <> '' then extensions.strict_word_similarity(h.n, h.name_norm) else 0 end desc,
            h.d asc
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;
revoke execute on function public.search_place_catalog(text, double precision, double precision, text[], int) from public, anon;
grant  execute on function public.search_place_catalog(text, double precision, double precision, text[], int) to authenticated;
