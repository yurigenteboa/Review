# MMISC (antes "Review") — contexto do projeto

App de review de tudo (álbuns, filmes, séries, jogos, livros, bares, banheiros públicos, cidades).
PWA mobile-first com visual "iOS glass". Público: o dono + amigos; depois, rede aberta.
O dono entende a lógica (SQL, Python, Node), mas não escreve do zero: explique o que muda e por quê.

## Stack
- React 19 + TypeScript + Vite
- React Router (abas: `/`, `/buscar`, `/mapa`, `/perfil`; vitrine em `/kit`)
- `motion` (Framer Motion) para transições com mola e sheets arrastáveis
- TanStack Query para dados do servidor (a partir da Fase 2)
- Supabase: Postgres, Auth, Storage, Edge Functions (cliente em `src/lib/supabase.ts`)
- `vite-plugin-pwa` (manifest + service worker), deploy na Vercel

## Estrutura
```
src/
  components/ui/      Glass, TabBar, PageHeader, Sheet, Chips, Stars, Icons, ui.css
  components/review/  ReviewCard, Cover, CategoryTag
  components/movie/   movie.css (página do filme 2.0)
  pages/              Inicio, Buscar, Amigos, Pessoa, Perfil, Item, Filme, Kit
  lib/                categories.ts, queries.ts, social.ts, movie.ts, supabase.ts
  styles/tokens.css   todas as cores, raios, blur e fontes (claro + escuro)
supabase/migrations/  um arquivo .sql por mudança de banco
```

## Regras
- TypeScript estrito; nada de `any`.
- Cores, raios e blur SEMPRE via variáveis de `tokens.css` (`var(--accent)`), nunca hex solto em componente novo. Exceção: dados de exemplo.
- Vidro (`<Glass>`) só no que flutua: barra de abas, cabeçalhos, sheets, cartões sobre imagem. No máximo 2–3 camadas com blur por tela.
- Texto sobre vidro com contraste >= 4,5:1. Respeitar `prefers-reduced-transparency` e `prefers-reduced-motion`.
- Botões reais (`<button>`), `aria-label` em botão só com ícone, alvos de toque >= 44 px.
- Textos da interface em português do Brasil. Nota no formato "4,5".
- Toda tabela nova no Supabase tem RLS ligada e policies explícitas para `privado` / `amigos` / `publico`.
- Toda mudança de banco vira arquivo em `supabase/migrations/AAAAMMDDHHMM_descricao.sql`; nada de clique solto no painel.
- Chaves de API de terceiros (TMDB, IGDB, Google) só dentro de Edge Functions, nunca no front.
- Antes de mexer em RLS ou auth, explique o plano e espere confirmação.

## Fases (resumo)
0 Setup · 1 Design system + casca · 2 MVP pessoal (login, banco, criar review) · 3 Catálogo via APIs · 4 Amigos (feed, convites) — todas FEITAS e no ar.
Agora: UX de filmes (F1 → F2 → F3, abaixo). Depois: 5 PWA (offline, push, mapa) · 6 Rede aberta (moderação, LGPD).

## Estado atual (Fase 2)
- Supabase: projeto `review` (sa-east-1). Schema em `supabase/migrations/202611051800_fase2_base.sql` (já aplicado).
- Login: OTP por e-mail (`signInWithOtp` + `verifyOtp`). Link funciona no navegador; o código só chega depois de configurar SMTP próprio (o template padrão não tem `{{ .Token }}`).
- Dados: `src/lib/queries.ts` (TanStack Query). Fotos em bucket privado `review-photos/<user_id>/<review_id>/<uuid>.webp`, lidas por URL assinada.

