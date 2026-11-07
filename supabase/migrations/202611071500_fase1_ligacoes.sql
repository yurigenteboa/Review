-- =====================================================================
-- MMISC · Fase 1 · Ligações: coisas dentro de coisas
--
-- 1. Categorias que se descrevem (grupo, onde podem morar, campos extras, modo de nota)
--    + categorias novas: drink e prato.
-- 2. items.parent_id: o Negroni do Bar Brahma MORA no Bar Brahma (o banheiro também).
--    Não dá para apagar um lugar que tem coisas dentro (on delete restrict).
--    Um mesmo lugar não tem dois filhos com o mesmo nome (evita "Negroni" e "negroni ").
-- 3. item_links: ligações entre itens. Agora só "e_um" (o Negroni do Bar Brahma É UM Negroni,
--    item genérico que junta todos os Negronis -> ranking "melhor Negroni de SP" na fase 2).
--    Os outros tipos (apresenta, visto_em, adaptado_em) entram nas fases que os usam.
-- 4. reviews.parent_review_id: entrada composta. A noite no bar é uma entrada; os drinks são
--    entradas filhas dela. A filha herda SEMPRE a visibilidade e a data da mãe (trigger).
-- 5. item_redirects + admin.merge_items(): fusão de duplicados pelo dono, no SQL Editor.
--
-- RLS: nenhuma policy existente muda. Tabelas novas:
--   item_links     catálogo, como `items`: todo logado lê; cada um cria e apaga só o que criou.
--   item_redirects catálogo: todo logado lê; ninguém escreve pelo app (só o dono, via admin.merge_items).
-- Não há "privado/amigos/publico" nelas porque não são conteúdo de ninguém (igual a `items`).
-- A visibilidade das entradas filhas continua pela regra de sempre de `reviews` (can_see_review),
-- com o valor copiado da mãe.
-- =====================================================================

-- ---------- 1. Categorias que se descrevem ----------
alter table public.categories
  add column grupo     text   not null default 'cultura' check (grupo in ('cultura', 'lugar', 'consumo', 'evento')),
  add column mora_em   text[] not null default '{}',
  add column campos    jsonb  not null default '[]' check (jsonb_typeof(campos) = 'array'),
  add column modo_nota text   not null default 'estrelas' check (modo_nota in ('estrelas', 'comparacao'));

update public.categories set grupo = 'lugar' where slug in ('bar', 'cidade', 'banheiro');
update public.categories set mora_em = array['bar'] where slug = 'banheiro';

insert into public.categories (slug, label, criteria, sort_order, grupo, mora_em, campos) values
  ('drink', 'Drink', array['Sabor', 'Equilíbrio', 'Preço'], 9,  'consumo', array['bar'],
   '[{"id": "preco", "tipo": "dinheiro", "rotulo": "Quanto pagou"}]'),
  ('prato', 'Prato', array['Sabor', 'Porção', 'Preço'],      10, 'consumo', array['bar'],
   '[{"id": "preco", "tipo": "dinheiro", "rotulo": "Quanto pagou"}]')
on conflict (slug) do nothing;

-- ---------- 2. Item mora dentro de item ----------
alter table public.items
  add column parent_id uuid references public.items (id) on delete restrict;
create index items_parent_idx on public.items (parent_id) where parent_id is not null;
-- mesmo lugar, mesma categoria, mesmo nome (sem maiúsculas/espaços nas pontas) = o mesmo item
create unique index items_child_name_uq on public.items (parent_id, category, lower(btrim(title)))
  where parent_id is not null;

create or replace function public.check_item_parent()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  p_cat   text;
  allowed text[];
  cur     uuid;
  depth   int := 0;
begin
  if new.parent_id is null then return new; end if;
  if new.parent_id = new.id then
    raise exception 'um item não pode morar dentro de si mesmo' using errcode = '23514';
  end if;
  select i.category into p_cat from public.items i where i.id = new.parent_id;
  select c.mora_em into allowed from public.categories c where c.slug = new.category;
  if p_cat is null or not (p_cat = any (coalesce(allowed, '{}'))) then
    raise exception '% não pode morar dentro de %', new.category, coalesce(p_cat, 'item inexistente') using errcode = '23514';
  end if;
  -- no máximo 3 níveis (festival > edição > show) e sem voltas
  cur := new.parent_id;
  while cur is not null loop
    depth := depth + 1;
    if cur = new.id or depth > 3 then
      raise exception 'ligação de itens com volta ou funda demais' using errcode = '23514';
    end if;
    select i.parent_id into cur from public.items i where i.id = cur;
  end loop;
  return new;
