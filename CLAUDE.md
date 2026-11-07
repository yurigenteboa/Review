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
Agora: UX de filmes (F1 e F2 feitas → F3, abaixo). Depois: 5 PWA (offline, push, mapa) · 6 Rede aberta (moderação, LGPD).

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
  - **F1 página do filme 2.0 (FEITA e no ar em 06/11):** Edge Function nova `movie-details` chama TMDB `/movie/{id}?append_to_response=credits,videos,watch/providers,release_dates,recommendations&language=pt-BR` e guarda em `items.metadata` (com `fetched_at`, cache 7 dias). Tela do item para filme: backdrop + pôster, título original, ano, direção, duração, classificação BR; barra de ações (Vi, ♥, Quero ver, Compartilhar); amigos que viram + médias + histograma 0,5–5; onde assistir no Brasil (crédito "Dados: JustWatch" obrigatório); sinopse; trailer (YouTube); elenco/equipe; gêneros; reviews (amigos primeiro); parecidos. Aviso de spoiler (texto borrado até tocar). Sem nota do IMDb. F1 NÃO mexe em RLS.
  - **F2 registro:** `reviews` ganha `watched_on`, `rewatch`, `liked`, `spoiler`, `watched_where`; tirar unique (user_id,item_id) (filme vira diário; outras categorias seguem atualizando a última entrada); `rating` pode ser nulo; tabelas `watchlist` e `favorites`; `taste_match` usa a nota mais recente. Registro rápido em 2 toques, detalhes recolhidos. MEXE EM RLS → explicar plano e esperar aprovação.
  - **F3 perfil cinéfilo:** 4 favoritos, estatísticas do ano, importar CSV do Letterboxd.
- F1 entregue em 06/11: `supabase/functions/movie-details/index.ts` (confere login com `auth.getUser`, lê/grava como o usuário; cache no banco 7 dias + memória 10 min; devolve dados antigos se o TMDB cair), `src/lib/movie.ts` (tipo `MovieDetails`, `useMovieDetails`), `src/pages/Filme.tsx` + `src/components/movie/movie.css` (Item.tsx desvia para Filme quando `source = 'tmdb-movie'`), `SpoilerText` (trechos entre `||barras||` ficam borrados; prop `whole` pronta para a coluna `spoiler` da F2). Tokens novos: `--cls-*` (classificação indicativa), `--scrim`, `--spoiler-blur`.
  - Gravar o cache: a policy de `items` só deixa o criador editar, então a migração `202611061500_f1_movie_cache.sql` cria a RPC `cache_movie_details` (security definer, só grava `metadata.tmdb`/`fetched_at` de filme TMDB com tmdb_id batendo e cache vencido). NÃO altera policies, mas contorna RLS de forma estreita. Aprovada pelo dono e APLICADA em 06/11 (conferido: security definer, anon sem acesso, logado com acesso).
  - `movie-details` publicada pelo editor do painel, "Verify JWT with legacy secret" DESLIGADO (a função confere o login sozinha). Testada no app com "Ainda Estou Aqui": ficha, classificação, onde assistir e cache em `items.metadata` ok.
  - ♥ Curti e Quero ver ficam para a F2 (precisam de tabela). Nota do TMDB vem na ficha (`tmdb_rating`) mas não aparece (decisão em aberto).
