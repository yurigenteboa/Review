# MMisc · Álbuns (acervo de referência)

> Frente criada em 13/11/2026. O CLAUDE.md principal tem as regras gerais e o resumo de cada frente; aqui fica o detalhe. Ao terminar algo nesta frente, registre aqui e atualize a linha de resumo no CLAUDE.md.

## O que é
- As paradas anuais de álbuns do dono (pasta `Albuns/`, um `.docx` por ano/década, 1909–2017) viram um **acervo de referência** dentro do app: **78.520 álbuns**, 1.751 gêneros principais, 33.380 artistas.
- Cada álbum tem: capa, título, artista(s), data de lançamento (dia/mês/ano conforme a precisão), gêneros principais (a linha de destaque) e secundários, nota média do público, nº de notas e de resenhas, e a posição na parada de origem.
- Inspiração: paradas por ano/década/gênero, páginas de gênero e artista e a ficha do álbum, no estilo dos sites de crítica/notas de música. Nada de nome ou marca de terceiros na interface (regra do projeto).

## Decisões do dono (13/11)
- Acervo numa **tabela do Supabase** (`album_catalog`, só leitura, igual ao `place_catalog`), não em arquivos estáticos.
- **Capas:** o JPG do `.docx` não sobe (2,8 GB). O script procura a capa no catálogo público do Deezer (sem chave) e, opcionalmente, liga o álbum ao **MusicBrainz** (aí o álbum vira o MESMO item da busca do app e ganha a capa do Cover Art Archive quando faltar).
- **Nota do público:** aparece como **"Referência do público"**, sem citar a fonte, ao lado da média do MMisc. Os termos do site de origem não permitem reaproveitar esses dados: com a rede aberta (Fase 6), rever (ex.: mostrar só para logados, ou usar só para ordenar).
- Escopo da 1ª entrega: **tudo** — paradas, página do álbum, do gênero, do artista e números.

## Como os dados entram (passo a passo, no PC)
1. Os `.json` já existem em `Albuns/dados/` (gerados antes pelo `Albuns/extrair.py`, um por `.docx`). O arquivo antigo `Top albums of 50's.json` é ignorado (duplicado do `1950s.json`).
2. `python scripts\albuns\acervo.py capas` — capas pelo Deezer, ~3 h, retomável (`Albuns/dados/capas.json`).
3. (opcional) `python scripts\albuns\acervo.py mbid` — liga ao MusicBrainz, 1 consulta/s, ~24 h, retomável (`Albuns/dados/mbid.json`). Pode rodar junto com o passo 2, em outra janela.
4. `python scripts\albuns\acervo.py csv` — gera `Albuns/saida/album_catalog_parte1..7.csv` e `public/albuns/estatisticas.json` + `generos.json` (estes dois vão para o site; commitar).
5. Supabase > Table Editor > `album_catalog` > Import data from CSV, uma parte por vez. Para atualizar depois (capas novas, ids do MusicBrainz): `truncate public.album_catalog;` no SQL Editor e importar de novo. Itens já criados não dependem da tabela (guardam título/capa/ano), mas a ficha do álbum relê o acervo.
- `Albuns/` está no `.gitignore` (os `.docx` somam ~2,8 GB e os dados vêm de terceiros; o repositório é público).

