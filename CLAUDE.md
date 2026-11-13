# MMisc — contexto do projeto

App de review de tudo (álbuns, filmes, séries, jogos, livros, bares, restaurantes, cafés, drinks, pratos, banheiros públicos, cidades). Nome: **MMisc** ("nota para tudo"), www.mmisc.com.br.
PWA mobile-first. Público: o dono + amigos; depois, rede aberta. Plano geral: doc "Rede de reviews de tudo" (`docs/REDE.md`).
O dono entende a lógica (SQL, Python, Node), mas não escreve do zero: explique o que muda e por quê.

Este arquivo tem só o que toda conversa precisa: stack, regras, testes e o mapa das frentes. **O detalhe de cada frente fica em `docs/`** (tabela abaixo): leia o doc da frente antes de mexer nela, e ao terminar registre lá e atualize a linha dela aqui.

## Stack
- React 19 + TypeScript (estrito) + Vite; React Router (abas `/`, `/buscar`, `/amigos`, `/perfil`; vitrine em `/kit`)
- `motion` para transições e sheets arrastáveis; TanStack Query para dados do servidor
- Supabase: Postgres + RLS, Auth (e-mail com código e Google), Storage, Edge Functions (cliente em `src/lib/supabase.ts`)
- `vite-plugin-pwa`; deploy na Vercel a cada push; `maplibre-gl` 6 + OpenFreeMap no mapa
- 6 idiomas na interface (`src/lib/i18n.tsx`, dicionários em `src/locales/`)

## Estrutura
```
src/
  components/ui/       Glass, TabBar, SideBar, AppMenu, PageHeader, Sheet, Stars, Icons, Brand, ui.css, aparencia.css
  components/review/   ReviewCard, ComposeSheet, OrderPicker, CompareRating, RatingInput…
  components/profile/  ProfileView, ProfileSections, profile.css
  components/movie/    movie.css · components/place/ PlaceInfo · components/home/ (cartões do Início)
  components/album/    AlbumParts, ChartFilters, AlbumCharts, AlbumInfo, album.css (acervo de álbuns)
  pages/               Inicio, Buscar, Amigos, Perfil, Pessoa, Item, Filme, Mapa, Ranking, Aparencia, Legal, Albuns, AlbumGenero, AlbumArtista…
  lib/                 queries, social, profile*, diary, places, appearance(+Sync), i18n, telemetry, gamepad…
  styles/              tokens.css (cores, raios, blur, fontes, temas) · estilos.css (estilos inteiros) · desktop-pages.css
  locales/             en, es, fr, de, fi (chave = texto em português)
supabase/migrations/   um .sql por mudança de banco · supabase/tests/ baterias PGlite · supabase/functions/
e2e/                   fumaca.cjs (fluxos principais) · contraste.cjs (todas as aparências)
scripts/               testes/ · i18n/ · marca/ · catalogo/ · albuns/ (acervo.py)
Albuns/                .docx e dados do acervo de álbuns (só no PC, fora do git)
docs/                  um arquivo por frente (tabela abaixo)
```

