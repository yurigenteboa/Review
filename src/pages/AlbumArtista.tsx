import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AcervoMissing, AlbumList, ViewToggle, useAlbumView } from '../components/album/AlbumParts'
import { CareerPlot } from '../components/album/AlbumCharts'
import { PageHeader } from '../components/ui/PageHeader'
import { albumDate, chartLabel, genrePath, isMissingAcervo, refRating, useArtistAlbums } from '../lib/albuns'
import { BackToAlbuns } from './AlbumGenero'
import { EmptyState, ErrorState } from './states'
import '../components/album/album.css'

import { formatNumber, t, tp } from '../lib/i18n'

/** Página do artista: carreira (ano × nota), gêneros mais comuns e discografia do acervo. */
export default function AlbumArtista() {
  const { slug: raw } = useParams()
  const slug = decodeURIComponent(raw ?? '')
  const albums = useArtistAlbums(slug)
  const [view, setView] = useAlbumView()
  const [order, setOrder] = useState<'ano' | 'nota'>('ano')
  const list = useMemo(() => albums.data ?? [], [albums.data])

  const name = useMemo(() => {
    for (const a of list) {
      const i = (a.artist_slugs ?? []).indexOf(slug)
      if (i >= 0 && a.artists?.[i]) return a.artists[i]
    }
    return slug.replace(/[-_]/g, ' ')
  }, [list, slug])

  const sorted = useMemo(() => (order === 'ano' ? list : [...list].sort((a, b) => b.score - a.score)), [list, order])
  const best = useMemo(() => [...list].sort((a, b) => b.score - a.score)[0], [list])
  const genres = useMemo(() => {
    const c = new Map<string, number>()
    for (const a of list) for (const g of a.genres ?? []) c.set(g, (c.get(g) ?? 0) + 1)
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [list])
  const rated = list.filter((a) => a.ref_rating != null)
  const avg = rated.length ? rated.reduce((s, a) => s + (a.ref_rating ?? 0), 0) / rated.length : 0

  if (albums.error) return <div className="page">{isMissingAcervo(albums.error) ? <AcervoMissing /> : <ErrorState error={albums.error} onRetry={() => void albums.refetch()} />}</div>

  return (
    <div className="page page--wide">
      <PageHeader title={name} subtitle={t('Artista')} trailing={<BackToAlbuns />} />
      <div className="page__body alb-page">
        {albums.isLoading && <div className="alb-skeleton" aria-hidden="true" />}
        {!albums.isLoading && list.length === 0 && <EmptyState title={t('Nenhum álbum desse artista no acervo')} />}
        {list.length > 0 && (
          <>
            <div className="alb-kpis">
              <div><strong>{formatNumber(list.length)}</strong><span>{tp(list.length, 'álbum no acervo', 'álbuns no acervo')}</span></div>
              <div><strong>{list[0].year === list[list.length - 1].year ? list[0].year : `${list[0].year}–${list[list.length - 1].year}`}</strong><span>{t('anos')}</span></div>
              <div><strong>{refRating(avg)}</strong><span>{t('nota média')}</span></div>
            </div>
            {best && (
              <p className="alb-note">
                {t('Mais bem avaliado: {titulo} ({ano}), nº {pos} da parada de {parada}.', {
                  titulo: best.title, ano: best.year, pos: best.chart_pos ?? '–', parada: chartLabel(best.chart),
                })}
              </p>
            )}
            <section aria-labelledby="a-car">
              <h2 id="a-car" className="alb-h2">{t('Carreira')}</h2>
              <CareerPlot
                label={t('Nota de referência de cada álbum ao longo dos anos')}
                points={rated.map((a) => ({ id: a.id, x: a.year, y: a.ref_rating ?? 0, title: `${a.title} (${a.year}) · ${refRating(a.ref_rating)}` }))}
              />
            </section>
            {genres.length > 0 && (
              <section aria-labelledby="a-gen">
                <h2 id="a-gen" className="alb-h2">{t('Gêneros mais comuns')}</h2>
                <span className="alb-genre-chips">
                  {genres.map(([g, n]) => (
                    <Link key={g} to={genrePath(g)} className="alb-gchip alb-gchip--main tap">{g} · {n}</Link>
                  ))}
                </span>
              </section>
            )}
            <div className="alb-toolbar">
              <h2 className="alb-h2" style={{ margin: 0 }}>{t('Discografia no acervo')}</h2>
              <ViewToggle view={view} onChange={setView} />
            </div>
            <div className="chips no-scrollbar" role="group" aria-label={t('Ordenar')}>
              <button type="button" className="chip tap" aria-pressed={order === 'ano'} onClick={() => setOrder('ano')}>{t('Por ano')}</button>
              <button type="button" className="chip tap" aria-pressed={order === 'nota'} onClick={() => setOrder('nota')}>{t('Por nota')}</button>
            </div>
            <AlbumList albums={sorted} view={view} ranked={order === 'nota'} dateOf={(a) => `${albumDate(a)} · ${t('nº {n} de {parada}', { n: a.chart_pos ?? '–', parada: chartLabel(a.chart) })}`} />
          </>
        )}
      </div>
    </div>
  )
}
