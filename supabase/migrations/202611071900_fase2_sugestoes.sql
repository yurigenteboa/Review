-- =====================================================================
-- MMISC · Fase 2d · Ficha do lugar e sugestões de edição
--
-- Decisão do dono (07/11): dados de lugar são editáveis por sugestão, aprovada por quem tem
-- 3+ registros no lugar ou pelo dono do app.
--
-- 1. Ficha do lugar em items.metadata->'ficha' (endereço, horário, faixa de preço, atributos,
--    site/Instagram). Bairro/cidade continua em items.subtitle (aparece em todo canto).
-- 2. place_suggestions: qualquer logado sugere uma mudança num campo de um lugar.
-- 3. Quem pode decidir: o criador do item, quem tem 3+ entradas no lugar, ou um admin do app.
--    Sugestão de quem já pode decidir é aplicada na hora (sem fila).
-- 4. app_admins: lista de admins (o dono se coloca pelo SQL Editor). Sem policy = invisível pelo app.
--
-- RLS: sugestões são lidas por todo logado (são sobre o catálogo, como `items`), criadas só no
-- próprio nome, e NINGUÉM atualiza/apaga direto: decidir é só pela RPC decide_suggestion.
-- Não há "privado/amigos/publico" porque sugestão de catálogo não é conteúdo pessoal.
-- =====================================================================

-- ---------- Admins do app ----------
create table public.app_admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon, authenticated;

