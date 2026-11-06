-- =====================================================================
-- MMISC · Fase 4 · social
-- Amizade mútua, convites, curtidas, comentários, notificações e
-- comparação de gosto. Substitui a tabela "follows" da Fase 2.
-- =====================================================================

-- ---------- Amizade mútua ----------
-- Um par por linha, sempre com user_a < user_b (evita duplicar A-B e B-A).
create type public.friend_status as enum ('pendente', 'aceita');

create table public.friendships (
  user_a        uuid not null references public.profiles (id) on delete cascade,
  user_b        uuid not null references public.profiles (id) on delete cascade,
  requested_by  uuid not null references public.profiles (id) on delete cascade,
  status        public.friend_status not null default 'pendente',
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  primary key (user_a, user_b),
  check (user_a < user_b),
  check (requested_by = user_a or requested_by = user_b)
);
create index friendships_user_b_idx on public.friendships (user_b);

alter table public.friendships enable row level security;
-- Cada um vê só as próprias amizades. Criar, aceitar e desfazer: só pelas funções abaixo.
create policy "amizades: envolvidos leem" on public.friendships for select to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b);

-- "amigos" agora = amizade aceita (vale para reviews, fotos e tudo que usa can_see_review)
create or replace function public.is_friend_of(author uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.user_a = least(auth.uid(), author)
      and f.user_b = greatest(auth.uid(), author)
      and f.status = 'aceita'
  );
$$;

-- a tabela antiga sai (estava vazia: a tela de seguir nunca existiu)
drop table public.follows;
drop type public.follow_status;

-- ---------- Funções de amizade ----------

-- Pedir amizade. Se a outra pessoa já tinha pedido, vira amizade na hora.
create or replace function public.request_friend(target uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  rec public.friendships;
begin
  if me is null then raise exception 'login necessário'; end if;
  if target = me then raise exception 'não dá para adicionar a si mesmo'; end if;
  if not exists (select 1 from public.profiles where id = target) then raise exception 'pessoa não encontrada'; end if;

  select * into rec from public.friendships
   where user_a = least(me, target) and user_b = greatest(me, target);

  if found then
    if rec.status = 'aceita' then return 'ja_amigos'; end if;
    if rec.requested_by = target then
      update public.friendships set status = 'aceita', accepted_at = now()
       where user_a = rec.user_a and user_b = rec.user_b;
      return 'aceita';
    end if;
    return 'pendente';
  end if;

  insert into public.friendships (user_a, user_b, requested_by)
  values (least(me, target), greatest(me, target), me);
  return 'pedido_enviado';
end;
$$;

-- Aceitar ou recusar um pedido recebido.
create or replace function public.respond_friend(other uuid, accept boolean)
returns text
language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'login necessário'; end if;
  if accept then
    update public.friendships set status = 'aceita', accepted_at = now()
     where user_a = least(me, other) and user_b = greatest(me, other)
       and status = 'pendente' and requested_by = other;
    if not found then raise exception 'pedido não encontrado'; end if;
    return 'aceita';
  else
    delete from public.friendships
     where user_a = least(me, other) and user_b = greatest(me, other)
       and status = 'pendente' and requested_by = other;
    return 'recusada';
  end if;
end;
$$;

-- Desfazer amizade ou cancelar um pedido enviado.
create or replace function public.remove_friend(other uuid)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.friendships
   where user_a = least(auth.uid(), other) and user_b = greatest(auth.uid(), other);
$$;

-- Lista de amigos e pedidos, do ponto de vista de quem chama.
create or replace function public.list_friends()
returns table (id uuid, username text, display_name text, avatar_url text, status public.friend_status, requested_by_me boolean, since timestamptz)
language sql stable security invoker set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_url, f.status, f.requested_by = auth.uid(),
         coalesce(f.accepted_at, f.created_at)
  from public.friendships f
  join public.profiles p on p.id = case when f.user_a = auth.uid() then f.user_b else f.user_a end
  where auth.uid() in (f.user_a, f.user_b)
  order by f.status, coalesce(f.accepted_at, f.created_at) desc;
$$;

-- ---------- Convites ----------
create table public.invites (
  code        text primary key,
  user_id     uuid not null unique references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table public.invites enable row level security;
create policy "convites: dono lê" on public.invites for select to authenticated using (user_id = auth.uid());

create or replace function public.new_invite_code()
returns text language sql volatile set search_path = ''
as $$ select substr(md5(random()::text || clock_timestamp()::text), 1, 10) $$;

-- Meu código de convite (cria na primeira vez).
create or replace function public.my_invite_code()
returns text
language plpgsql security definer set search_path = ''
as $$
declare c text;
begin
  if auth.uid() is null then raise exception 'login necessário'; end if;
  select code into c from public.invites where user_id = auth.uid();
  if c is null then
    c := public.new_invite_code();
    insert into public.invites (code, user_id) values (c, auth.uid());
  end if;
  return c;
end;
$$;

-- Troca o código (o link antigo para de funcionar).
create or replace function public.reset_invite_code()
returns text
language plpgsql security definer set search_path = ''
as $$
declare c text := public.new_invite_code();
begin
  if auth.uid() is null then raise exception 'login necessário'; end if;
  insert into public.invites (code, user_id) values (c, auth.uid())
  on conflict (user_id) do update set code = excluded.code, created_at = now();
  return c;
end;
$$;

-- Quem convidou (para a tela de convite, antes mesmo do login). Só devolve o nome.
create or replace function public.invite_owner(invite text)
returns table (id uuid, display_name text, username text)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.display_name, p.username
  from public.invites i join public.profiles p on p.id = i.user_id
  where i.code = invite;
$$;

-- Aceitar convite: vira amizade na hora, sem aprovação.
create or replace function public.accept_invite(invite text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  owner uuid;
begin
  if me is null then raise exception 'login necessário'; end if;
  select user_id into owner from public.invites where code = invite;
  if owner is null then raise exception 'convite inválido ou trocado'; end if;
  if owner = me then return owner; end if;
  insert into public.friendships (user_a, user_b, requested_by, status, accepted_at)
  values (least(me, owner), greatest(me, owner), owner, 'aceita', now())
  on conflict (user_a, user_b) do update set status = 'aceita', accepted_at = coalesce(public.friendships.accepted_at, now());
  return owner;
end;
$$;

-- ---------- Curtidas ----------
create table public.likes (
  review_id   uuid not null references public.reviews (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  created_at  timestamptz not null default now(),
  primary key (review_id, user_id)
);
create index likes_user_idx on public.likes (user_id);
alter table public.likes enable row level security;
-- "exists (select ... from reviews)" já passa pela regra de visibilidade das reviews
create policy "curtidas: lê se vê a review" on public.likes for select to authenticated
  using (exists (select 1 from public.reviews r where r.id = review_id));
create policy "curtidas: curte se vê a review" on public.likes for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.reviews r where r.id = review_id));
create policy "curtidas: descurte a própria" on public.likes for delete to authenticated
  using (user_id = auth.uid());

-- ---------- Comentários ----------
create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid not null references public.reviews (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  body        text not null check (char_length(trim(body)) between 1 and 1000),
  created_at  timestamptz not null default now()
);
create index comments_review_idx on public.comments (review_id, created_at);
alter table public.comments enable row level security;
create policy "comentários: lê se vê a review" on public.comments for select to authenticated
  using (exists (select 1 from public.reviews r where r.id = review_id));
create policy "comentários: comenta se vê a review" on public.comments for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.reviews r where r.id = review_id));
create policy "comentários: autor ou dono da review apaga" on public.comments for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.reviews r where r.id = review_id and r.user_id = auth.uid()));

