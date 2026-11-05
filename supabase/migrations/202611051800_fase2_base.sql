-- =====================================================================
-- Review · Fase 2 · estrutura base
-- Tabelas: profiles, categories, items, reviews, review_photos, follows
-- Regras (RLS): privado = só o autor · amigos = autor + quem ele aceitou
--               publico = qualquer usuário logado (visitante sem login: Fase 6)
-- =====================================================================

-- ---------- Tipos ----------
create type public.visibility as enum ('privado', 'amigos', 'publico');
create type public.follow_status as enum ('pendente', 'aceito');

-- ---------- Perfis ----------
-- Um perfil por conta. Criado automaticamente no cadastro (trigger abaixo).
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text unique check (username ~ '^[a-z0-9_.]{3,24}$'),
  display_name text,
  avatar_url  text,
  bio         text check (char_length(bio) <= 280),
  created_at  timestamptz not null default now()
);

-- ---------- Categorias ----------
-- Categoria é dado, não código: uma nova categoria é só uma linha nova.
create table public.categories (
  slug        text primary key,
  label       text not null,
  criteria    text[] not null default '{}',
  sort_order  int not null default 0
);

insert into public.categories (slug, label, criteria, sort_order) values
  ('album',    'Álbum',    array['Produção','Letras','Coesão'],               1),
  ('filme',    'Filme',    array['Roteiro','Fotografia','Atuação'],           2),
  ('serie',    'Série',    array['Roteiro','Elenco','Final'],                 3),
  ('jogo',     'Jogo',     array['Jogabilidade','Visual','História'],         4),
  ('livro',    'Livro',    array['Escrita','Ritmo','Final'],                  5),
  ('bar',      'Bar',      array['Bebida','Comida','Ambiente','Preço'],       6),
  ('banheiro', 'Banheiro', array['Limpeza','Papel','Cheiro','Acessível'],     7),
  ('cidade',   'Cidade',   array['Andar a pé','Comida','Custo'],              8);

-- ---------- Itens (a coisa avaliada) ----------
-- Catálogo compartilhado. Na Fase 3, os itens das APIs entram aqui com source + external_id.
create table public.items (
  id            uuid primary key default gen_random_uuid(),
  category      text not null references public.categories (slug),
  title         text not null check (char_length(title) between 1 and 200),
  subtitle      text,
  image_url     text,
  year          int,
  source        text not null default 'manual',   -- manual | tmdb | musicbrainz | igdb | google | osm | ibge
  external_id   text,
  metadata      jsonb not null default '{}',
  lat           double precision,
  lng           double precision,
  created_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  unique (source, external_id)
);
create index items_category_idx on public.items (category);
create index items_title_idx on public.items using gin (to_tsvector('portuguese', title));

-- ---------- Reviews ----------
create table public.reviews (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  item_id          uuid not null references public.items (id) on delete cascade,
  rating           numeric(2,1) not null check (rating >= 0.5 and rating <= 5 and rating * 2 = floor(rating * 2)),
  body             text check (char_length(body) <= 5000),
  criteria_scores  jsonb not null default '{}',     -- {"Limpeza": 4, "Papel": 2}
  visibility       public.visibility not null default 'amigos',
  experienced_at   date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, item_id)
);
create index reviews_user_idx on public.reviews (user_id, created_at desc);
create index reviews_item_idx on public.reviews (item_id);

-- ---------- Fotos das reviews ----------
create table public.review_photos (
  id            uuid primary key default gen_random_uuid(),
  review_id     uuid not null references public.reviews (id) on delete cascade,
  storage_path  text not null,
  position      int not null default 0
);