## Regras
- TypeScript estrito; nada de `any`.
- Cores, raios e blur SEMPRE via variáveis de `tokens.css` (`var(--accent)`), nunca hex solto em componente novo. Exceção: dados de exemplo e branco sobre foto/capa.
- **Aparência:** componente não usa `@media (prefers-color-scheme / reduced-motion / reduced-transparency)`; reage aos atributos que `src/lib/appearance.ts` põe no `<html>` (`[data-tema]`, `[data-movimento='reduzido']`, `[data-transp='solido']`, `[data-estilo]`…). Detalhe em `docs/APARENCIA.md`.
- **Destaque:** texto sobre botão de destaque é `var(--on-accent)` (nunca `#fff`); sombra `var(--accent-shadow)`. Vermelho não é destaque (é curtir/apagar e a categoria Filme).
- **Tamanho de letra em `rem`** (acompanha o ajuste de texto); px só em caixa de tamanho fixo. Campo de texto nunca abaixo de 16 px (o iPhone dá zoom).
- Vidro (`<Glass>`) só no que flutua; no máximo 2–3 camadas com blur por tela. Texto com contraste ≥ 4,5:1 em todos os temas e estilos (`e2e/contraste.cjs` mede).
- Botões reais (`<button>`), `aria-label` em botão só com ícone, alvos de toque ≥ 44 px. Contador vermelho é `.count-badge` (não `.badge`).
- Textos da interface em português do Brasil e SEMPRE dentro de `t('…')` / `tp(n, '…', '…')`; o português é a chave. Texto novo = `npm run i18n` e traduzir nos 5 dicionários. Nota por `formatRating` ("4,5" em pt, "4.5" em en); datas com `locale()`, nunca `'pt-BR'` fixo. Detalhe em `docs/IDIOMAS.md`.
- Nada de nomes, logos ou símbolos de marcas de terceiros na interface (estilos se chamam Console, Portátil…). **Única exceção (pedido do dono em 10/11):** o ícone e o nome da rede num link do perfil, só para mostrar para onde o link leva (`src/lib/socialLinks.ts` + `socialIcons.ts`, gerado por `scripts/marca/icones_redes.py` a partir dos SVGs oficiais em `scripts/marca/redes/`).
- Toda tabela nova no Supabase tem RLS ligada e policies explícitas (`privado` / `amigos` / `publico`, ou só o dono); revogar o que o Supabase dá por padrão a anon/authenticated.
- Toda mudança de banco vira arquivo em `supabase/migrations/AAAAMMDDHHMM_descricao.sql` + bateria em `supabase/tests/`; nada de clique solto no painel.
- Antes de mexer em RLS ou auth, explique o plano e espere confirmação.
- Chaves de API de terceiros (TMDB, IGDB, Google) só dentro de Edge Functions, nunca no front. Google Places não serve de catálogo (só guarda lat/lng por 30 dias).
- `Sheet.tsx`: o efeito de abrir roda só com `[open]` (`onClose` fica numa ref). Não pôr função instável nas dependências desse efeito (tirava o foco do campo ao digitar).

## Testes (rodar antes de entregar; o GitHub roda sozinho a cada push)
- `npm run build` — tipos + build.
- `npm run i18n` — nenhuma tradução faltando nos 5 idiomas.
- `npm run test:e2e` — build de teste com Supabase falso + `e2e/fumaca.cjs` (fluxos principais, 63 checagens) + `e2e/contraste.cjs` (5 estilos × 4 temas × 2 contrastes × 7 destaques). No PC, na primeira vez: `npx playwright install chromium`.
- `npm run test:banco` — todas as baterias de `supabase/tests/` (PGlite com todas as migrações).
- **GitHub Actions** (`.github/workflows/testes.yml`, desde 10/11): a cada push na `main`, dois trabalhos — "Build, traduções, fumaça e contraste" e "Regras do banco (RLS) em PGlite". Não bloqueia a Vercel: se ficar vermelho, o GitHub avisa no commit e por e-mail. Versões fixas: `playwright` 1.63.0 e `@electric-sql/pglite` 0.5.10 (devDependencies).
- Fluxo novo ou tabela nova = checagem nova na fumaça ou bateria nova no banco.

## Fases (resumo)
0 Setup · 1 Design system + casca · 2 MVP pessoal (login, banco, criar review) · 3 Catálogo via APIs · 4 Amigos (feed, convites) — todas FEITAS e no ar.
Depois vieram Filmes, Perfil, Desktop, Mobile, Marca, Aparência e Idiomas. **Plano atual (07/11): "rede de reviews de tudo"** (`docs/REDE.md`), 8 fases com portão; as antigas Fases 5 (PWA/mapa) e 6 (rede aberta) foram absorvidas por ele.

