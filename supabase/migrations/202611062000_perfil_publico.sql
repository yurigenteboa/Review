-- =====================================================================
-- Perfil novo · Etapa 3: perfil público por link (mmisc.com.br/@usuario)
--   1. profiles.is_public: LIGADO por padrão (decisão do dono, 06/11);
--      cada pessoa pode deixar o perfil privado.
--   2. RPC public_profile(handle): a ÚNICA porta para quem não tem login.
--      Devolve só o que é público e só se is_public estiver ligado.
--      Nenhuma tabela ganha policy para visitante (anon): menos chance de
--      vazar algo por engano.
-- O que NUNCA sai daqui: amigos, convites, notas privadas, "vi com quem",
-- quero ver, metas, fotos das reviews, curtidas, comentários e qualquer
-- coisa com visibilidade "amigos" ou "privado".
-- =====================================================================

alter table public.profiles
  add column is_public boolean not null default true;

-- JSON de um item (só os campos que a tela pública usa)
create or replace function public.item_public_json(i public.items)
returns jsonb
language sql immutable set search_path = ''
as $$
  select jsonb_build_object(
    'id', i.id, 'category', i.category, 'title', i.title,
    'subtitle', i.subtitle, 'image_url', i.image_url, 'year', i.year
  );
$$;

create or replace function public.public_profile(p_handle text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with p as (
    select id, username, display_name, avatar_url, bio, cover_mode, cover_url, links, showcase
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

revoke execute on function public.item_public_json(public.items) from public, anon, authenticated;
revoke execute on function public.public_profile(text) from public;
grant  execute on function public.public_profile(text) to anon, authenticated;