## Banco (`supabase/migrations/202611131600_albuns_acervo.sql`)
- `album_catalog`: id = caminho da página de origem (`album/artista/titulo`); CSV só com texto/número; listas separadas por `|` (`artists_txt`, `artist_slugs_txt`, `genres_txt`, `genres_sec_txt`) e colunas geradas (`artists`, `artist_slugs`, `genres`, `genres_sec`, `genre_main`, `decade`, `title_norm`, `search_norm`). `score` = nota ponderada (bayesiana, peso 300 notas na média geral 3,44) calculada pelo script.
- RLS: logado só lê; ninguém escreve pelo app; visitante nada (revoke de anon/authenticated + grant select).
- View `albuns` (security_invoker) com as colunas do app. As paradas filtram direto nela pelo PostgREST (ano, década, gênero com `cs`, artista com `cs`) e ordenam por `chart_pos` (ano) ou `score` (resto).
- Funções (security invoker, só logado): `search_album_catalog(q, limite)` (trecho ou palavra parecida, `<<%` com índice trigram), `album_catalog_for(source, external_id, título, artista)` (acervo → MusicBrainz → título+artista), `album_similar(id, limite)` (gêneros em comum, época, nota, popularidade; sem o mesmo artista), `album_positions(id)` (posição no ano, década, gênero principal e geral).
- Itens: abrir um álbum do acervo cria o item como na busca: `source 'musicbrainz'` (com mbid) ou `'acervo'` (external_id = id do acervo), `metadata.acervo` = id.
- 33 cenários em `supabase/tests/albuns_acervo.mjs`. Carga real testada em PGlite: 78.520 linhas em ~6 s; paradas 1–17 ms; busca ~10 ms; posições ~35 ms.

## App
- `src/lib/albuns.ts`: tipos, `albumCover` (Deezer → Cover Art Archive → iniciais), `albumToResult`, `albumDate` (no idioma da pessoa), hooks `useAlbumChart` (50 por página), `useArtistAlbums`, `useAcervoSearch`, `useAlbumForItem`, `useAlbumSimilar`, `useAlbumPositions`, `useOpenAlbum`, `useMyAlbumKeys` (✓ "ouvido" nas listas), `useAlbumStats`/`useGenreIndex` (JSONs estáticos), `isMissingAcervo` (antes da migração: aviso "O acervo ainda não foi carregado", não erro).
- Telas: `/albuns` (`pages/Albuns.tsx`: busca no acervo; abas Paradas / Gêneros / Números; filtro no endereço `?periodo=1970&ano=1972&genero=MPB&sec=1`), `/albuns/genero/:g` (`AlbumGenero.tsx`), `/albuns/artista/:slug` (`AlbumArtista.tsx`, gráfico de carreira ano × nota).
- Componentes em `src/components/album/`: `AlbumParts` (capa, linha, grade, lista com "Mostrar mais 50", lista×grade lembrada em `mmisc.albunsVista`), `ChartFilters` (período, ano, gênero com folha de busca, "Contar como secundário"), `AlbumCharts` (barras, barras horizontais, mapa de calor gênero×década, carreira; uma cor só = `--cat-album`), `AlbumInfo` (ficha na página do item), `album.css`.
- Página do álbum (`Item.tsx`): se o item é álbum e está no acervo, seção "Sobre o álbum" (Referência do público × No MMisc, lançamento, artistas com link, gêneros com o principal em destaque, "Nas paradas" com 4 posições clicáveis, Parecidos). A capa do acervo entra no topo quando o item não tem imagem.
- Busca (`useCatalogSearch`, categoria Álbum): resultados do acervo primeiro, depois MusicBrainz (sem repetir o mesmo mbid). Vale para a Busca e para o registro.
- Entradas: menu lateral "Álbuns" e link "Explorar paradas, gêneros e artistas ›" na Busca com o chip Álbum.
- Fumaça: 7 checagens novas (paradas pela busca, aviso de parada vazia, filtro no endereço, abas Gêneros e Números, páginas de gênero e artista).

## Insights / próximos passos sugeridos
- **"Quantos do top você já ouviu"** por ano/década/gênero (progresso estilo desafio), usando o ✓ que já existe.
- **Quero ouvir** direto da parada (hoje só na página do item).
- **Nota do MMisc nas paradas** quando houver volume (parada "dos amigos" por década/gênero).
- **País do artista** (o `Albuns/paises.py` já faz isso pelo MusicBrainz): mapa e filtro por país (ex.: só Brasil).
- Cores das capas ao longo do tempo e "pérola escondida" (álbum bom com poucas notas), que o app antigo da pasta `Albuns/app` tinha.
- Anos depois de 2017: faltam os `.docx`.
