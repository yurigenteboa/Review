# MMISC: contexto do app para o trabalho de login social

Este arquivo resume o app para uma conversa nova focada em **login com Google, Apple e Meta (Facebook)**. As regras do projeto continuam no `CLAUDE.md` da raiz; leia os dois.

Situação em 06/11/2026: login só por e-mail (código de uso único, sem senha). As fases 0 a 4 e as etapas F1 e F2 de filmes estão no ar em www.mmisc.com.br.

---

## 1. O que é o app

MMISC é um app de reviews de tudo: álbuns, filmes, séries, jogos, livros, bares, banheiros públicos e cidades. É um PWA mobile-first com visual "iOS glass". Hoje o público é o dono e os amigos; a rede aberta vem na Fase 6.

O dono (Yuri) entende a lógica (SQL, Python, Node) mas não escreve código do zero. Explique o que muda e por quê, em português do Brasil.

## 2. Stack e onde as coisas moram

| Peça | Detalhe |
| --- | --- |
| Front | React 19 + TypeScript estrito + Vite, React Router, TanStack Query, `motion` |
| PWA | `vite-plugin-pwa`, `display: standalone`, service worker com `skipWaiting` e `clientsClaim` |
| Back | Supabase: projeto `review`, ref `dgvrkmqenkwfeytgaouv`, região sa-east-1 |
| Deploy | Vercel. Cada `git push` na `main` publica sozinho. `vercel.json` manda todas as rotas para `index.html` |
| Domínio | www.mmisc.com.br |
| E-mails | Enviados de login@mmisc.com.br via Resend, configurado como SMTP próprio no Supabase |
| Pasta no PC | `C:\Users\yurim\Review` |

