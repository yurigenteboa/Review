-- =====================================================================
-- MMISC · F2 · diário, quero ver, notas privadas, vi com quem, streamings
--
-- O que muda:
--   1. reviews vira DIÁRIO em todas as categorias: a mesma pessoa pode
--      registrar o mesmo item várias vezes (rever filme, reouvir álbum,
--      voltar ao bar). Sai o unique (user_id, item_id).
--      Colunas novas: rewatch, loved (♥), spoiler, watched_where.
--      experienced_at (já existia) vira "quando viu" e passa a ser obrigatória.
--      rating pode ficar vazio ("vi" sem nota).
--   2. watchlist ("quero ver"): mesma regra privado / amigos / público
--      das reviews. Sai sozinha quando a pessoa registra o item.
--   3. entry_notes (nota privada de cada entrada): SEMPRE só do dono.
--      Fica em tabela própria porque o RLS libera a linha inteira: se fosse
--      coluna de reviews, quem vê a review veria a nota.
--   4. entry_companions ("vi com quem"): só dá para marcar amigo aceito.
--      Quem foi marcado recebe uma notificação com o item e a data, para
--      registrar a própria entrada em 1 toque. Ninguém escreve no diário
--      de outra pessoa.
--   5. user_services (streamings que a pessoa assina): SEMPRE só do dono.
--   6. taste_match passa a usar a nota mais recente de cada pessoa por item.
--   7. notificações ganham o tipo 'companion' (+ item_id e data).
--
-- Nenhuma regra existente fica mais aberta. Tabelas "só do dono" não têm
-- variação privado/amigos/público de propósito: são sempre privadas.
-- =====================================================================

-- ---------- 1. reviews vira diário ----------
alter table public.reviews drop constraint if exists reviews_user_id_item_id_key;

alter table public.reviews alter column rating drop not null;

update public.reviews set experienced_at = created_at::date where experienced_at is null;
alter table public.reviews alter column experienced_at set default current_date;
alter table public.reviews alter column experienced_at set not null;

alter table public.reviews
  add column rewatch        boolean not null default false,
  add column loved          boolean not null default false,
  add column spoiler        boolean not null default false,
  add column watched_where  text check (watched_where in ('cinema', 'streaming', 'casa', 'outro'));

-- diário de uma pessoa (perfil) e entradas de um item, mais recentes primeiro
create index if not exists reviews_user_diary_idx on public.reviews (user_id, experienced_at desc, created_at desc);
create index if not exists reviews_user_item_idx  on public.reviews (user_id, item_id, experienced_at desc);

-- ---------- 2. Quero ver ----------
create table public.watchlist (
  user_id     uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  item_id     uuid not null references public.items (id) on delete cascade,
  visibility  public.visibility not null default 'amigos',
  created_at  timestamptz not null default now(),
  primary key (user_id, item_id)
);
create index watchlist_item_idx on public.watchlist (item_id);

alter table public.watchlist enable row level security;
-- privado = só o dono · amigos = dono + amigos aceitos · publico = qualquer logado
create policy "quero ver: lê conforme visibilidade" on public.watchlist for select to authenticated
  using (public.can_see_review(user_id, visibility));
create policy "quero ver: dono adiciona" on public.watchlist for insert to authenticated
  with check (user_id = auth.uid());
create policy "quero ver: dono edita"    on public.watchlist for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "quero ver: dono tira"     on public.watchlist for delete to authenticated
  using (user_id = auth.uid());

-- registrou o item -> sai do "quero ver" (roda como quem registrou: a policy "dono tira" vale)
create or replace function public.watchlist_remove_on_entry()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  delete from public.watchlist where user_id = new.user_id and item_id = new.item_id;
  return new;
end;
$$;
create trigger reviews_leave_watchlist after insert on public.reviews
  for each row execute function public.watchlist_remove_on_entry();

-- ---------- 3. Notas privadas ----------
create table public.entry_notes (
  review_id   uuid primary key references public.reviews (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  body        text not null check (char_length(trim(body)) between 1 and 5000),
  updated_at  timestamptz not null default now()
);

alter table public.entry_notes enable row level security;
-- sempre privado: só o dono da entrada lê, cria, edita e apaga
create policy "notas: dono lê"    on public.entry_notes for select to authenticated
  using (user_id = auth.uid());
create policy "notas: dono cria"  on public.entry_notes for insert to authenticated
  with check (user_id = auth.uid()
              and exists (select 1 from public.reviews r where r.id = review_id and r.user_id = auth.uid()));
create policy "notas: dono edita" on public.entry_notes for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid()
              and exists (select 1 from public.reviews r where r.id = review_id and r.user_id = auth.uid()));