## Frentes (onde está cada coisa)
| Frente | Doc | Estado (10/11) | Em aberto |
| --- | --- | --- | --- |
| Base: banco, catálogo, amigos, login | `docs/BASE.md`, `docs/LOGIN-SOCIAL.md` | No ar: login por e-mail e Google, catálogo por Edge Function, amizades, convites, curtidas, comentários | Testar amigos com um amigo de verdade; chaves da Twitch (jogos); Apple/Meta depois |
| Filmes | `docs/FILMES.md` | F1 (página 2.0) e F2 (diário) no ar; F3 passou para Perfil | Mostrar ou não a nota do TMDB; sinopses no idioma da pessoa |
| Perfil | `docs/PERFIL.md` | Etapas 1–4: favoritos, agora, metas, Top 10, perfil público, conquistas, retrospectiva, importar Letterboxd; 10/11: links sem limite (teto 50) com ícone da rede, botões numa linha própria | — |
| Desktop e tablet | `docs/DESKTOP.md` | D0–D5 feitos (barra lateral, painel, atalhos) | — |
| Mobile | `docs/MOBILE.md` | M0–M4 feitos (velocidade, navegação, registro rápido, gestos, instalar); M5 virou Fase 0 da rede | — |
| Rede de reviews de tudo | `docs/REDE.md` | Fase 0 (erros e métricas) e 1 (ligações, pedidos dentro do bar) feitas; Fase 2 (lugares) 2a–2e feitas | **Portões com uso real:** bar + 3 pedidos em < 30 s; 50 lugares reais e busca acha 9 de 10. Depois: ranking de amigos, filhas ao editar a noite, "Pedi de novo". Próxima fase: 3 Eventos |
| Marca | `docs/MARCA.md` | Logo, ícones, splash, prévia de link; grafia MMisc; destaque preto/creme | Cores das cartas × cores das categorias |
| Aparência e menu lateral | `docs/APARENCIA.md` | A0–A4: temas, texto, destaque, acessibilidade, 5 estilos, controle no Console, sincronizar com a conta; menu lateral | A5: paletas e sons (por último) |
| Álbuns (acervo de referência) | `docs/ALBUNS.md` | 13/11: código pronto — aba `/albuns` (paradas por ano/década/gênero, gêneros, números), páginas de gênero e artista, ficha do álbum no item, acervo na busca. Migração `202611131600_albuns_acervo.sql` escrita e testada (33 cenários), **NÃO aplicada** (mexe em RLS: aguarda OK do dono) | Aplicar a migração; rodar `scripts/albuns/acervo.py capas` (e `mbid`) e `csv`; importar as 7 partes do CSV no painel |
| Idiomas | `docs/IDIOMAS.md` | pt, en, es, fr, de, fi na interface | Conteúdo do TMDB por idioma |

## Dependências (08/11)
- `npm audit fix` (fflate 0.8.3) e mapa `maplibre-gl` 5 → **6.16.0** (corrige a falha crítica de XSS; a 6.17 tinha 1 dia). Na v6 não há `export default`: Mapa.tsx importa `{ LngLatBounds, Map as MapLibre, Marker, NavigationControl }`. Sobram 6 avisos de `npm audit`, todos em ferramentas de build (cadeia do vite-plugin-pwa); NÃO rodar `npm audit fix --force` (rebaixa o vite-plugin-pwa).
- **Bug do mapa em branco corrigido (08/11):** o CSS da biblioteca (carregado depois do nosso) põe `position: relative` em `.maplibregl-map`, e a caixa `.map-canvas` ficava com altura 0. Agora `.map-wrap > .map-canvas` (mais específico). Conferido no Chrome do dono injetando a regra: mapa de SP aparece. Observação: o mapa mostrava "Nenhum lugar no mapa ainda" para o dono (nenhuma review de lugar com lat/lng).
- Versão nova de biblioteca: só com pelo menos 2 semanas de lançada.

## Como trabalhamos (para uma conversa nova)
- Pasta no PC do dono: `C:\Users\yurim\Review` (= repositório público `github.com/yurigenteboa/Review`). O Claude edita uma cópia na nuvem e entrega os arquivos na pasta; o dono roda `git add . ; git commit -m "..." ; git push` no PowerShell do VS Code. A Vercel publica sozinha a cada push. Dependência nova = o dono roda `npm install` antes do push.
- Várias conversas mexem no projeto ao mesmo tempo: antes de gravar, confira se o arquivo no PC mudou desde que foi lido (e releia o CLAUDE.md e o doc da frente no começo).
- Supabase: projeto `review` (ref `dgvrkmqenkwfeytgaouv`, sa-east-1). Migrações aplicadas pelo SQL Editor do painel (Claude cola pelo navegador e confere com consultas só de leitura). Edge Functions publicadas pelo editor do painel ("Verify JWT with legacy secret" desligado; as funções conferem o login sozinhas).
- Segredos: nunca no chat nem digitados pelo Claude; o dono cola chaves no painel. Nunca usar a service_role.
- Pendências do dono: testar a parte de amigos com um amigo; chaves da Twitch (jogos) quando quiser.
- Conferir no ar: pelo Chrome do dono em www.mmisc.com.br (dados reais), depois do push.
