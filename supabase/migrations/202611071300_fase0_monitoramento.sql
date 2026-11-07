-- =====================================================================
-- MMISC · Fase 0 · aviso de erros e métricas de uso (M5)
--
-- Duas tabelas que o app SÓ ESCREVE e ninguém lê pelo app:
--   client_errors  erros que aconteceram no aparelho de alguém
--   app_events     poucos eventos de uso (abrir o app, abrir/salvar/cancelar o registro…)
-- O dono lê pelo SQL Editor do painel (que entra como dono do banco e não passa pela RLS),
-- usando as views do schema `metricas`, que NÃO é exposto pela API.
--
-- Por que não "privado / amigos / publico": isso não é conteúdo de ninguém. A regra
-- explícita aqui é "só inserir o próprio registro, nunca ler, editar ou apagar".
-- Retenção: 180 dias (tarefa diária no pg_cron, se a extensão estiver ligada).
-- =====================================================================

-- ---------- Erros ----------
create table public.client_errors (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  user_id     uuid default auth.uid() references auth.users (id) on delete set null,
  kind        text not null check (kind in ('error', 'promise', 'react', 'query', 'mutation')),
  message     text not null check (char_length(message) between 1 and 500),
  stack       text check (char_length(stack) <= 4000),
  path        text check (char_length(path) <= 300),
  release     text check (char_length(release) <= 40),
  user_agent  text check (char_length(user_agent) <= 300)
);
create index client_errors_created_idx on public.client_errors (created_at desc);

-- ---------- Eventos de uso ----------
create table public.app_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id  text not null check (char_length(session_id) between 8 and 40),
  name        text not null check (name in ('app_open', 'compose_open', 'compose_saved', 'compose_cancel', 'search_empty')),
  props       jsonb not null default '{}' check (pg_column_size(props) <= 1000),
  release     text check (char_length(release) <= 40)
);
create index app_events_name_idx on public.app_events (name, created_at desc);
create index app_events_user_idx on public.app_events (user_id, created_at desc);

-- ---------- RLS: só inserir ----------
alter table public.client_errors enable row level security;
alter table public.app_events    enable row level security;

-- Erros: também sem login (a tela de login pode quebrar). Quem está logado só grava no próprio nome;
-- sem login, user_id fica vazio.
create policy "erros: grava o próprio" on public.client_errors for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- Eventos: só logado, só no próprio nome.
create policy "eventos: grava o próprio" on public.app_events for insert to authenticated
  with check (user_id = auth.uid());

-- Sem policy de select/update/delete = ninguém lê, edita ou apaga pelo app.
-- Tira também os privilégios de leitura, para não depender só da RLS.
revoke select, update, delete on public.client_errors from anon, authenticated;
revoke select, update, delete on public.app_events    from anon, authenticated;
grant insert on public.client_errors to anon, authenticated;
grant insert on public.app_events    to authenticated;

-- ---------- Views para o dono (fora da API) ----------
create schema if not exists metricas;
revoke all on schema metricas from public, anon, authenticated;

-- Erros agrupados dos últimos 14 dias: o que quebrou, quantas vezes, para quantas pessoas
create or replace view metricas.erros_14d as
select message, kind, release,
       count(*)                      as vezes,
       count(distinct user_id)       as pessoas,
       min(created_at)               as primeira,
       max(created_at)               as ultima,
       (array_agg(path order by created_at desc))[1]  as ultima_tela,
       (array_agg(stack order by created_at desc))[1] as ultimo_stack
from public.client_errors
where created_at > now() - interval '14 days'
group by message, kind, release
order by ultima desc;

-- Estrela-guia: registros por pessoa ativa por semana (semana começa na segunda, horário de SP)
create or replace view metricas.semanal as
with ativos as (
  select date_trunc('week', created_at at time zone 'America/Sao_Paulo')::date as semana,
         count(distinct user_id) as pessoas_ativas
  from public.app_events where name = 'app_open' group by 1
), registros as (
  select date_trunc('week', created_at at time zone 'America/Sao_Paulo')::date as semana,
         count(*) as registros, count(distinct user_id) as quem_registrou
  from public.reviews group by 1
)
select a.semana, a.pessoas_ativas, coalesce(r.registros, 0) as registros, coalesce(r.quem_registrou, 0) as quem_registrou,
       round(coalesce(r.registros, 0)::numeric / nullif(a.pessoas_ativas, 0), 2) as registros_por_ativo
