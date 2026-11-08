-- =====================================================================
-- A4 do plano de Aparência (aprovado pelo dono em 08/11): levar a aparência para a conta.
--   1. user_settings: as escolhas de Aparência de cada pessoa (tema, estilo, destaque…).
--      SÓ o dono lê e grava. Amigos, estranhos e visitantes: nada. (Por isso não fica em
--      profiles: amigos e qualquer logado conseguem ler o perfil.)
--      O tamanho do texto NÃO vem para cá: fica só no aparelho (decisão do plano).
--   2. profiles.cor_destaque: a única parte pública (perfil público e de amigo na cor do
--      dono). Lista fechada. Nenhuma policy de profiles muda: o dono já edita o próprio perfil.
--   3. public_profile(handle) passa a devolver cor_destaque (nada de user_settings).
-- Testes: supabase/tests/a4_aparencia.mjs (PGlite com todas as migrações).
-- =====================================================================

create table public.user_settings (
  user_id       uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  aparencia     jsonb not null default '{}'::jsonb,
  -- hora da última mudança no aparelho que gravou (o app usa para "vale a mais recente")
  atualizado_em timestamptz not null default now(),
  constraint user_settings_aparencia_objeto check (jsonb_typeof(aparencia) = 'object'),
  constraint user_settings_aparencia_tamanho check (pg_column_size(aparencia) <= 2048)
);

alter table public.user_settings enable row level security;

create policy "ajustes: dono lê"    on public.user_settings for select to authenticated using (user_id = auth.uid());
create policy "ajustes: dono cria"  on public.user_settings for insert to authenticated with check (user_id = auth.uid());
create policy "ajustes: dono muda"  on public.user_settings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ajustes: dono apaga" on public.user_settings for delete to authenticated using (user_id = auth.uid());

-- o Supabase dá TRUNCATE/REFERENCES/TRIGGER por padrão em tabela nova (ver fase0_privilegios)
revoke all on public.user_settings from public, anon, authenticated;
grant select, insert, update, delete on public.user_settings to authenticated;

alter table public.profiles
  add column cor_destaque text
  constraint profiles_cor_destaque_lista check (cor_destaque in ('marca', 'vermelho', 'roxo', 'verde', 'azul', 'laranja', 'rosa'));

-- public_profile: igual à da Etapa 3 do perfil, com cor_destaque no bloco "profile"
create or replace function public.public_profile(p_handle text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with p as (
    select id, username, display_name, avatar_url, bio, cover_mode, cover_url, links, showcase, cor_destaque
    from public.profiles
    where is_public
      and username is not null
      and username = lower(ltrim(trim(p_handle), '@'))
  )
  select case when not exists (select 1 from p) then null else jsonb_build_object(
    'profile', (select to_jsonb(p) from p),
    'favorites', coalesce((
      select jsonb_agg(jsonb_build_object('category', f.category, 'position', f.position, 'item', public.item_public_json(i)) order by f.category, f.position)
      from public.favorites f join public.items i on i.id = f.item_id
      where f.user_id = (select id from p) and f.visibility = 'publico'
    ), '[]'::jsonb),
    'now', coalesce((
      select jsonb_agg(jsonb_build_object('category', n.category, 'set_at', n.set_at, 'item', public.item_public_json(i)) order by n.set_at desc)
      from public.profile_now n join public.items i on i.id = n.item_id
      where n.user_id = (select id from p) and n.visibility = 'publico'
        and n.set_at > now() - interval '60 days'
    ), '[]'::jsonb),
    'rankings', coalesce((
      select jsonb_agg(jsonb_build_object('year', r.year, 'category', r.category, 'position', r.position, 'item', public.item_public_json(i)) order by r.year desc, r.category, r.position)
      from public.rankings r join public.items i on i.id = r.item_id
      where r.user_id = (select id from p) and r.visibility = 'publico'
        and r.year >= extract(year from now())::int - 1
    ), '[]'::jsonb),
    'reviews', coalesce((
      select jsonb_agg(s.x order by s.experienced_at desc, s.created_at desc)
      from (
        select r.experienced_at, r.created_at, jsonb_build_object(
          'id', r.id, 'rating', r.rating, 'body', r.body, 'spoiler', r.spoiler,
          'experienced_at', r.experienced_at, 'created_at', r.created_at,
          'loved', r.loved, 'rewatch', r.rewatch, 'item', public.item_public_json(i)
        ) as x
        from public.reviews r join public.items i on i.id = r.item_id
        where r.user_id = (select id from p) and r.visibility = 'publico'
        order by r.experienced_at desc, r.created_at desc
        limit 500
      ) s
    ), '[]'::jsonb)
  ) end;
$$;


revoke execute on function public.public_profile(text) from public;
grant  execute on function public.public_profile(text) to anon, authenticated;