- F2 planejada em 06/11 (aba "F2: registro e diferenciais" do mesmo doc). Decisões do dono: diário com várias entradas para TODAS as categorias (sai o unique user_id,item_id; médias/histograma/taste_match usam a entrada mais recente por pessoa); "quero ver" nasce visível para amigos; entram na F2 notas privadas (`entry_notes`, só dono), vi com quem (`entry_companions`, amigo recebe entrada pronta para confirmar), meus streamings (`user_services`, só dono) + quero ver em comum + histórico da nota. Abandonei, clima do filme, previsão de nota e calendário ficam para F2.5. `reviews.experienced_at` já existe e vira a data do diário; ♥ = coluna `loved` (não confundir com tabela `likes`). Padrões se o dono não disser outra coisa: critérios de filme opcionais/recolhidos, nota TMDB escondida. Migração da F2 mexe em RLS → plano no doc, aplicar só após OK.
- F2 entregue em 06/11. Migração `202611061700_f2_diario.sql` APLICADA (31 cenários de RLS testados antes em PGlite: dono/amigo/estranho; conferido no banco real: RLS ligado e policies nas 4 tabelas novas). Front:
  - `src/lib/diary.ts`: quero ver (`useWatchlist`, `useItemWatchers`, `useToggleWatchlist`), ♥ (`useToggleLoved` marca a entrada mais recente), notas (`useEntryNote`, `useMyNotes`), streamings (`useMyServices`, `useToggleService`), `DID_VERB`/`WANT_VERB`, `formatDay`, `localDay`.
  - `queries.ts`: `useCreateReview` cria OU edita (`reviewId`), grava nota privada e companhias; helpers `sortDiary`, `latestPerPerson`, `averageRating` (médias usam a entrada mais recente de cada pessoa). `REVIEW_SELECT` traz os campos do diário e `companions`.
  - `ComposeSheet`: registro rápido (nota opcional, Hoje/Ontem/Outro dia, Curti, Revi automático se já registrou) + "Mais detalhes" recolhido (lembra a escolha em localStorage `mmisc.composeDetails`): onde viu, com quem, texto + "contém spoiler", nota privada, critérios, fotos. `ComposeStart` aceita `edit`, `prefill`, `loved`.
  - Filme.tsx: barra Vi/♥/Quero ver/Compartilhar, seção "Seu diário" (histórico da nota, notas privadas, editar/apagar), amigos que querem ver, destaque dos streamings que você assina e modo "Meus streamings" (toca no logo para marcar). Item.tsx genérico: "Quero ouvir/ir/…" e editar entradas.
  - Perfil: abas Diário (por mês) e Quero ver (filtro "no que eu assino", usa `metadata->tmdb->providers`). Pessoa: Reviews / Diário / Quero ver. Notificação `companion` com botão "Registrar" que abre o registro pré-preenchido.
- Decisões em aberto (no fim do doc): diário com várias entradas (recomendado), critérios opcionais para filme, mostrar nota TMDB, "quero ver" visível a amigos, importação já na F3.

## Estado atual (login com Google — em andamento, outro chat)
- Detalhes, decisões e pendências em `docs/LOGIN-SOCIAL.md` (seção 4b). Só Google agora; Apple e Meta depois; vínculo manual desligado.
- Páginas públicas sem login: `/sobre`, `/privacidade`, `/termos`, `/excluir-dados` (`src/pages/Legal.tsx`).
- Migração `202611061900_login_google_perfil.sql` (nome/foto do Google no perfil + gatilho em `auth.identities`).

## Estado atual (perfil novo — chat do login/perfil)
- Plano e decisões no doc "MMISC · Perfil novo: referências e plano": https://claude.ai/artifact/HxfbFtBFSbS4GAgyX3Qug8
- A antiga **F3 de filmes (favoritos, estatísticas, importar Letterboxd) passou para este chat** (decisão do dono em 06/11). O chat de filmes não mexe mais em perfil.
- Decisões: 4 favoritos por categoria; perfil público por link já (Etapa 3); capa automática OU foto; "agora" marcado na mão; conquistas com moderação; Top 10 do ano por comparação (estilo Beli).
- **Etapa 1 (06/11, só front, sem banco):** `src/components/profile/ProfileView.tsx` (tela única para /perfil e /u/:id), `ProfileCharts.tsx` (mapa de calor 12 meses, distribuição de notas), `profile.css`; `src/lib/profileStats.ts` (funções puras: latestPerItem, summary, ratingHistogram, heatmapWeeks, topRated, coverImages, tasteLabels, compatScore/compatHighlights); `src/lib/profile.ts` (`useProfileFull` com bio, `useSaveProfile`). Perfil.tsx e Pessoa.tsx viraram invólucros. Filtros na URL: `?cat=` e `?aba=`.
- **Etapa 2 (06/11, APLICADA):** migração `202611061930_perfil_etapa2.sql` (39 cenários de RLS testados em PGlite com todas as migrações; conferido no banco real: RLS ligado e 4 policies em `favorites`, `profile_now`, `goals`, `rankings`; bucket `profile-media` público com 3 policies de escrita na própria pasta; funções sem acesso para anon). `profiles` ganhou `cover_mode`, `cover_url`, `links` (jsonb, até 5, só https, validado por `valid_profile_links`), `showcase` (text[]) e check https em `avatar_url`. Triggers: item tem de ser da categoria; Top 10 só com item do diário do ano. RPCs: `save_ranking(year, category, items[], visibility)` e `rating_vs_friends(category)` (ambas security invoker). Padrões: favoritos/Top 10/metas `publico`, agora `amigos`.
  - Front: `src/lib/profileData.ts` (hooks de favoritos, agora, metas, Top 10, upload de foto/capa, links, `friendsLabel`), `components/profile/ProfileSections.tsx` (LinksRow, NowLine + NowSheet, Showcase, Goals + GoalSheet, TopTen + RankingBuilder por busca binária, VisibilityPicker), `EditProfileSheet.tsx` (foto, capa auto/foto, nome, @, bio, links, vitrine), `ItemPicker.tsx` (diário + itens já no MMISC).