end;
$$;

create trigger items_check_parent before insert or update of parent_id, category on public.items
  for each row execute function public.check_item_parent();

-- Registro rápido: "o que você pediu?" devolve o item que já existe no lugar ou cria um novo.
-- security invoker: cria como quem chamou (policy "itens: logado cria" vale normalmente).
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
  if got is not null then return got; end if;
  insert into public.items (category, title, parent_id, source)
  values (p_category, t, p_parent, 'manual')
  on conflict do nothing
  returning id into got;
  if got is null then  -- outra pessoa criou no mesmo instante
    select i.id into got from public.items i
     where i.parent_id = p_parent and i.category = p_category and lower(btrim(i.title)) = lower(t);
  end if;
  return got;
end;
$$;
revoke execute on function public.ensure_child_item(uuid, text, text) from public, anon;
grant  execute on function public.ensure_child_item(uuid, text, text) to authenticated;

-- ---------- 3. Ligações entre itens ----------
create table public.item_links (
  from_item   uuid not null references public.items (id) on delete cascade,
  to_item     uuid not null references public.items (id) on delete cascade,
  tipo        text not null check (tipo in ('e_um')),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (from_item, to_item, tipo),
  check (from_item <> to_item)
);
create index item_links_to_idx on public.item_links (to_item, tipo);
-- cada item é "um" só tipo genérico
create unique index item_links_one_kind_uq on public.item_links (from_item) where tipo = 'e_um';

create or replace function public.check_item_link()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  f public.items;
  t public.items;
begin
  select * into f from public.items where id = new.from_item;
  select * into t from public.items where id = new.to_item;
  if new.tipo = 'e_um' then
    -- de um item de lugar (tem parent) para o genérico da mesma categoria (sem parent)
    if f.parent_id is null or t.parent_id is not null or f.category <> t.category then
      raise exception 'e_um liga um item de um lugar ao tipo genérico da mesma categoria' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger item_links_check before insert or update on public.item_links
  for each row execute function public.check_item_link();

alter table public.item_links enable row level security;
create policy "ligações: logado lê"       on public.item_links for select to authenticated using (true);
create policy "ligações: logado cria"     on public.item_links for insert to authenticated with check (created_by = auth.uid());
create policy "ligações: criador apaga"   on public.item_links for delete to authenticated using (created_by = auth.uid());
revoke all on public.item_links from anon, authenticated;
grant select, insert, delete on public.item_links to authenticated;

-- ---------- 4. Entrada composta ----------
alter table public.reviews
  add column parent_review_id uuid references public.reviews (id) on delete cascade;
create index reviews_parent_idx on public.reviews (parent_review_id) where parent_review_id is not null;

-- A filha: mesma pessoa, um nível só, item que mora no item da mãe; herda visibilidade e data.
create or replace function public.check_review_parent()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  mae         public.reviews;
  item_parent uuid;
begin
  if new.parent_review_id is null then return new; end if;
  select * into mae from public.reviews r where r.id = new.parent_review_id;
  if mae.id is null or mae.user_id <> new.user_id then
    raise exception 'a entrada mãe tem de ser sua' using errcode = '23514';
  end if;
  if mae.parent_review_id is not null then
    raise exception 'entrada filha não pode ter filhas' using errcode = '23514';
  end if;
  select i.parent_id into item_parent from public.items i where i.id = new.item_id;
  if item_parent is distinct from mae.item_id then
    raise exception 'o item da entrada filha tem de morar no item da entrada mãe' using errcode = '23514';
  end if;
  new.visibility     := mae.visibility;
  new.experienced_at := mae.experienced_at;
  return new;
end;
$$;
create trigger reviews_check_parent
  before insert or update of parent_review_id, item_id, user_id, visibility, experienced_at on public.reviews
  for each row execute function public.check_review_parent();