Variáveis do front (`.env.local` e Vercel): `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. O cliente fica em `src/lib/supabase.ts`, com `persistSession`, `autoRefreshToken` e `detectSessionInUrl` ligados.

## 3. Como o login funciona hoje

**Arquivos:**
- `src/lib/auth.tsx`:
  - `AuthProvider` lê a sessão com `getSession` e escuta `onAuthStateChange`; `useAuth()` devolve `{ session, loading, userId }`.
  - `sendLoginEmail(email)` chama `signInWithOtp` com `emailRedirectTo: window.location.origin` e `shouldCreateUser: true`.
  - `verifyLoginCode(email, token)` chama `verifyOtp` com `type: 'email'`.
  - `signOut()`.
- `src/pages/Login.tsx`: tela em 2 passos (e-mail, depois código). Mostra quem convidou quando a pessoa chegou por um link de convite.
- `src/App.tsx`: sem sessão, mostra `<Login />`. Com sessão, aceita o convite pendente (veja abaixo).

**Por que tem código além do link:** no iPhone, o app instalado na tela de início não compartilha o login com o Safari. O link do e-mail abre no Safari e a sessão fica lá; por isso o app instalado usa o código de 6 a 8 dígitos. **Esse mesmo problema deve afetar o login social (redirect OAuth) no PWA instalado e precisa ser testado logo no começo.**

**Convites:** o link `/convite/<código>` guarda o código no localStorage (`mmisc.pendingInvite`) antes do login. Depois do login, `App.tsx` chama a RPC `accept_invite` e os dois viram amigos. O login social precisa preservar isso: o código tem que sobreviver à ida e volta do redirect.

**Cadastro automático do perfil:** o trigger `on_auth_user_created` em `auth.users` roda `public.handle_new_user()`, que cria a linha em `public.profiles` com:
- `display_name = coalesce(raw_user_meta_data->>'name', parte do e-mail antes do @)`;
- `username` vazio (a pessoa escolhe depois em Perfil → Editar);
- `avatar_url` vazio.

Google, Apple e Facebook mandam nome e foto em chaves próprias dentro de `raw_user_meta_data` (por exemplo `full_name`, `name`, `avatar_url`, `picture`). Vale ajustar `handle_new_user` para aproveitar nome e foto. A Apple só manda o nome no primeiro login, e a pessoa pode esconder o e-mail real (e-mail de retransmissão privado).

**Tabelas ligadas ao usuário** (todas com RLS):
- `profiles`;
- `friendships`, `invites` (convites);
- `reviews` (diário), `review_photos`, `likes`, `comments`, `notifications`;
- `watchlist`, `entry_notes`, `entry_companions`, `user_services`.

Fotos ficam no bucket privado `review-photos/<user_id>/...`. Tudo é chaveado pelo `auth.uid()`. Por isso **a mesma pessoa não pode acabar com duas contas** (uma pelo e-mail, outra pelo Google): esse é o principal risco do login social.

## 4. Pontos a decidir ou verificar no novo chat

- [ ] Quais provedores entram e em que ordem (Google primeiro costuma ser o mais simples).
- [ ] Manter o login por código de e-mail como alternativa (recomendado; é o que funciona no PWA instalado).
- [ ] Vínculo de contas: como o Supabase trata o mesmo e-mail em provedores diferentes, e o que fazer com o e-mail escondido da Apple.
- [ ] Fluxo OAuth no PWA instalado no iPhone: para onde o redirect volta e se a sessão chega ao app.
- [ ] Contas e requisitos de cada provedor: Google Cloud (tela de consentimento), Apple Developer (conta paga, Services ID, chave), Meta for Developers (app em modo Live, revisão). Confirmar os requisitos atuais na documentação de cada um.
- [ ] Páginas públicas que os provedores costumam exigir: política de privacidade e instruções de exclusão de dados (também ajudam na LGPD da Fase 6).
- [ ] URLs de redirect no Supabase (Authentication → URL Configuration): www.mmisc.com.br, o domínio da Vercel e `localhost` para teste.
- [ ] Ajustar `handle_new_user` para nome e foto do provedor (é mudança de banco: arquivo de migração novo).
- [ ] Botões na tela de login seguindo as regras visuais de cada marca (Apple e Google têm diretrizes próprias).

## 4b. Decisões e andamento (06/11/2026)

**Decidido pelo dono:** só Google agora. Apple e Meta ficam para depois. Vínculo manual de contas (`linkIdentity`, "Contas conectadas") DESLIGADO por enquanto (alerta ANT-2026-7WJV60DR sobre o recurso). Sem RPC de apagar conta vazia (era só para a Apple).

**Pesquisa (resumo):**
- Google: Google Cloud grátis; tela de consentimento External com `openid`, `email`, `profile` (sem revisão de dados). Sem domínio próprio, a tela mostra `dgvrkmqenkwfeytgaouv.supabase.co`; a verificação de marca (grátis, exige página inicial + privacidade no mesmo domínio + domínio verificado no Search Console) é o caminho escolhido em vez do domínio próprio de auth (Pro US$ 25 + US$ 10/mês).
- Vínculo automático: o Supabase junta na mesma conta identidades com o mesmo e-mail confirmado. Google com o mesmo e-mail do código = mesma conta, mesmo `user_id`.
- iPhone, app instalado: relatos dizem que o redirect do Google sai para o Safari e a sessão fica lá. Precisa de teste real. Solução adotada: no app instalado do iPhone o código por e-mail vem primeiro e o botão do Google tem um aviso; se o login terminar no Safari, aparece "Você entrou pelo navegador". O convite viaja na URL de volta (`?convite=`) para não se perder.
- Apple (depois): US$ 99/ano, segredo vence a cada 6 meses, OAuth não entrega nome, e-mail escondido nunca casa com conta existente.
- Meta (depois): fontes divergem sobre exigir verificação de empresa; conferir no painel antes.

**Feito no código (06/11):**
- `src/lib/auth.tsx`: `signInWithGoogle(convite)` (`prompt=select_account`, volta para `/` com `?convite=` e `?origem=app` se começou no app instalado), `googleLoginEnabled()` (liga com `VITE_LOGIN_GOOGLE=on` ou pelo interruptor em `/kit`, salvo em localStorage `mmisc.googleLoginTest`), `isStandalone()`, `isStandaloneIOS()`, `readOAuthError()`.
- `src/pages/Login.tsx`: botão "Continuar com o Google" (cores das diretrizes do Google via tokens `--google-*`; logo oficial recortado do kit de marca do Google em `public/brand/google-g-light.png` e `google-g-dark.png`), erro do OAuth traduzido, links Sobre/Privacidade/Termos.
- `src/pages/Legal.tsx`: páginas públicas `/sobre`, `/privacidade`, `/termos`, `/excluir-dados` (abrem sem login). Contato: `CONTACT_EMAIL` = contato@mmisc.com.br.
- `src/App.tsx`: rotas públicas antes do teste de sessão; lê `?convite=` e `?origem=` na volta; aviso de login que terminou no navegador.
- `src/pages/Kit.tsx`: interruptor "Teste: login com Google". `ReviewCard` `Avatar`: `referrerPolicy="no-referrer"` (foto do Google).
- Migração `202611061900_login_google_perfil.sql`: `handle_new_user` usa `full_name`/`name`, foto só do Google (https), nome vazio para e-mail escondido da Apple, erro nunca bloqueia o cadastro; gatilho novo `on_auth_identity_created` em `auth.identities` preenche foto/nome de quem já tinha conta e conecta o Google (só o que está vazio ou é o nome automático). Testada em PGlite (10 cenários). Não mexe em RLS.

**Feito no painel (06/11):**
- Google Cloud, projeto `mmisc-513918`: Auth Platform com app "MMISC", Externo, **Em produção**; e-mail de suporte e de contato yms.moraes@gmail.com; Branding com página inicial `/sobre`, `/privacidade`, `/termos`; domínios autorizados `mmisc.com.br` e `dgvrkmqenkwfeytgaouv.supabase.co`; escopos só `openid`, `userinfo.email`, `userinfo.profile`; client Web "MMISC Web (Supabase)" com origens `https://www.mmisc.com.br` e `http://localhost:5173` e retorno `https://dgvrkmqenkwfeytgaouv.supabase.co/auth/v1/callback`. Sem logo (logo exige verificação de marca).
- Supabase: provedor Google LIGADO (ID e segredo colados pelo dono; skip nonce e allow without email desligados). URL Configuration já estava certa (Site URL `https://www.mmisc.com.br`; redirects `www`, apex, `review-one-omega.vercel.app`, localhost e 127.0.0.1, todos com `/**`). Manual linking: desligado (conferido).
- Migração `202611061900_login_google_perfil.sql` APLICADA e conferida: gatilhos `on_auth_user_created` e `on_auth_identity_created` ativos, funções security definer, sem execute para anon/authenticated.