-- ---------- Sugestões ----------
create table public.place_suggestions (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.items (id) on delete cascade,
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  field       text not null check (field in ('area', 'endereco', 'horario', 'faixa_preco', 'atributos', 'link')),
  value       jsonb not null check (pg_column_size(value) <= 2000),
  note        text check (char_length(note) <= 280),
  status      text not null default 'pendente' check (status in ('pendente', 'aprovada', 'recusada')),
  decided_by  uuid references auth.users (id) on delete set null,
  decided_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index place_suggestions_item_idx on public.place_suggestions (item_id, status, created_at desc);

-- valor de cada campo no formato certo
create or replace function public.valid_suggestion_value(p_field text, p_value jsonb)
returns boolean
language sql immutable set search_path = ''
as $$
  select case p_field
    when 'area'        then jsonb_typeof(p_value) = 'string' and char_length(p_value #>> '{}') between 2 and 120
    when 'endereco'    then jsonb_typeof(p_value) = 'string' and char_length(p_value #>> '{}') between 3 and 200
    when 'horario'     then jsonb_typeof(p_value) = 'string' and char_length(p_value #>> '{}') between 3 and 300
    when 'faixa_preco' then jsonb_typeof(p_value) = 'number' and (p_value #>> '{}')::numeric in (1, 2, 3, 4)
    when 'atributos'   then jsonb_typeof(p_value) = 'array' and jsonb_array_length(p_value) <= 12
                            and not exists (select 1 from jsonb_array_elements(p_value) e
                                            where jsonb_typeof(e) <> 'string'
                                               or (e #>> '{}') not in ('musica_ao_vivo', 'mesa_na_calcada', 'pet_friendly', 'bom_para_date',
                                                                       'bom_para_grupo', 'bom_para_trabalhar', 'wifi', 'tomada', 'acessivel',
                                                                       'aceita_reserva', 'vegetariano', 'abre_tarde'))
    when 'link'        then jsonb_typeof(p_value) = 'string' and (p_value #>> '{}') ~ '^https://[^\s]{3,200}$'
    else false
  end;
$$;

alter table public.place_suggestions
  add constraint place_suggestions_value_ok check (public.valid_suggestion_value(field, value));

-- só lugares recebem sugestão
create or replace function public.check_suggestion_item()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if not exists (select 1 from public.items i join public.categories c on c.slug = i.category
                 where i.id = new.item_id and c.grupo = 'lugar' and i.source <> 'generico') then
    raise exception 'só dá para sugerir edição de lugares' using errcode = '23514';
  end if;
  return new;
end;
$$;
-- triggers rodam em ordem alfabética: 1) confere o item, 2) aplica se puder
create trigger place_suggestions_1_item before insert on public.place_suggestions
  for each row execute function public.check_suggestion_item();

-- quem pode decidir sobre um lugar (security definer: conta entradas de qualquer visibilidade)
create or replace function public.can_curate_item(p_item uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and (
       exists (select 1 from public.app_admins a where a.user_id = auth.uid())
    or exists (select 1 from public.items i where i.id = p_item and i.created_by = auth.uid())
    or (select count(*) from public.reviews r where r.item_id = p_item and r.user_id = auth.uid()) >= 3
  );
$$;
revoke execute on function public.can_curate_item(uuid) from public, anon;
grant  execute on function public.can_curate_item(uuid) to authenticated;

-- aplica uma sugestão aprovada (interna)
create or replace function public.apply_suggestion(s public.place_suggestions)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if s.field = 'area' then
    update public.items set subtitle = s.value #>> '{}' where id = s.item_id;
  else
    update public.items
       set metadata = jsonb_set(coalesce(metadata, '{}'), array['ficha', s.field],
                                s.value, true)
     where id = s.item_id
       and coalesce(metadata, '{}') ? 'ficha';
    update public.items
       set metadata = coalesce(metadata, '{}') || jsonb_build_object('ficha', jsonb_build_object(s.field, s.value))
     where id = s.item_id
       and not (coalesce(metadata, '{}') ? 'ficha');
  end if;
end;
$$;
revoke all on function public.apply_suggestion(public.place_suggestions) from public, anon, authenticated;

-- sugestão de quem já pode decidir entra aprovada e aplicada
create or replace function public.auto_apply_suggestion()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if public.can_curate_item(new.item_id) then
    new.status := 'aprovada';
    new.decided_by := auth.uid();
    new.decided_at := now();
    perform public.apply_suggestion(new);
  else
    new.status := 'pendente';
    new.decided_by := null;
    new.decided_at := null;
  end if;
  return new;
end;
$$;
create trigger place_suggestions_2_auto before insert on public.place_suggestions
  for each row execute function public.auto_apply_suggestion();

-- decidir: aprovar aplica; recusar só marca. Não dá para decidir a própria sugestão (exceto admin).
create or replace function public.decide_suggestion(p_id uuid, p_approve boolean)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  s public.place_suggestions;
begin
  select * into s from public.place_suggestions where id = p_id for update;
  if s.id is null then raise exception 'sugestão não encontrada'; end if;
  if s.status <> 'pendente' then raise exception 'essa sugestão já foi decidida'; end if;
  if not public.can_curate_item(s.item_id) then
    raise exception 'você ainda não pode decidir sobre este lugar' using errcode = '42501';
  end if;
  if s.user_id = auth.uid() and not exists (select 1 from public.app_admins a where a.user_id = auth.uid()) then
    raise exception 'outra pessoa precisa decidir a sua sugestão' using errcode = '42501';
  end if;
  update public.place_suggestions
     set status = case when p_approve then 'aprovada' else 'recusada' end,
         decided_by = auth.uid(), decided_at = now()
   where id = p_id;
  if p_approve then perform public.apply_suggestion(s); end if;
  return case when p_approve then 'aprovada' else 'recusada' end;
end;
$$;
revoke execute on function public.decide_suggestion(uuid, boolean) from public, anon;
grant  execute on function public.decide_suggestion(uuid, boolean) to authenticated;

alter table public.place_suggestions enable row level security;
create policy "sugestões: logado lê"   on public.place_suggestions for select to authenticated using (true);
create policy "sugestões: logado cria" on public.place_suggestions for insert to authenticated with check (user_id = auth.uid());
revoke all on public.place_suggestions from anon, authenticated;
grant select, insert on public.place_suggestions to authenticated;

-- dono do app como administrador (pedido do dono em 07/11; aplicado junto com a migração)
insert into public.app_admins (user_id) select id from auth.users where email = 'yuri.moraes.soares@gmail.com' on conflict do nothing;
