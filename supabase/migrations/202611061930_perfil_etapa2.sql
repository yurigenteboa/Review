-- =====================================================================
-- Perfil novo · Etapa 2
--   1. profiles ganha: capa (automática ou foto), links (até 5), vitrine
--      (categorias que aparecem no topo, em ordem) e check de https nas fotos.
--   2. favorites  : 4 favoritos por categoria.
--   3. profile_now: "agora vendo/ouvindo/jogando", um por categoria.
--   4. goals      : metas do ano (por categoria ou geral).
--   5. rankings   : Top 10 do ano por categoria (montado por comparação).
--   6. bucket profile-media: foto de perfil e capa (leitura pública).
--   7. RPC rating_vs_friends: sua média x a dos amigos.
-- Tabelas novas seguem a regra do projeto: privado = só o dono ·
-- amigos = dono + amigos aceitos · publico = qualquer logado
-- (a mesma função can_see_review das reviews e do "quero ver").
-- =====================================================================

-- ---------- 1. profiles ----------

-- Links: lista de {label, url}; só https, para nunca virar "javascript:".
create or replace function public.valid_profile_links(links jsonb)
returns boolean
language sql immutable set search_path = ''
as $$
  select jsonb_typeof(links) = 'array'
     and jsonb_array_length(links) <= 5
     and not exists (
       select 1 from jsonb_array_elements(links) e
       where jsonb_typeof(e) <> 'object'
          or coalesce(e ->> 'url', '') !~ '^https://[^\s<>"]+$'
          or char_length(e ->> 'url') > 300
          or char_length(coalesce(e ->> 'label', '')) > 40
     );
$$;

alter table public.profiles
  add column cover_mode text   not null default 'auto' check (cover_mode in ('auto', 'foto')),
  add column cover_url  text   check (cover_url is null or cover_url ~ '^https://'),
  add column links      jsonb  not null default '[]'::jsonb check (public.valid_profile_links(links)),
  add column showcase   text[] not null default '{}' check (cardinality(showcase) <= 8),
  add constraint profiles_avatar_https check (avatar_url is null or avatar_url ~ '^https://');
-- Edição continua pela policy existente "perfis: dono edita"; leitura, "perfis: logado lê".

-- ---------- Regra comum: o item tem de ser da categoria declarada ----------
create or replace function public.check_item_category()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  cat text;
begin
  select i.category into cat from public.items i where i.id = new.item_id;
  if cat is null or cat <> new.category then
    raise exception 'item % não é da categoria %', new.item_id, new.category using errcode = '23514';
  end if;
  return new;
end;
$$;

-- ---------- 2. Favoritos ----------
create table public.favorites (
  user_id     uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  category    text not null references public.categories (slug),
  position    smallint not null check (position between 1 and 4),
  item_id     uuid not null references public.items (id) on delete cascade,
  visibility  public.visibility not null default 'publico',
  created_at  timestamptz not null default now(),
  primary key (user_id, category, position),
  unique (user_id, item_id)
);
create index favorites_item_idx on public.favorites (item_id);
create trigger favorites_item_category before insert or update on public.favorites
  for each row execute function public.check_item_category();

alter table public.favorites enable row level security;
create policy "favoritos: lê conforme visibilidade" on public.favorites for select to authenticated
  using (public.can_see_review(user_id, visibility));
create policy "favoritos: dono adiciona" on public.favorites for insert to authenticated
  with check (user_id = auth.uid());
create policy "favoritos: dono edita"    on public.favorites for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "favoritos: dono tira"     on public.favorites for delete to authenticated
  using (user_id = auth.uid());

-- ---------- 3. Agora ----------
create table public.profile_now (
  user_id     uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  category    text not null references public.categories (slug),
  item_id     uuid not null references public.items (id) on delete cascade,
  visibility  public.visibility not null default 'amigos',
  set_at      timestamptz not null default now(),
  primary key (user_id, category)
);
create trigger profile_now_item_category before insert or update on public.profile_now
  for each row execute function public.check_item_category();

alter table public.profile_now enable row level security;
create policy "agora: lê conforme visibilidade" on public.profile_now for select to authenticated
  using (public.can_see_review(user_id, visibility));
create policy "agora: dono marca"  on public.profile_now for insert to authenticated
  with check (user_id = auth.uid());
create policy "agora: dono edita"  on public.profile_now for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "agora: dono tira"   on public.profile_now for delete to authenticated
  using (user_id = auth.uid());

-- ---------- 4. Metas do ano ----------
-- category vazio = meta geral ("40 coisas em 2026")
create table public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  year        smallint not null check (year between 2000 and 2100),
  category    text references public.categories (slug),
  target      int not null check (target between 1 and 1000),
  visibility  public.visibility not null default 'publico',
  created_at  timestamptz not null default now()
);
create unique index goals_one_per_scope on public.goals (user_id, year, coalesce(category, ''));

