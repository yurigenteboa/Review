# Review

Review de tudo: álbuns, filmes, jogos, bares, banheiros públicos, cidades.
PWA com visual iOS de vidro, feito em React + Vite + Supabase.

## Rodar no computador

```bash
npm install          # só na primeira vez (baixa as dependências)
npm run dev          # abre em http://localhost:5173
```

Para testar no celular na mesma rede Wi-Fi: `npm run dev -- --host` e abra o endereço "Network" que aparecer.

## Variáveis de ambiente

1. Copie `.env.example` para `.env.local`.
2. Preencha com a URL e a chave `anon public` do Supabase (botão **Connect** no painel do projeto).
3. O `.env.local` nunca vai para o GitHub.

## Publicar

Cada `git push` na branch `main` publica automaticamente na Vercel.
Na Vercel, cadastre as mesmas duas variáveis em **Settings → Environment Variables**.

## Instalar no iPhone

Abra o link da Vercel no **Safari** → Compartilhar → **Adicionar à Tela de Início**.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor local com recarga automática |
| `npm run build` | Gera a versão de produção em `dist/` |
| `npm run preview` | Serve o `dist/` localmente (para testar o PWA) |
| `npm run lint` | Procura erros comuns no código |