-- Mudou a visibilidade ou a data da mãe: as filhas acompanham.
create or replace function public.sync_review_children()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if new.visibility is distinct from old.visibility or new.experienced_at is distinct from old.experienced_at then
    update public.reviews
       set visibility = new.visibility, experienced_at = new.experienced_at
     where parent_review_id = new.id;
  end if;
  return null;
end;
$$;
create trigger reviews_sync_children after update of visibility, experienced_at on public.reviews
  for each row when (new.parent_review_id is null)
  execute function public.sync_review_children();

-- ---------- 5. Fusão de duplicados ----------
create table public.item_redirects (
  old_id      uuid primary key,
  new_id      uuid not null references public.items (id) on delete cascade,
  merged_at   timestamptz not null default now()
);
alter table public.item_redirects enable row level security;
create policy "redirecionamentos: logado lê" on public.item_redirects for select to authenticated using (true);
revoke all on public.item_redirects from anon, authenticated;
grant select on public.item_redirects to authenticated;

-- Só o dono, no SQL Editor: `select admin.merge_items('<duplicado>', '<o que fica>');`
-- Move tudo que aponta para o duplicado, descarta o que ficaria repetido, guarda o redirecionamento
-- (links antigos /item/<duplicado> continuam abrindo) e apaga o duplicado.
create schema if not exists admin;
revoke all on schema admin from public, anon, authenticated;

create or replace function admin.merge_items(p_old uuid, p_new uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  o public.items;
  n public.items;
begin
  select * into o from public.items where id = p_old;
  select * into n from public.items where id = p_new;
  if o.id is null or n.id is null then raise exception 'item não encontrado'; end if;
  if o.id = n.id then raise exception 'é o mesmo item'; end if;
  if o.category <> n.category then raise exception 'categorias diferentes: % e %', o.category, n.category; end if;

  update public.reviews        set item_id = p_new where item_id = p_old;
  update public.notifications  set item_id = p_new where item_id = p_old;
  update public.profile_now    set item_id = p_new where item_id = p_old;
  -- onde a mesma pessoa já tem o item novo, a linha do duplicado sai
  delete from public.watchlist w where w.item_id = p_old and exists (select 1 from public.watchlist x where x.user_id = w.user_id and x.item_id = p_new);
  update public.watchlist      set item_id = p_new where item_id = p_old;
  delete from public.favorites f where f.item_id = p_old and exists (select 1 from public.favorites x where x.user_id = f.user_id and x.item_id = p_new);
  update public.favorites      set item_id = p_new where item_id = p_old;
  delete from public.rankings r where r.item_id = p_old and exists (select 1 from public.rankings x where x.user_id = r.user_id and x.year = r.year and x.category = r.category and x.item_id = p_new);
  update public.rankings       set item_id = p_new where item_id = p_old;
  -- coisas que moravam no duplicado passam a morar no que fica (mesmo nome = funde também)
  update public.items c set parent_id = p_new
   where c.parent_id = p_old
     and not exists (select 1 from public.items x where x.parent_id = p_new and x.category = c.category and lower(btrim(x.title)) = lower(btrim(c.title)));
  -- ligações
  delete from public.item_links l where l.from_item = p_old and exists (select 1 from public.item_links x where x.from_item = p_new and x.tipo = l.tipo);
  update public.item_links set from_item = p_new where from_item = p_old;
  delete from public.item_links l where l.to_item = p_old and exists (select 1 from public.item_links x where x.to_item = p_new and x.from_item = l.from_item and x.tipo = l.tipo);
  update public.item_links set to_item = p_new where to_item = p_old;
  -- redirecionamentos antigos que apontavam para o duplicado
  update public.item_redirects set new_id = p_new where new_id = p_old;
  insert into public.item_redirects (old_id, new_id) values (p_old, p_new)
    on conflict (old_id) do update set new_id = excluded.new_id, merged_at = now();

  if exists (select 1 from public.items where parent_id = p_old) then
    raise exception 'o duplicado ainda tem filhos com o mesmo nome dos do item que fica: funda esses filhos antes';
  end if;
  delete from public.items where id = p_old;
  return format('"%s" fundido em "%s"', o.title, n.title);
end;
$$;
revoke all on function admin.merge_items(uuid, uuid) from public, anon, authenticated;
