# MMisc · Base: banco, catálogo, amigos e login

> Movido do CLAUDE.md em 10/11/2026, sem cortes. O CLAUDE.md principal tem as regras gerais e o resumo de cada frente; aqui fica o detalhe. Ao terminar algo nesta frente, registre aqui e atualize a linha de resumo no CLAUDE.md.

## Estado atual (Fase 2)
- Supabase: projeto `review` (sa-east-1). Schema em `supabase/migrations/202611051800_fase2_base.sql` (já aplicado).
- Login: OTP por e-mail (`signInWithOtp` + `verifyOtp`). Link funciona no navegador; o código só chega depois de configurar SMTP próprio (o template padrão não tem `{{ .Token }}`).
- Dados: `src/lib/queries.ts` (TanStack Query). Fotos em bucket privado `review-photos/<user_id>/<review_id>/<uuid>.webp`, lidas por URL assinada.

## Estado atual (Fase 3)
- Edge Function `supabase/functions/catalog-search` (publicada pelo painel). "Verify JWT with legacy secret" DESLIGADO: o projeto assina tokens com ECC, então a função confere o login sozinha via JWKS (`npm:jose`).
- Secrets necessários: `TMDB_TOKEN`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`. Sem eles, filmes/séries/jogos respondem `missingKey`.
- Itens externos entram em `items` com `source` + `external_id` (único). Fontes: musicbrainz, tmdb-movie, tmdb-tv, igdb, openlibrary, osm, ibge.

## Estado atual (Fase 4)
- Nome do app: MMisc (antes escrito MMISC; domínio www.mmisc.com.br). E-mails de login saem de login@mmisc.com.br via Resend (SMTP no Supabase).
- Social: `supabase/migrations/202611061300_fase4_social.sql`. Amizade mútua em `friendships` (par ordenado user_a < user_b); criar/aceitar/desfazer só via RPC (`request_friend`, `respond_friend`, `remove_friend`, `accept_invite`). `follows` foi removida.
- Convite: `/convite/<código>`; código guardado no localStorage até o login (`mmisc.pendingInvite`) e aceito no App.
- Curtidas, comentários e notificações (criadas por triggers). Comparação de gosto: RPC `taste_match` (security invoker).
- Hooks em `src/lib/social.ts`. Aba "Mapa" virou "Amigos" (mapa volta na Fase 5).

## Estado atual (login com Google — em andamento, outro chat)
- Detalhes, decisões e pendências em `docs/LOGIN-SOCIAL.md` (seção 4b). Só Google agora; Apple e Meta depois; vínculo manual desligado.
- Páginas públicas sem login: `/sobre`, `/privacidade`, `/termos`, `/excluir-dados` (`src/pages/Legal.tsx`).
- Migração `202611061900_login_google_perfil.sql` (nome/foto do Google no perfil + gatilho em `auth.identities`).
