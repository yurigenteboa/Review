-- =====================================================================
-- Perfil: links sem o limite de 5 (pedido do dono em 10/11).
--   Só muda o número na função que confere os links: 5 -> 50. O 50 não aparece
--   para ninguém; é um teto contra abuso (o perfil é uma linha só e o perfil
--   público devolve todos os links de uma vez). O resto fica igual: só https,
--   endereço até 300 caracteres, nome até 40.
--   Nenhuma policy, permissão ou tabela muda. O app usa o mesmo teto
--   (LINKS_MAX em src/lib/profileData.ts).
-- Testes: supabase/tests/perfil_links.mjs
-- =====================================================================

create or replace function public.valid_profile_links(links jsonb)
returns boolean
language sql immutable set search_path = ''
as $$
  select jsonb_typeof(links) = 'array'
     and jsonb_array_length(links) <= 50
     and not exists (
       select 1 from jsonb_array_elements(links) e
       where jsonb_typeof(e) <> 'object'
          or coalesce(e ->> 'url', '') !~ '^https://[^\s<>"]+$'
          or char_length(e ->> 'url') > 300
          or char_length(coalesce(e ->> 'label', '')) > 40
     );
$$;