- **Perfil público (Etapa 3) vem LIGADO por padrão** (decisão do dono 06/11), com opção de deixar privado. Na Etapa 3: `profiles.is_public default true`, aviso no app na primeira vez e parágrafo na Privacidade.
- **Etapa 3 (06/11, APLICADA):** migração `202611062000_perfil_publico.sql` (`profiles.is_public default true`; função `item_public_json`; RPC `public_profile(handle)` security definer liberada para anon e logado, devolve perfil + favoritos/agora/Top 10/reviews SÓ `publico`, nada de metas, amigos, quero ver, fotos de review). 56 cenários em PGlite; conferido no banco real como anon (só chama a RPC, não lê tabelas). Front: `src/lib/publicProfile.ts`, `src/pages/PublicProfile.tsx` (rota `/@usuario` tratada no App antes do teste de sessão; logado vê aviso "Abrir no app"), aviso de primeira vez no perfil (`mmisc.publicNoticeSeen`), interruptor Público/Privado em Editar perfil, "Ver meu perfil público", parágrafo na Privacidade.
  - Prévia de link: `proxy.ts` na raiz + `vercel.json` → `"proxy": { "entrypoint": "proxy.ts", "matcher": ["/@:handle(...)"] }` (Vercel Routing Middleware, Node). Para `/@usuario`, busca `/index.html`, chama `public_profile` com a anon key (`process.env.VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, precisam existir nas variáveis da Vercel) e injeta título/descrição/og:image. Falha = página normal. Se o deploy reclamar do `proxy`, remover esse bloco do vercel.json desliga só a prévia.
- Login com Google LIGADO para todo mundo desde 06/11 (`googleLoginEnabled()`; `VITE_LOGIN_GOOGLE=off` esconde). Interruptor do /kit removido.
- **Etapa 4 (06/11, só front, SEM banco):**
  - Conquistas: `src/lib/achievements.ts` (8 selos com moderação: eclético, cinéfilo, ouvinte, bares, banheiros, cidades, crítico, ano completo); componente `Achievements` em ProfileSections (dono vê progresso; os outros e o perfil público só os desbloqueados).
  - Retrospectiva: `/retrospectiva?ano=` (`src/pages/Retrospectiva.tsx`, `src/lib/retro.ts`): números do ano, por categoria, mês mais ativo, maior sequência, notas mais altas, Top 3. Imagem 1080×1920 para Stories desenhada em canvas (tokens `--retro-*`, sem capas). Cartão no perfil em dezembro e janeiro; link fixo no rodapé do perfil.
  - Importar Letterboxd: `/importar` (`src/pages/ImportLetterboxd.tsx`, `src/lib/letterboxd.ts` (CSV + .zip via `fflate`, casamento por título/ano), `src/lib/importLetterboxd.ts`). Usa `catalog-search` (precisa de `TMDB_TOKEN`), cria itens com `ensureCatalogItem`, não duplica (item + data), `created_at` = data do registro no Letterboxd (não inunda o feed), visibilidade padrão `amigos`, quero ver opcional. Casos duvidosos o dono confere antes de gravar.
  - Telas de importar e retrospectiva carregam sob demanda (`React.lazy`).

## Estado atual (desktop/tablet — este chat)
- Plano e decisões no doc "MMISC · Desktop: plano": https://claude.ai/artifact/SKBYjpRXHLEshkTC4SJv2p (D0 base → D1 casca → D2 listas → D3 telas ricas → D4 coisas do desktop → D5 acabamento). Só front, sem banco.
- Decisões do dono (06/11): público = usuários e visitantes; barra lateral à esquerda; largura mista (feed estreito + painel à direita; filme/perfil/busca/diário largos); registrar/editar em janela no centro, comentários/notificações em painel à direita; tablet entra; fonte Inter; atalhos de teclado (N, /, Esc, setas). Nas telas dos chats de filmes e perfil, este chat só acrescenta CSS de desktop em blocos separados, depois que eles fecharem.
- Tamanhos: celular < 700 px (como sempre) · tablet 700–1099 px (barra lateral só ícones) · desktop >= 1100 px (barra lateral com nomes + painel). Cortes em `src/lib/breakpoints.ts` (`useBreakpoint`, `useFinePointer`) e escritos nos `@media`; medidas em `tokens.css` (`--sidebar-w`, `--content-w`, `--aside-w`, `--wide-w`, `--hover-fill`).
- **D0 (06/11, FEITO):** Inter via `@fontsource-variable/inter` (importada em `main.tsx`; só o latino entra no cache offline); hover e barra de rolagem fina só em `@media (hover: hover) and (pointer: fine)` (`index.css`, fim do `ui.css`); manifesto com `orientation: 'any'`.
- **D1 (06/11, código pronto, falta conferir com dados reais):** `src/components/ui/SideBar.tsx` (barra lateral; `compact` no tablet); `App.tsx` troca `TabBar`↔`SideBar` por `useBreakpoint()` e usa `.shell__main` (sem `maxWidth` inline); `Sheet.tsx` com prop `desktop?: 'dialog' | 'side'` (celular sempre de baixo), foco preso, Esc só na sheet de cima, foco volta ao fechar; `Glass` aceita `ref`; `CommentsSheet` usa `desktop="side"`; classe `.mobile-only` some a partir de 700 px (usada no cabeçalho do Início).
- **D2 (06/11, código pronto):** a página pede o layout por classe e `.shell__main` se ajusta via `:has()`: `page page--with-aside` (grid conteúdo 640 + `.page-aside` 320, só >= 1100 px; o painel é renderizado só quando `useBreakpoint() === 'desktop'`) e `page page--wide` (até `--wide-w`). Início usa `components/home/HomeAside.tsx` (pedidos, amigos, quero ver); Amigos põe o `InviteCard` no painel; Buscar é larga com resultados em 2 colunas e `autoFocus` só com mouse (`id="busca-campo"`). Atalhos globais no `App.tsx`: `N` = nova review, `/` = buscar (ignorados em campos, com modificador ou janela aberta).
- Contador vermelho agora é `.count-badge` (TabBar, SideBar, Início): `.badge` colidia com os selos de conquista de `profile.css`. Não usar `.badge` para contador.
- **D4 (06/11, código pronto):** `src/components/ui/DesktopEnhancers.tsx`, montado no App só com mouse (`useFinePointer`), age por cima de qualquer tela sem editar as telas dos outros chats: (1) setas de vidro nas fileiras que rolam para o lado (detecta qualquer caixa com `overflow-x` transbordando); (2) dica ao parar o mouse em botão/link só com ícone (usa o `aria-label`; quem tem `title` fica com a dica nativa); (3) colar (Ctrl+V) ou arrastar imagens para a janela aberta que tem `input[type=file][accept^=image]` — abre "Mais detalhes" (`.details-toggle`) se preciso e entrega os arquivos ao próprio input (evento `change`). Se o ComposeSheet mudar esses seletores, conferir. Cabeçalho da janela/painel (`.sheet__top`) agora é fixo e quase opaco.
- **D5 (06/11, código pronto):** manifesto com `id: '/'` (instalável no Chrome/Edge do PC como app); barra lateral sem desfoque (fundo `--bg`: não fica sobre conteúdo rolando, o blur só custava desempenho); link "Pular para o conteúdo" (`.skip-link` → `#conteudo`, o `<main>`). Conferido em claro e escuro, 390/900/1440 px.
- **Foto de perfil ampliada (pedido do dono, 06/11):** `src/components/profile/AvatarViewer.tsx` substitui o `Avatar` do cabeçalho em `ProfileView.tsx` e `PublicProfile.tsx`. Clique/toque abre a foto grande (Esc ou clique fora fecha); o dono tem "Trocar foto"/"Remover" ali mesmo (usa `useUploadProfileImage`/`useRemoveProfileImage`); sem foto, só o dono pode abrir (para adicionar). Foto do Google pedida em `=s800`. Tokens `--lightbox-bg`, `--lightbox-ink`.
- Conferido no ar em 06/11 (Chrome do dono, 1440 px, dados reais): barra lateral, painel do Início, painel de comentários, página do filme e perfil OK.
- Testes visuais sem Supabase: Playwright com sessão falsa no localStorage (`sb-dgvrkmqenkwfeytgaouv-auth-token`) e respostas vazias para `*.supabase.co`; com dados reais, pelo Chrome do dono (www.mmisc.com.br) depois do push.
- **D3 (06/11, código pronto):** layout de desktop das telas ricas em arquivo próprio `src/styles/desktop-pages.css` (importado em `main.tsx` depois do App, para vencer na cascata; NÃO mexe em movie.css/profile.css). Só >= 1100 px: filme (`.page:has(> .movie-hero)`) vira grade 260 px + conteúdo, backdrop de 420 px arredondado, `.movie-head` com `display: contents` e pôster fixo ao rolar; perfil, perfil de amigo e perfil público (`.page.profile`) viram capa larga + cartão da pessoa fixo à esquerda (340 px) + seções à direita. Se os chats de filmes/perfil mudarem a ordem dos filhos dessas páginas, conferir esse arquivo. Retrospectiva: fonte do canvas agora começa pela Inter. Item genérico, Retrospectiva e Importar seguem na coluna normal.

## Estado atual (mobile — este chat)
- Plano no doc "MMISC · Mobile: plano": https://claude.ai/artifact/6HbEHXiSSq1wqd4Qw41GKF (M0 velocidade → M1 navegação nativa → M2 registrar em segundos → M3 gestos e social → M4 primeira impressão → M5 erros e métricas).
- Decisões do dono (06/11): meio a meio iPhone/Android; seguir web (PWA), lojas "vamos vendo"; prioridade registrar + feed, depois descobrir; SEM push e SEM offline por enquanto; monitoramento de erros e métricas SIM (com aviso na Privacidade); gestos aos poucos; fileira "Agora" no Início ok; nas telas dos outros chats o Claude decide pelo conceito/navegação (registrar aqui o que mudar).
- **M0 (06/11, código pronto):** telas carregadas sob demanda no `App.tsx` (`SCREENS` + `lazy`; só Início e Login no primeiro download; `prefetchScreens()` baixa o resto quando o aparelho fica ocioso depois do login); `ComposeSheet` e `DesktopEnhancers` também sob demanda. `LEGAL_PATHS`/`LegalDoc` moram em `src/pages/legalPaths.ts` (Legal.tsx reexporta). Bibliotecas num chunk `vendor` (`build.rolldownOptions.output.codeSplitting` no vite.config): ~190 KB comprimido que fica em cache entre deploys; código do app no primeiro download ~18 KB comprimido (antes era tudo junto: 252 KB). Capas aparecem suavemente (`img.cover--img` + `is-loaded` no `Cover`). Telas de abertura do iPhone em `public/splash/` (10 tamanhos × claro/escuro, links `apple-touch-startup-image` no index.html).

- **M1 parte 1 (06/11, código pronto):** `src/lib/navigation.ts` — `useScrollMemory()` (o App passa no `onExitComplete` do `AnimatePresence`; `history.scrollRestoration = 'manual'`; voltar devolve a posição por `location.key`, as abas de `TAB_ROOTS` lembram a própria posição, tela nova abre no topo; troca só de `?aba=`/`?cat=` não mexe na rolagem) e `useTabReselect()` (TabBar e SideBar: tocar na aba já aberta sobe ao topo; no topo, recarrega as consultas ativas). `src/components/ui/PullToRefresh.tsx`: puxar para atualizar em qualquer tela, só em toque (`!useFinePointer()`), ignora com janela aberta e gesto lateral; recarrega `refetchQueries({ type: 'active' })`. Testado em emulação de iPhone 13 (Playwright) com toques reais. Falta do M1: arrastar da borda para voltar e transições entre telas.

- **M2 (06/11, código pronto):** `src/lib/haptics.ts` (`haptic('tick'|'success')`: `navigator.vibrate` no Android; no iPhone, clique num `<input type=checkbox switch>` escondido; respeita reduced-motion). `RatingInput`: virou `role="slider"` — toque (estrela inteira; de novo = meia), arrastar de meia em meia com vibração (`touch-action: pan-y`), setas do teclado. `Sheet` (modo de baixo): acompanha o teclado pelo `visualViewport` (`--kb` no `<html>`) e rola o campo focado para a vista. **ComposeSheet (arquivo do chat de filmes, mexido aqui por decisão do dono):** rascunho automático só no "+" puro (`mmisc.composeDraft`, 3 dias, sem fotos; aviso "Rascunho … restaurado · Descartar"; apagado ao salvar), chip "📷 Foto" com `capture="environment"` para bar/banheiro, "Perto de você" automático se a localização já foi liberada (`navigator.permissions`), título "Você está em algum destes?" (prop `label` nova em `CatalogResults`), vibração ao curtir e ao salvar. Atalhos no ícone (manifest `shortcuts`, só Android): "Nova review" (`/?novo=1`, o App abre o registro) e "Buscar".

- **M3 (06/11, código pronto):** `src/lib/gestures.ts` (`useLongPress` — toque ~480 ms, `contextmenu` no Android/desktop, engole o clique seguinte; `useDoubleTap` — fora de links/botões; ambos ignoram eventos vindos de portais). `src/lib/composeBus.ts` (`requestCompose(start)` dispara `mmisc:compose`; o App abre o registro). `ReviewCard`: segurar abre `CardMenu` (Abrir, Curtir a review, Quero ver/ouvir…, Registrar também/de novo, Compartilhar); dois toques no card de outra pessoa curtem com coração animado (`.like-burst`); no toque, o card não seleciona texto nem abre o menu do sistema. `components/home/NowStrip.tsx`: fileira "Agora" no Início (só em "Tudo"), você primeiro (toque abre o `NowSheet` do perfil, carregado sob demanda) + um círculo por amigo com o "agora" mais recente não vencido (lê `profile_now` com `in('user_id', amigos)`; RLS decide). `NOW_VERB` passou de `ProfileSections` para `lib/profileData.ts` (ProfileSections reexporta; `NowSheet` agora é exportado). `components/ui/SwipeRow.tsx` + `DiaryViews`: no SEU diário, arrastar a linha para a esquerda mostra Editar e Apagar (apagar pede um segundo toque "Confirmar").

- **M4 (06/11, código pronto):** `src/lib/install.ts` (guarda o `beforeinstallprompt` do Android — `listenInstallPrompt()` e `countVisit()` chamados no `main.tsx`; `installPlatform()` = ios-safari / ios-other (Instagram, WhatsApp, Chrome do iPhone…) / android / other; `shouldOfferInstall()` = só toque, fora do app instalado, a partir do 2º dia de uso (`mmisc.visits`), e 14 dias de silêncio depois de "Agora não" (`mmisc.installDismissedAt`)). `components/home/InstallCard.tsx`: Android = botão "Instalar" (janela nativa); iPhone no Safari = passo a passo Compartilhar → Adicionar à Tela de Início; iPhone em outro navegador = "abra no Safari". `components/home/GettingStarted.tsx`: cartão "Primeiros passos" no topo do Início (substituiu o "Escolha seu @"): @, foto, primeiro registro (contagem `head: true`), um amigo; cada passo se marca sozinho; some quando completo ou "Ocultar" (`mmisc.gettingStartedHidden`); link para importar do Letterboxd.

## Como trabalhamos (para uma conversa nova)
- Pasta no PC do dono: `C:\Users\yurim\Review`. O Claude edita uma cópia na nuvem e entrega os arquivos na pasta; o dono roda `git add . ; git commit -m "..." ; git push` no PowerShell do VS Code. A Vercel publica sozinha a cada push.
- Supabase: projeto `review` (ref `dgvrkmqenkwfeytgaouv`, sa-east-1). Migrações aplicadas pelo SQL Editor do painel (Claude cola pelo navegador e confere). Edge Functions publicadas pelo editor do painel.
- Segredos: nunca no chat nem digitados pelo Claude; o dono cola chaves no painel. Nunca usar a service_role.
- Pendências do dono: dar push na correção do PWA (`workbox.skipWaiting/clientsClaim` em vite.config.ts) se ainda não deu; testar a Fase 4 com um amigo; chaves da Twitch (jogos) quando quiser.
- Antes de entregar: `npm run build` sem erro; mudanças de RLS testadas antes de aplicar.
