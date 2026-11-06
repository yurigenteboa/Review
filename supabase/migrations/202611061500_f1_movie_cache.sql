-- =====================================================================
-- F1 · Cache da ficha do TMDB em items.metadata
--
-- Problema: a policy "itens: criador edita" só deixa quem cadastrou o item
-- alterar a linha. A Edge Function movie-details roda como o usuário que
-- abriu a página, então só conseguiria guardar o cache dos filmes que ele
-- mesmo cadastrou.
--
-- Solução: uma função estreita (security definer) que só grava o cache,
-- sem tocar em nenhuma policy. Ela só escreve quando:
--   - quem chama está logado;
--   - o item é um filme do TMDB (source = 'tmdb-movie');
--   - o tmdb_id do JSON bate com o external_id do item;
--   - o cache atual não existe ou tem mais de 7 dias;
--   - o JSON é um objeto com menos de ~200 KB.
-- Só mexe nas chaves "tmdb" e "fetched_at" de metadata; o resto fica igual.
--
-- Nenhuma tabela nova, nenhuma policy alterada.
-- =====================================================================

create or replace function public.cache_movie_details(p_item uuid, p_details jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if auth.uid() is null then
    raise exception 'login necessário';
  end if;

  if p_details is null or jsonb_typeof(p_details) <> 'object' or pg_column_size(p_details) > 200000 then
    raise exception 'ficha inválida';
  end if;

  update public.items i
     set metadata = coalesce(i.metadata, '{}'::jsonb)
                    || jsonb_build_object('tmdb', p_details, 'fetched_at', now())
   where i.id = p_item
     and i.source = 'tmdb-movie'
     and i.external_id = p_details->>'tmdb_id'
     and (
       i.metadata->>'fetched_at' is null
       or (i.metadata->>'fetched_at')::timestamptz < now() - interval '7 days'
     );

  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.cache_movie_details(uuid, jsonb) from public, anon;
grant execute on function public.cache_movie_details(uuid, jsonb) to authenticated;
