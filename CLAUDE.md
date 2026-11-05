# Review — contexto do projeto

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
  pages/              Inicio, Buscar, Mapa, Perfil, Kit
  lib/                categories.ts, sample.ts (dados falsos da Fase 1), supabase.ts
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
0 Setup · 1 Design system + casca (atual) · 2 MVP pessoal (login, banco, criar review) · 3 Catálogo via APIs · 4 Amigos (feed, convites) · 5 PWA (offline, push, mapa) · 6 Rede aberta (moderação, LGPD)