## Estado atual (Fase 3)
- Edge Function `supabase/functions/catalog-search` (publicada pelo painel). "Verify JWT with legacy secret" DESLIGADO: o projeto assina tokens com ECC, então a função confere o login sozinha via JWKS (`npm:jose`).
- Secrets necessários: `TMDB_TOKEN`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`. Sem eles, filmes/séries/jogos respondem `missingKey`.
- Itens externos entram em `items` com `source` + `external_id` (único). Fontes: musicbrainz, tmdb-movie, tmdb-tv, igdb, openlibrary, osm, ibge.

## Estado atual (Fase 4)
- Nome do app: MMISC (domínio www.mmisc.com.br). E-mails de login saem de login@mmisc.com.br via Resend (SMTP no Supabase).
- Social: `supabase/migrations/202611061300_fase4_social.sql`. Amizade mútua em `friendships` (par ordenado user_a < user_b); criar/aceitar/desfazer só via RPC (`request_friend`, `respond_friend`, `remove_friend`, `accept_invite`). `follows` foi removida.
- Convite: `/convite/<código>`; código guardado no localStorage até o login (`mmisc.pendingInvite`) e aceito no App.
- Curtidas, comentários e notificações (criadas por triggers). Comparação de gosto: RPC `taste_match` (security invoker).
- Hooks em `src/lib/social.ts`. Aba "Mapa" virou "Amigos" (mapa volta na Fase 5).

## Estado atual (UX de filmes — em andamento)
- Plano completo no doc "MMISC · Filmes: UX e próximos passos": https://claude.ai/artifact/Vp8QC4MxMcT3jVEp83LdNp (comparação com Letterboxd/IMDb/Filmow, página do filme 2.0, diário, mudanças no banco, prioridade).
- Ordem aprovada pelo dono ("siga da forma que achar melhor"):
  - **F1 página do filme 2.0 (CÓDIGO PRONTO, falta publicar):** Edge Function nova `movie-details` chama TMDB `/movie/{id}?append_to_response=credits,videos,watch/providers,release_dates,recommendations&language=pt-BR` e guarda em `items.metadata` (com `fetched_at`, cache 7 dias). Tela do item para filme: backdrop + pôster, título original, ano, direção, duração, classificação BR; barra de ações (Vi, ♥, Quero ver, Compartilhar); amigos que viram + médias + histograma 0,5–5; onde assistir no Brasil (crédito "Dados: JustWatch" obrigatório); sinopse; trailer (YouTube); elenco/equipe; gêneros; reviews (amigos primeiro); parecidos. Aviso de spoiler (texto borrado até tocar). Sem nota do IMDb. F1 NÃO mexe em RLS.
  - **F2 registro:** `reviews` ganha `watched_on`, `rewatch`, `liked`, `spoiler`, `watched_where`; tirar unique (user_id,item_id) (filme vira diário; outras categorias seguem atualizando a última entrada); `rating` pode ser nulo; tabelas `watchlist` e `favorites`; `taste_match` usa a nota mais recente. Registro rápido em 2 toques, detalhes recolhidos. MEXE EM RLS → explicar plano e esperar aprovação.
  - **F3 perfil cinéfilo:** 4 favoritos, estatísticas do ano, importar CSV do Letterboxd.
- F1 entregue em 06/11: `supabase/functions/movie-details/index.ts` (confere login com `auth.getUser`, lê/grava como o usuário; cache no banco 7 dias + memória 10 min; devolve dados antigos se o TMDB cair), `src/lib/movie.ts` (tipo `MovieDetails`, `useMovieDetails`), `src/pages/Filme.tsx` + `src/components/movie/movie.css` (Item.tsx desvia para Filme quando `source = 'tmdb-movie'`), `SpoilerText` (trechos entre `||barras||` ficam borrados; prop `whole` pronta para a coluna `spoiler` da F2). Tokens novos: `--cls-*` (classificação indicativa), `--scrim`, `--spoiler-blur`.
  - Gravar o cache: a policy de `items` só deixa o criador editar, então a migração `202611061500_f1_movie_cache.sql` cria a RPC `cache_movie_details` (security definer, só grava `metadata.tmdb`/`fetched_at` de filme TMDB com tmdb_id batendo e cache vencido). NÃO altera policies, mas contorna RLS de forma estreita → aplicar só com OK do dono. Sem ela a função funciona igual, só cacheia os itens que o próprio usuário cadastrou.
  - ♥ Curti e Quero ver ficam para a F2 (precisam de tabela). Nota do TMDB vem na ficha (`tmdb_rating`) mas não aparece (decisão em aberto).
- Decisões em aberto (no fim do doc): diário com várias entradas (recomendado), critérios opcionais para filme, mostrar nota TMDB, "quero ver" visível a amigos, importação já na F3.

## Como trabalhamos (para uma conversa nova)
- Pasta no PC do dono: `C:\Users\yurim\Review`. O Claude edita uma cópia na nuvem e entrega os arquivos na pasta; o dono roda `git add . ; git commit -m "..." ; git push` no PowerShell do VS Code. A Vercel publica sozinha a cada push.
- Supabase: projeto `review` (ref `dgvrkmqenkwfeytgaouv`, sa-east-1). Migrações aplicadas pelo SQL Editor do painel (Claude cola pelo navegador e confere). Edge Functions publicadas pelo editor do painel.
- Segredos: nunca no chat nem digitados pelo Claude; o dono cola chaves no painel. Nunca usar a service_role.
- Pendências do dono: dar push na correção do PWA (`workbox.skipWaiting/clientsClaim` em vite.config.ts) se ainda não deu; testar a Fase 4 com um amigo; chaves da Twitch (jogos) quando quiser.
- Antes de entregar: `npm run build` sem erro; mudanças de RLS testadas antes de aplicar.
