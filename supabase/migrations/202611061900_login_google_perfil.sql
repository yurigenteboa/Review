-- =====================================================================
-- Login com Google: nome e foto do provedor no perfil
-- Não cria tabela nem mexe em RLS/policies. Só troca a função do cadastro
-- automático e cria um gatilho para quem já tinha conta e conecta o Google.
-- =====================================================================

-- 1) Cadastro automático (roda quando nasce uma linha em auth.users)
--    - nome: full_name/name do provedor; sem isso, a parte do e-mail antes do @
--      (exceto e-mail escondido da Apple, que é só letras aleatórias: fica vazio);
--    - foto: só a do Google (a URL do Facebook expira);
--    - qualquer erro aqui NÃO pode impedir o login: cai num perfil vazio.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  meta     jsonb   := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  provider text    := new.raw_app_meta_data ->> 'provider';
  relay    boolean := coalesce(new.email, '') ilike '%@privaterelay.appleid.com';
  foto     text    := coalesce(meta ->> 'avatar_url', meta ->> 'picture');
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    nullif(
      coalesce(
        nullif(trim(meta ->> 'full_name'), ''),
        nullif(trim(meta ->> 'name'), ''),
        case when not relay then split_part(new.email, '@', 1) end
      ),
      ''
    ),
    case when provider = 'google' and foto like 'https://%' then foto end
  );
  return new;
exception when others then
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

-- 2) Quem já tinha conta (entrava pelo código) e agora entra com o Google do mesmo
--    e-mail: o Supabase junta o Google à conta existente criando uma linha em
--    auth.identities (auth.users não muda, então o gatilho acima não roda).
--    Aqui só PREENCHEMOS O QUE ESTÁ VAZIO:
--    - foto: se o perfil não tem foto;
--    - nome: se está vazio ou ainda é o pedaço do e-mail gerado no cadastro
--      (nome que a pessoa escolheu nunca é trocado).
create or replace function public.handle_new_identity()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  data  jsonb := coalesce(new.identity_data, '{}'::jsonb);
  nome  text  := coalesce(nullif(trim(data ->> 'full_name'), ''), nullif(trim(data ->> 'name'), ''));
  foto  text  := coalesce(data ->> 'avatar_url', data ->> 'picture');
  email text;
begin
  if new.provider <> 'google' then
    return new;
  end if;

  select u.email into email from auth.users u where u.id = new.user_id;

  update public.profiles p
     set avatar_url   = coalesce(p.avatar_url, case when foto like 'https://%' then foto end),
         display_name = case
                          when nome is not null
                           and (p.display_name is null or p.display_name = split_part(email, '@', 1))
                          then nome
                          else p.display_name
                        end
   where p.id = new.user_id;
  return new;
exception when others then
  return new; -- nunca bloquear o login
end;
$$;

drop trigger if exists on_auth_identity_created on auth.identities;
create trigger on_auth_identity_created
  after insert on auth.identities
  for each row execute function public.handle_new_identity();

-- Funções de gatilho não devem ser chamáveis pela API
revoke execute on function public.handle_new_user()     from public, anon, authenticated;
revoke execute on function public.handle_new_identity() from public, anon, authenticated;