-- ---------- Notificações ----------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  actor_id    uuid not null references public.profiles (id) on delete cascade,
  type        text not null check (type in ('friend_request', 'friend_accepted', 'like', 'comment')),
  review_id   uuid references public.reviews (id) on delete cascade,
  comment_id  uuid references public.comments (id) on delete cascade,
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy "notificações: dono lê"     on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notificações: dono marca"  on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notificações: dono apaga"  on public.notifications for delete to authenticated using (user_id = auth.uid());

-- Gatilhos que criam notificações (rodam como o banco, não como o usuário)
create or replace function public.notify_friendship()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare other uuid := case when new.requested_by = new.user_a then new.user_b else new.user_a end;
begin
  if tg_op = 'INSERT' and new.status = 'pendente' then
    insert into public.notifications (user_id, actor_id, type) values (other, new.requested_by, 'friend_request');
  elsif new.status = 'aceita' and (tg_op = 'INSERT' or old.status = 'pendente') then
    -- avisa quem pediu (ou quem convidou) que agora são amigos
    insert into public.notifications (user_id, actor_id, type) values (new.requested_by, other, 'friend_accepted');
    delete from public.notifications
     where type = 'friend_request' and user_id = other and actor_id = new.requested_by;
  end if;
  return new;
end;
$$;
create trigger friendships_notify after insert or update on public.friendships
  for each row execute function public.notify_friendship();

create or replace function public.notify_like()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare author uuid;
begin
  select user_id into author from public.reviews where id = new.review_id;
  if author is not null and author <> new.user_id then
    delete from public.notifications where type = 'like' and review_id = new.review_id and actor_id = new.user_id;
    insert into public.notifications (user_id, actor_id, type, review_id) values (author, new.user_id, 'like', new.review_id);
  end if;
  return new;
end;
$$;
create trigger likes_notify after insert on public.likes
  for each row execute function public.notify_like();

create or replace function public.notify_comment()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare author uuid;
begin
  select user_id into author from public.reviews where id = new.review_id;
  if author is not null and author <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, review_id, comment_id)
    values (author, new.user_id, 'comment', new.review_id, new.id);
  end if;
  return new;
end;
$$;
create trigger comments_notify after insert on public.comments
  for each row execute function public.notify_comment();

-- ---------- Comparação de gosto ----------
-- Itens que você e a outra pessoa avaliaram. Roda com as SUAS permissões:
-- só entram reviews dela que você já pode ver.
create or replace function public.taste_match(other uuid)
returns table (item_id uuid, title text, category text, image_url text, my_rating numeric, their_rating numeric)
language sql stable security invoker set search_path = ''
as $$
  select i.id, i.title, i.category, i.image_url, a.rating, b.rating
  from public.reviews a
  join public.reviews b on b.item_id = a.item_id and b.user_id = other
  join public.items i on i.id = a.item_id
  where a.user_id = auth.uid() and other <> auth.uid()
  order by abs(a.rating - b.rating), i.title;
$$;

-- ---------- Permissões das funções ----------
revoke execute on function public.request_friend(uuid), public.respond_friend(uuid, boolean), public.remove_friend(uuid),
  public.my_invite_code(), public.reset_invite_code(), public.accept_invite(text), public.list_friends(),
  public.taste_match(uuid) from public, anon;
grant execute on function public.request_friend(uuid), public.respond_friend(uuid, boolean), public.remove_friend(uuid),
  public.my_invite_code(), public.reset_invite_code(), public.accept_invite(text), public.list_friends(),
  public.taste_match(uuid) to authenticated;
-- o nome de quem convidou aparece na tela de convite antes do login
grant execute on function public.invite_owner(text) to anon, authenticated;
-- funções internas: ninguém chama direto
revoke execute on function public.new_invite_code(), public.notify_friendship(), public.notify_like(), public.notify_comment() from public, anon, authenticated;