**Falta (Google):** push do front; e-mail contato@mmisc.com.br recebendo; testar (computador, Safari do iPhone, app instalado, convite, vínculo com a conta antiga em `auth.identities`); depois `VITE_LOGIN_GOOGLE=on` na Vercel; Search Console (DNS) e verificação de marca.

## 5. Regras do projeto que valem aqui

- **Segredos** (client secret do Google, chave .p8 da Apple, app secret da Meta) **nunca no chat** nem digitados pelo Claude: o dono cola no painel do Supabase. Nunca usar a `service_role`.
- **Antes de mexer em auth ou RLS, explicar o plano e esperar confirmação.**
- Toda mudança de banco vira arquivo em `supabase/migrations/AAAAMMDDHHMM_descricao.sql` e é aplicada pelo SQL Editor do painel; nada de clique solto.
- TypeScript estrito, sem `any`. Cores, raios e blur só via `src/styles/tokens.css`. Botões reais com alvo de toque de pelo menos 44 px e `aria-label` quando têm só ícone. Textos em português do Brasil.
- Antes de entregar: `npm run build` sem erro. O Claude edita uma cópia na nuvem e entrega os arquivos na pasta do PC. O dono roda `git add . ; git commit -m "..." ; git push` no PowerShell do VS Code.
- Se uma migração e o front dependem um do outro, aplicar a migração e dar push logo em seguida.

## 6. O que NÃO mexer nesta conversa

Filmes (página do filme, diário, quero ver, streamings: etapas F1 a F3) seguem em outro chat. Arquivos dessa frente:
- `src/pages/Filme.tsx`, `src/components/movie/`;
- `src/lib/movie.ts`, `src/lib/diary.ts`;
- `src/components/review/ComposeSheet.tsx`, `src/components/review/DiaryViews.tsx`;
- `supabase/functions/movie-details/`;
- migrações `202611061500_*` e `202611061700_*`.

Se o login precisar tocar em algum deles, avise antes.