-- ---------- Seguir (a tela vem na Fase 4; a tabela já existe para a regra "amigos") ----------
create table public.follows (
  follower_id   uuid not null references public.profiles (id) on delete cascade,
  following_id  uuid not null references public.profiles (id) on delete cascade,
  status        public.follow_status not null default 'pendente',
  created_at    timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

-- =====================================================================
-- Funções auxiliares
-- =====================================================================

-- "viewer pode ver o conteúdo 'amigos' de author?" = author aceitou viewer como seguidor
create or replace function public.is_friend_of(author uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.follows f
    where f.follower_id = auth.uid()
      and f.following_id = author
      and f.status = 'aceito'
  );
$$;

-- regra única de visibilidade, usada por reviews e fotos
create or replace function public.can_see_review(r_user uuid, r_vis public.visibility)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select
    r_user = auth.uid()
    or r_vis = 'publico'
    or (r_vis = 'amigos' and public.is_friend_of(r_user));
$$;

-- cria o perfil no cadastro
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- mantém updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger reviews_touch before update on public.reviews
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- RLS (Row Level Security)
-- =====================================================================
alter table public.profiles      enable row level security;
alter table public.categories    enable row level security;
alter table public.items         enable row level security;
alter table public.reviews       enable row level security;
alter table public.review_photos enable row level security;
alter table public.follows       enable row level security;

-- Perfis: qualquer usuário logado vê nomes e avatares; cada um edita só o seu.
create policy "perfis: logado lê"       on public.profiles for select to authenticated using (true);
create policy "perfis: dono edita"      on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Categorias: só leitura pelo app.
create policy "categorias: todos leem"  on public.categories for select to anon, authenticated using (true);

-- Itens: catálogo compartilhado entre usuários logados; só quem criou edita ou apaga.
create policy "itens: logado lê"        on public.items for select to authenticated using (true);
create policy "itens: logado cria"      on public.items for insert to authenticated with check (created_by = auth.uid());
create policy "itens: criador edita"    on public.items for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "itens: criador apaga"    on public.items for delete to authenticated using (created_by = auth.uid());

-- Reviews: leitura segue a visibilidade; escrita só do próprio autor.
create policy "reviews: lê conforme visibilidade" on public.reviews for select to authenticated
  using (public.can_see_review(user_id, visibility));
create policy "reviews: autor cria"     on public.reviews for insert to authenticated with check (user_id = auth.uid());
create policy "reviews: autor edita"    on public.reviews for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reviews: autor apaga"    on public.reviews for delete to authenticated using (user_id = auth.uid());

-- Fotos: mesma regra da review a que pertencem.
create policy "fotos: lê conforme review" on public.review_photos for select to authenticated
  using (exists (select 1 from public.reviews r where r.id = review_id and public.can_see_review(r.user_id, r.visibility)));
create policy "fotos: autor gerencia"   on public.review_photos for all to authenticated
  using (exists (select 1 from public.reviews r where r.id = review_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.reviews r where r.id = review_id and r.user_id = auth.uid()));

-- Follows: cada um vê os próprios vínculos; pede para seguir; quem é seguido aceita; ambos podem desfazer.
create policy "follows: envolvidos leem" on public.follows for select to authenticated
  using (follower_id = auth.uid() or following_id = auth.uid());
create policy "follows: pedir"          on public.follows for insert to authenticated
  with check (follower_id = auth.uid() and status = 'pendente');
create policy "follows: aceitar"        on public.follows for update to authenticated
  using (following_id = auth.uid()) with check (following_id = auth.uid());
create policy "follows: desfazer"       on public.follows for delete to authenticated
  using (follower_id = auth.uid() or following_id = auth.uid());

-- =====================================================================
-- Storage: fotos das reviews
-- Pasta por usuário: review-photos/<user_id>/<arquivo>.webp
-- =====================================================================
insert into storage.buckets (id, name, public) values ('review-photos', 'review-photos', false);

create policy "fotos storage: dono envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'review-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fotos storage: dono apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'review-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fotos storage: lê se pode ver a review" on storage.objects for select to authenticated
  using (
    bucket_id = 'review-photos'
    and exists (
      select 1 from public.review_photos p
      join public.reviews r on r.id = p.review_id
      where p.storage_path = storage.objects.name
        and public.can_see_review(r.user_id, r.visibility)
    )
    or (bucket_id = 'review-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  );
