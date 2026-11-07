-- MMISC · Fase 0 · aperto de privilégios
-- O Supabase dá por padrão TRUNCATE/REFERENCES/TRIGGER (e INSERT) a anon e authenticated em
-- toda tabela nova do public. Aqui sobra só o que a fase 0 precisa: inserir.
revoke all on public.client_errors from anon, authenticated;
revoke all on public.app_events    from anon, authenticated;
grant insert on public.client_errors to anon, authenticated;
grant insert on public.app_events    to authenticated;