from ativos a left join registros r using (semana)
order by a.semana desc;

-- Tempo de registro: de abrir o "+" até salvar (só registros novos, não edições)
create or replace view metricas.tempo_registro as
select date_trunc('week', created_at at time zone 'America/Sao_Paulo')::date as semana,
       count(*) as salvos,
       round((percentile_cont(0.5)  within group (order by (props->>'ms')::numeric) / 1000)::numeric, 1) as mediana_s,
       round((percentile_cont(0.75) within group (order by (props->>'ms')::numeric) / 1000)::numeric, 1) as p75_s,
       round(100.0 * count(*) filter (where (props->>'detalhes')::boolean) / count(*), 0) as pct_com_detalhes
from public.app_events
where name = 'compose_saved' and coalesce((props->>'editou')::boolean, false) = false
  and (props->>'ms') ~ '^[0-9]+$'
group by 1 order by 1 desc;

-- Desistência: quantas vezes o registro foi aberto e fechado sem salvar
create or replace view metricas.desistencia_registro as
select date_trunc('week', created_at at time zone 'America/Sao_Paulo')::date as semana,
       count(*) filter (where name = 'compose_open')   as abertos,
       count(*) filter (where name = 'compose_saved')  as salvos,
       count(*) filter (where name = 'compose_cancel') as cancelados
from public.app_events
where name in ('compose_open', 'compose_saved', 'compose_cancel')
group by 1 order by 1 desc;

-- Ativação: de quem entrou em cada semana, quantos fizeram 3 registros E têm 1 amigo nos primeiros 7 dias
create or replace view metricas.ativacao as
with novos as (
  select id, created_at, date_trunc('week', created_at at time zone 'America/Sao_Paulo')::date as semana
  from public.profiles
), feito as (
  select n.id, n.semana,
    (select count(*) from public.reviews r where r.user_id = n.id and r.created_at < n.created_at + interval '7 days') >= 3 as tres_registros,
    exists (select 1 from public.friendships f
            where (f.user_a = n.id or f.user_b = n.id) and f.status = 'aceita'
              and coalesce(f.accepted_at, f.created_at) < n.created_at + interval '7 days') as um_amigo
  from novos n
)
select semana, count(*) as entraram,
       count(*) filter (where tres_registros and um_amigo) as ativados,
       round(100.0 * count(*) filter (where tres_registros and um_amigo) / count(*), 0) as pct_ativados
from feito group by semana order by semana desc;

-- Retenção: de quem entrou em cada semana, quantos abriram o app na 4ª semana depois (dias 21 a 27)
create or replace view metricas.retencao_semana4 as
select date_trunc('week', p.created_at at time zone 'America/Sao_Paulo')::date as semana,
       count(*) as entraram,
       count(*) filter (where exists (
         select 1 from public.app_events e
         where e.user_id = p.id and e.name = 'app_open'
           and e.created_at >= p.created_at + interval '21 days'
           and e.created_at <  p.created_at + interval '28 days')) as voltaram,
       round(100.0 * count(*) filter (where exists (
         select 1 from public.app_events e
         where e.user_id = p.id and e.name = 'app_open'
           and e.created_at >= p.created_at + interval '21 days'
           and e.created_at <  p.created_at + interval '28 days')) / count(*), 0) as pct
from public.profiles p
where p.created_at < now() - interval '28 days'
group by 1 order by 1 desc;

-- ---------- Retenção de 180 dias ----------
create or replace function metricas.limpar_antigos()
returns void language sql security definer set search_path = ''
as $$
  delete from public.client_errors where created_at < now() - interval '180 days';
  delete from public.app_events    where created_at < now() - interval '180 days';
$$;
revoke all on function metricas.limpar_antigos() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('mmisc-limpar-metricas', '17 4 * * *', 'select metricas.limpar_antigos()');
  else
    raise notice 'pg_cron desligado: ligue em Database > Extensions e rode de novo só o bloco do cron.schedule';
  end if;
end $$;
