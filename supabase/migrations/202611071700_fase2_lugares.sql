-- =====================================================================
-- MMISC · Fase 2a · Lugares (banco)
--
-- 1. Categorias novas de lugar: restaurante e café. Drink, prato e banheiro podem morar nelas.
--    Bar, restaurante e café passam a ter nota por comparação (decisão do dono, 07/11).
-- 2. Apagar item: o criador só apaga se ninguém mais usa (antes, apagar levava junto, em
--    cascata, as reviews de outras pessoas). Corrige o risco anotado na fase 1.
-- 3. Tipo genérico automático: todo drink/prato criado num lugar é ligado ("e_um") ao item
--    genérico de mesmo nome ("Negroni"), criado na hora se não existir. Os drinks/pratos que
--    já existem ganham a ligação aqui mesmo. Base do "melhor Negroni de SP".
-- 4. best_places_for(genérico, área): onde tomar/comer aquilo, do melhor para o pior, com a
--    nota que VOCÊ pode ver (security invoker: a RLS de reviews decide).
-- 5. place_ranks: sua ordem pessoal de lugares (estilo Beli: gostei / ok / não gostei e,
--    dentro de cada grupo, melhor ou pior que os outros). Tem visibilidade privado/amigos/publico.
-- =====================================================================

-- ---------- 1. Categorias ----------
insert into public.categories (slug, label, criteria, sort_order, grupo, mora_em, campos, modo_nota) values
  ('restaurante', 'Restaurante', array['Comida', 'Atendimento', 'Ambiente', 'Preço'], 11, 'lugar', '{}',
   '[{"id": "faixa_preco", "tipo": "faixa", "rotulo": "Faixa de preço"}]', 'comparacao'),
  ('cafe', 'Café', array['Café', 'Comida', 'Ambiente', 'Preço'], 12, 'lugar', '{}',
   '[{"id": "da_para_trabalhar", "tipo": "sim_nao", "rotulo": "Dá para trabalhar"}]', 'comparacao')
on conflict (slug) do nothing;

update public.categories set mora_em = array['bar', 'restaurante', 'cafe'] where slug in ('drink', 'prato', 'banheiro');
update public.categories set modo_nota = 'comparacao' where slug in ('bar', 'restaurante', 'cafe');

-- ---------- 2. Apagar só o que ninguém mais usa ----------
-- security definer: precisa enxergar reviews privadas de outras pessoas só para responder sim/não.
create or replace function public.item_in_use_by_others(p_item uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.reviews   where item_id = p_item and user_id <> auth.uid())
      or exists (select 1 from public.watchlist where item_id = p_item and user_id <> auth.uid())
      or exists (select 1 from public.favorites where item_id = p_item and user_id <> auth.uid())
      or exists (select 1 from public.rankings  where item_id = p_item and user_id <> auth.uid())
      or exists (select 1 from public.items     where parent_id = p_item)
      or exists (select 1 from public.item_links where to_item = p_item);
$$;
revoke execute on function public.item_in_use_by_others(uuid) from public, anon;
grant  execute on function public.item_in_use_by_others(uuid) to authenticated;

drop policy if exists "itens: criador apaga" on public.items;
create policy "itens: criador apaga se ninguém mais usa" on public.items for delete to authenticated
  using (created_by = auth.uid() and not public.item_in_use_by_others(id));

-- ---------- 3. Tipo genérico automático ----------
-- um genérico por nome e categoria ("Negroni" de drink é um só)
create unique index items_generic_uq on public.items (category, lower(btrim(title)))
  where source = 'generico';

-- devolve (ou cria) o genérico e liga o item do lugar a ele
create or replace function public.link_generic(p_item uuid)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  it  public.items;
  gen uuid;
begin
  select * into it from public.items where id = p_item;
  if it.id is null or it.parent_id is null or it.category not in ('drink', 'prato') then return null; end if;
  select l.to_item into gen from public.item_links l where l.from_item = p_item and l.tipo = 'e_um';
  if gen is not null then return gen; end if;
  select i.id into gen from public.items i
   where i.source = 'generico' and i.category = it.category and lower(btrim(i.title)) = lower(btrim(it.title));
  if gen is null then
    insert into public.items (category, title, source) values (it.category, btrim(it.title), 'generico')
    on conflict do nothing returning id into gen;
    if gen is null then
      select i.id into gen from public.items i
       where i.source = 'generico' and i.category = it.category and lower(btrim(i.title)) = lower(btrim(it.title));
    end if;
  end if;
  insert into public.item_links (from_item, to_item, tipo) values (p_item, gen, 'e_um') on conflict do nothing;
  return gen;
end;
$$;
revoke execute on function public.link_generic(uuid) from public, anon;
grant  execute on function public.link_generic(uuid) to authenticated;

-- ensure_child_item agora também liga ao genérico
create or replace function public.ensure_child_item(p_parent uuid, p_category text, p_title text)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  t   text := btrim(p_title);
  got uuid;
