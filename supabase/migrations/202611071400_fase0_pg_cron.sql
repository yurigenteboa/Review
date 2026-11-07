-- MMISC · Fase 0 · liga o agendador do Postgres e a limpeza diária de erros/métricas com mais de 180 dias
-- (prometida na página de Privacidade). Rodar pelo SQL Editor; o Claude não pode ligar extensões sozinho.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('mmisc-limpar-metricas', '17 4 * * *', 'select metricas.limpar_antigos()');
-- conferir:
select jobname, schedule, command, active from cron.job where jobname = 'mmisc-limpar-metricas';