create policy "notas: dono apaga" on public.entry_notes for delete to authenticated
  using (user_id = auth.uid());

create trigger entry_notes_touch before update on public.entry_notes
  for each row execute function public.touch_updated_at();

-- ---------- 4. Vi com quem ----------
create table public.entry_companions (
  review_id   uuid not null references public.reviews (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (review_id, user_id)
);
create index entry_companions_user_idx on public.entry_companions (user_id);

alter table public.entry_companions enable row level security;
-- lê: quem foi marcado, ou quem pode ver a entrada (a subconsulta já passa pela regra das reviews)
create policy "companhia: lê" on public.entry_companions for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.reviews r where r.id = review_id));
-- marca: só o autor da entrada, e só amigos aceitos
create policy "companhia: autor marca amigo" on public.entry_companions for insert to authenticated
  with check (
    user_id <> auth.uid()
    and public.is_friend_of(user_id)
    and exists (select 1 from public.reviews r where r.id = review_id and r.user_id = auth.uid())
  );
-- desmarca: o autor da entrada ou a própria pessoa marcada
create policy "companhia: autor ou marcado desmarca" on public.entry_companions for delete to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from public.reviews r where r.id = review_id and r.user_id = auth.uid()));

-- ---------- 5. Meus streamings ----------
create table public.user_services (
  user_id      uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  provider_id  int  not null check (provider_id > 0),        -- id do provedor no TMDB/JustWatch
  name         text not null check (char_length(name) between 1 and 80),
  logo_path    text,
  created_at   timestamptz not null default now(),
  primary key (user_id, provider_id)
);

alter table public.user_services enable row level security;
-- sempre privado: só o dono
create policy "streamings: dono lê"   on public.user_services for select to authenticated using (user_id = auth.uid());
create policy "streamings: dono add"  on public.user_services for insert to authenticated with check (user_id = auth.uid());
create policy "streamings: dono tira" on public.user_services for delete to authenticated using (user_id = auth.uid());

-- ---------- 6. Notificação "vi com você" ----------
alter table public.notifications
  add column item_id  uuid references public.items (id) on delete cascade,
  add column meta     jsonb not null default '{}';

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('friend_request', 'friend_accepted', 'like', 'comment', 'companion'));

-- A notificação leva o item e a data (não a review), para funcionar mesmo
-- quando a entrada de quem marcou é privada.
create or replace function public.notify_companion()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  rv public.reviews;
begin
  select * into rv from public.reviews where id = new.review_id;
  if rv.id is null or rv.user_id = new.user_id then return new; end if;
  delete from public.notifications
   where type = 'companion' and user_id = new.user_id and actor_id = rv.user_id and item_id = rv.item_id;
  insert into public.notifications (user_id, actor_id, type, item_id, meta)
  values (new.user_id, rv.user_id, 'companion', rv.item_id,
          jsonb_build_object('watched_on', rv.experienced_at, 'watched_where', rv.watched_where));
  return new;
end;
$$;
create trigger entry_companions_notify after insert on public.entry_companions
  for each row execute function public.notify_companion();

-- ---------- 7. Comparação de gosto com diário ----------
-- Nota mais recente de cada pessoa por item; entradas sem nota não contam.
create or replace function public.taste_match(other uuid)
returns table (item_id uuid, title text, category text, image_url text, my_rating numeric, their_rating numeric)
language sql stable security invoker set search_path = ''
as $$
  with mine as (
    select distinct on (r.item_id) r.item_id, r.rating
    from public.reviews r
    where r.user_id = auth.uid() and r.rating is not null
    order by r.item_id, r.experienced_at desc, r.created_at desc
  ), theirs as (
    select distinct on (r.item_id) r.item_id, r.rating
    from public.reviews r
    where r.user_id = other and r.rating is not null
    order by r.item_id, r.experienced_at desc, r.created_at desc
  )
  select i.id, i.title, i.category, i.image_url, a.rating, b.rating
  from mine a
  join theirs b on b.item_id = a.item_id
  join public.items i on i.id = a.item_id
  where other <> auth.uid()
  order by abs(a.rating - b.rating), i.title;
$$;

-- ---------- Permissões das funções ----------
revoke execute on function public.taste_match(uuid) from public, anon;
grant execute on function public.taste_match(uuid) to authenticated;
-- funções de gatilho: ninguém chama direto
revoke execute on function public.notify_companion(), public.watchlist_remove_on_entry() from public, anon, authenticated;