begin
  if t is null or char_length(t) not between 1 and 200 then
    raise exception 'nome inválido' using errcode = '22023';
  end if;
  select i.id into got from public.items i
   where i.parent_id = p_parent and i.category = p_category and lower(btrim(i.title)) = lower(t);
  if got is null then
    insert into public.items (category, title, parent_id, source)
    values (p_category, t, p_parent, 'manual')
    on conflict do nothing
    returning id into got;
    if got is null then  -- outra pessoa criou no mesmo instante
      select i.id into got from public.items i
       where i.parent_id = p_parent and i.category = p_category and lower(btrim(i.title)) = lower(t);
    end if;
  end if;
  perform public.link_generic(got);
  return got;
end;
$$;

-- os drinks/pratos que já existem (fase 1) ganham genérico e ligação agora
do $$
declare
  r record;
  gen uuid;
begin
  for r in select i.id, i.category, i.title from public.items i
            where i.parent_id is not null and i.category in ('drink', 'prato')
              and not exists (select 1 from public.item_links l where l.from_item = i.id and l.tipo = 'e_um')
  loop
    select g.id into gen from public.items g
     where g.source = 'generico' and g.category = r.category and lower(btrim(g.title)) = lower(btrim(r.title));
    if gen is null then
      insert into public.items (category, title, source, created_by) values (r.category, btrim(r.title), 'generico', null)
      returning id into gen;
    end if;
    insert into public.item_links (from_item, to_item, tipo, created_by) values (r.id, gen, 'e_um', null) on conflict do nothing;
  end loop;
end $$;

-- ---------- 4. Onde tomar/comer: o melhor de um genérico ----------
-- Nota por lugar = média da entrada mais recente de cada pessoa (as que VOCÊ pode ver).
-- Ordem: média "bayesiana" (puxa para 3,5 quem tem poucas notas) para 1 nota 5,0 não ganhar de 20 notas 4,6.
create or replace function public.best_places_for(p_generic uuid, p_area text default null)
returns table (item_id uuid, place_id uuid, place_title text, place_area text, place_category text,
               avg_rating numeric, ratings int, score numeric)
language sql stable security invoker set search_path = ''
as $$
  with filhos as (
    select c.id as item_id, p.id as place_id, p.title as place_title, p.subtitle as place_area, p.category as place_category
    from public.item_links l
    join public.items c on c.id = l.from_item
    join public.items p on p.id = c.parent_id
    where l.to_item = p_generic and l.tipo = 'e_um'
      and (p_area is null or btrim(p_area) = '' or p.subtitle ilike '%' || btrim(p_area) || '%')
  ), ultimas as (
    select distinct on (r.item_id, r.user_id) r.item_id, r.rating
    from public.reviews r
    join filhos f on f.item_id = r.item_id
    order by r.item_id, r.user_id, r.experienced_at desc, r.created_at desc
  ), notas as (
    select u.item_id, avg(u.rating) as media, count(u.rating)::int as n
    from ultimas u where u.rating is not null group by u.item_id
  )
  select f.item_id, f.place_id, f.place_title, f.place_area, f.place_category,
         round(n.media, 2), coalesce(n.n, 0),
         round(coalesce((n.media * n.n + 3.5 * 2) / (n.n + 2), 0), 3)
  from filhos f left join notas n on n.item_id = f.item_id
  order by coalesce((n.media * n.n + 3.5 * 2) / (n.n + 2), 0) desc, coalesce(n.n, 0) desc, f.place_title
  limit 100;
$$;
revoke execute on function public.best_places_for(uuid, text) from public, anon;
grant  execute on function public.best_places_for(uuid, text) to authenticated;

-- ---------- 5. Ranking pessoal por comparação ----------
create table public.place_ranks (
  user_id     uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  category    text not null references public.categories (slug),
  item_id     uuid not null references public.items (id) on delete cascade,
  bucket      smallint not null check (bucket in (1, 2, 3)),  -- 3 gostei · 2 ok · 1 não gostei
  pos         double precision not null,                       -- maior = melhor, dentro do grupo
  visibility  public.visibility not null default 'amigos',
  updated_at  timestamptz not null default now(),
  primary key (user_id, item_id)
);
create index place_ranks_order_idx on public.place_ranks (user_id, category, bucket desc, pos desc);
create trigger place_ranks_item_category before insert or update on public.place_ranks
  for each row execute function public.check_item_category();
create trigger place_ranks_touch before update on public.place_ranks
  for each row execute function public.touch_updated_at();

alter table public.place_ranks enable row level security;
create policy "ranking de lugares: lê conforme visibilidade" on public.place_ranks for select to authenticated
  using (public.can_see_review(user_id, visibility));
create policy "ranking de lugares: dono cria"  on public.place_ranks for insert to authenticated with check (user_id = auth.uid());
create policy "ranking de lugares: dono edita" on public.place_ranks for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ranking de lugares: dono tira"  on public.place_ranks for delete to authenticated using (user_id = auth.uid());
revoke all on public.place_ranks from anon, authenticated;
grant select, insert, update, delete on public.place_ranks to authenticated;