alter table public.goals enable row level security;
create policy "metas: lê conforme visibilidade" on public.goals for select to authenticated
  using (public.can_see_review(user_id, visibility));
create policy "metas: dono cria"  on public.goals for insert to authenticated
  with check (user_id = auth.uid());
create policy "metas: dono edita" on public.goals for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "metas: dono apaga" on public.goals for delete to authenticated
  using (user_id = auth.uid());

-- ---------- 5. Top 10 do ano ----------
create table public.rankings (
  user_id     uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  year        smallint not null check (year between 2000 and 2100),
  category    text not null references public.categories (slug),
  position    smallint not null check (position between 1 and 10),
  item_id     uuid not null references public.items (id) on delete cascade,
  visibility  public.visibility not null default 'publico',
  updated_at  timestamptz not null default now(),
  primary key (user_id, year, category, position),
  unique (user_id, year, category, item_id)
);
create trigger rankings_item_category before insert or update on public.rankings
  for each row execute function public.check_item_category();

-- Só entra no Top 10 do ano o que está no seu diário daquele ano.
create or replace function public.check_ranking_in_diary()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.reviews r
    where r.user_id = new.user_id and r.item_id = new.item_id
      and extract(year from r.experienced_at) = new.year
  ) then
    raise exception 'o item precisa estar no seu diário de %', new.year using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger rankings_in_diary before insert or update on public.rankings
  for each row execute function public.check_ranking_in_diary();

alter table public.rankings enable row level security;
create policy "top 10: lê conforme visibilidade" on public.rankings for select to authenticated
  using (public.can_see_review(user_id, visibility));
create policy "top 10: dono cria"  on public.rankings for insert to authenticated
  with check (user_id = auth.uid());
create policy "top 10: dono edita" on public.rankings for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "top 10: dono apaga" on public.rankings for delete to authenticated
  using (user_id = auth.uid());

-- Salvar o Top 10 inteiro de uma vez (apaga e regrava na mesma transação).
-- security invoker: as policies acima valem; só mexe nas suas linhas.
create or replace function public.save_ranking(p_year smallint, p_category text, p_items uuid[], p_visibility public.visibility default 'publico')
returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  if cardinality(p_items) > 10 then
    raise exception 'no máximo 10 itens' using errcode = '23514';
  end if;
  delete from public.rankings where user_id = auth.uid() and year = p_year and category = p_category;
  insert into public.rankings (user_id, year, category, position, item_id, visibility)
  select auth.uid(), p_year, p_category, i.ord::smallint, i.item, p_visibility
  from unnest(p_items) with ordinality as i(item, ord);
end;
$$;

-- ---------- 6. Fotos do perfil ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media', 'profile-media', true, 5242880, array['image/webp', 'image/jpeg', 'image/png']);

-- Leitura é pública pelo link (bucket público). Escrita só na própria pasta: <user_id>/arquivo
create policy "perfil storage: dono envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "perfil storage: dono lista" on storage.objects for select to authenticated
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "perfil storage: dono apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- 7. Sua média x a dos amigos ----------
-- Para o rótulo "mais exigente que X% dos amigos". security invoker: só conta
-- as notas que você já pode ver (RLS). Vale a nota mais recente de cada item;
-- só entra quem tem pelo menos 5 notas na categoria.
create or replace function public.rating_vs_friends(p_category text default null)
returns table (my_avg numeric, my_count int, friends_counted int, friends_more_generous int)
language sql stable security invoker set search_path = ''
as $$
  with people as (
    select auth.uid() as id
    union
    select case when f.user_a = auth.uid() then f.user_b else f.user_a end
    from public.friendships f
    where f.status = 'aceita' and auth.uid() in (f.user_a, f.user_b)
  ),
  latest as (
    select distinct on (r.user_id, r.item_id) r.user_id, r.rating
    from public.reviews r
    join public.items i on i.id = r.item_id
    where r.rating is not null
      and r.user_id in (select id from people)
      and (p_category is null or i.category = p_category)
    order by r.user_id, r.item_id, r.experienced_at desc, r.created_at desc
  ),
  avgs as (
    select user_id, avg(rating) as a, count(*)::int as n
    from latest group by user_id having count(*) >= 5
  ),
  me as (select a, n from avgs where user_id = auth.uid())
  select
    (select round(a, 2) from me),
    (select n from me),
    (select count(*)::int from avgs where user_id <> auth.uid()),
    (select count(*)::int from avgs where user_id <> auth.uid() and a > (select a from me));
$$;

-- ---------- Permissões das funções ----------
revoke execute on function public.check_item_category(), public.check_ranking_in_diary() from public, anon, authenticated;
revoke execute on function public.save_ranking(smallint, text, uuid[], public.visibility) from public, anon;
grant  execute on function public.save_ranking(smallint, text, uuid[], public.visibility) to authenticated;
revoke execute on function public.rating_vs_friends(text) from public, anon;
grant  execute on function public.rating_vs_friends(text) to authenticated;
