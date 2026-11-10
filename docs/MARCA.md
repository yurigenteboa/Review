# MMisc · Marca

**Grafia oficial: MMisc** (decisão do dono, 08/11). Em código, chaves e domínio seguem minúsculas (`mmisc.`, mmisc.com.br).

Logo novo adotado em 07/11/2026. Fonte original (imagem): `docs/marca/logo-original.png`.
Os vetores foram traçados dela, camada por cor; **edite sempre os vetores, nunca os PNGs**.

## As 3 versões

| Versão | Arquivo | Onde usar | Tamanho mínimo |
|---|---|---|---|
| **Logo completo** (cartas + letreiro) | `public/brand/logo-arte.svg` | ícone do app, telas de abertura, login, prévia de link | ~60 px de lado |
| **Símbolo** (cartas em leque + disco) | `public/brand/simbolo.svg` = `public/favicon.svg` | aba do navegador, barra lateral do tablet, qualquer espaço pequeno | 24 px |
| **Símbolo liso** (sem o disco) | `public/brand/simbolo-liso.svg` | só 16 px (`favicon.ico`) | 16 px |
| **Letreiro** "MMisc" (uma cor) | `public/brand/letreiro.svg`, `<Wordmark>` em `src/components/ui/Brand.tsx`, `drawWordmark` em `src/lib/brand.ts` | barra lateral do desktop, retrospectiva, onde o nome aparece sobre fundo do app | 28 px de altura |

Regras:
- O logo completo **só vai sobre preto** (os detalhes, como disco, claquete, prédios e vaso, são vazados). Em fundo claro, ele vai dentro do azulejo preto.
- O letreiro sozinho é de uma cor só e segue a cor do texto (`currentColor`): escuro no tema claro, claro no escuro. Sobre preto, creme `#F4E8D0`.
- Nada de esticar, girar, sombra ou contorno. Espaço livre em volta: pelo menos a altura do "i".

## Cores da marca

| | Hex | Papel |
|---|---|---|
| Preto | `#050505` | fundo do logo/azulejo |
| Creme | `#F4E8D0` | letreiro, carta do cinema |
| Vermelho | `#E8262A` | carta da música (disco) |
| Roxo | `#AB6EC3` | carta da cidade |
| Verde | `#7FB95A` | carta do banheiro |

Essas cores são da **marca** (ícones, splash, prévia); em `tokens.css` como `--brand-*`. As cores das categorias dentro do app continuam em `--cat-*`.

## Cores do app (08/11)

- **Destaque = par preto/creme do logo**, não vermelho: o vermelho já é curtir/apagar (`--like`) e a categoria Filme; um destaque vermelho faria "Salvar" parecer "Apagar".
  - Claro: `--accent` `#1A1714` (tinta quente), texto sobre ele `--on-accent` creme.
  - Escuro: `--accent` creme `#F4E8D0`, texto sobre ele `--on-accent` `#0B0B0B`.
  - Texto sobre botão de destaque: SEMPRE `var(--on-accent)`, nunca `#fff`. Sombra: `var(--accent-shadow)`.
- **Login, capa do perfil e páginas públicas**: `--login-gradient` = preto da marca com brilhos suaves de vermelho, roxo e verde. O cartão do login é sólido (`--surface`).
- **Retrospectiva**: preto → vermelho escuro (`--retro-from`/`--retro-to`), texto creme (`--retro-ink`).
- Página "Sobre": letreiro no título (`PageHeader` aceita `ReactNode`).

## Arquivos gerados

`python scripts/marca/gerar_marca.py` (precisa de `pip install cairosvg pillow`) recria a partir dos vetores:
- `public/icons/icon-192.png`, `icon-512.png` (cantos arredondados), `icon-512-maskable.png` (Android, logo dentro do círculo seguro), `apple-touch-icon.png` (180, o iPhone arredonda)
- `public/favicon.ico` (16 liso, 32 e 48 com disco)
- `public/splash/*` (10 tamanhos do iPhone × claro/escuro: escuro = logo direto no preto; claro = azulejo preto no fundo `#F2F2F7`)
- `public/brand/og.png` (1200×630, prévia de link do site; também é a imagem reserva do perfil público sem foto)

No Windows o cairosvg precisa da biblioteca Cairo; se der erro de DLL, instale o GTK runtime ou peça para o Claude gerar na nuvem.

## Onde a marca aparece no código

- `index.html`: favicon (.ico + .svg), apple-touch-icon, telas de abertura, bloco `og:padrao` (prévia do site).
- `proxy.ts`: em `/@usuario` tira o bloco `og:padrao` e põe o do perfil; sem foto, usa `/brand/og.png`.
- `vite.config.ts`: ícones do manifesto e `favicon.ico` no cache.
- `SideBar.tsx`: desktop = letreiro; tablet = símbolo.
- `Login.tsx`: logo completo (112 px) como título da página (`alt="MMISC"`).
- `Retrospectiva.tsx`: letreiro desenhado no canvas no lugar do texto "MMISC".

## Em aberto (decisão do dono)

1. **Cores das cartas × cores das categorias.** No logo, música = vermelho, cinema = creme, cidade = roxo, banheiro = verde. No app, álbum = roxo, filme = vermelho, cidade = azul-piscina, banheiro = azul. Opções: deixar como está (marca ≠ categoria), ou alinhar as categorias do app às cartas.

Resolvidos em 08/11: destaque do app e fundo do login (seção "Cores do app"); grafia = MMisc.

## Notas de implementação (movidas do CLAUDE.md em 10/11)
- Guia completo em `docs/MARCA.md`. Logo = cartas em leque (música vermelha com disco, cinema creme, cidade roxa, banheiro verde) + letreiro "MMisc" creme, sempre sobre preto.
- Vetores em `public/brand/`: `logo-arte.svg` (completo, só sobre preto), `simbolo.svg` (= `public/favicon.svg`, para tamanhos pequenos), `simbolo-liso.svg` (16 px), `letreiro.svg` (uma cor). Imagem original em `docs/marca/logo-original.png`.
- PNGs (ícones, `favicon.ico`, 20 telas de abertura, `brand/og.png`) saem de `scripts/marca/gerar_marca.py`; não editar PNG à mão.
- Código: `<Wordmark>` (`components/ui/Brand.tsx`) e `WORDMARK_PATH`/`drawWordmark` (`lib/brand.ts`). Barra lateral: desktop = letreiro, tablet = símbolo. Login: logo completo como `<h1>`. Retrospectiva: letreiro no canvas. `index.html` tem bloco `og:padrao` (prévia do site) que o `proxy.ts` remove em `/@usuario`.
- **Grafia oficial: MMisc** (08/11; todos os textos do app trocados).
- **Cores do app (08/11):** destaque = par preto/creme do logo (`--accent` tinta `#1A1714` no claro, creme no escuro; texto sobre botão = `var(--on-accent)`, nunca `#fff`; sombra `var(--accent-shadow)`). Vermelho NÃO é destaque (já é curtir/apagar e Filme). Tokens `--brand-*`. Login/capa do perfil = `--login-gradient` (preto com brilhos das cartas), cartão do login sólido. Retrospectiva preto → vermelho escuro, texto creme. Página "Sobre" com o letreiro (`PageHeader.title` aceita ReactNode).
- Em aberto: cores das cartas × `--cat-*`.
