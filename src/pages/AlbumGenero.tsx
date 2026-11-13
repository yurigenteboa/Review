import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChartList, ViewToggle, useAlbumView } from '../components/album/AlbumParts'
import { Bars } from '../components/album/AlbumCharts'
import { GenrePicker, PeriodPicker } from '../components/album/ChartFilters'
import { PageHeader } from '../components/ui/PageHeader'
import { artistPath, decadeLabel, genrePath, refRating, useGenreIndex } from '../lib/albuns'
import { chartTitle, filterFromParams, filterToParams } from './Albuns'
import '../components/album/album.css'

import { formatNumber, t, tp } from '../lib/i18n'

/** Botão de voltar no cabeçalho das páginas do acervo. */
export function BackToAlbuns() {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      className="btn btn--plain tap alb-back"
      onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/albuns'))}
    >
      ‹ {t('Voltar')}
    </button>
  )
}

/** Página do gênero: números, curva por década, vizinhos, artistas e a parada do gênero. */
export default function AlbumGenero() {
  const { g: raw } = useParams()
  const genre = decodeURIComponent(raw ?? '')
  const [params, setParams] = useSearchParams()
  const [view, setView] = useAlbumView()
  const idx = useGenreIndex()
  const info = idx.data?.generos.find((x) => x.g === genre)
  const onlySec = idx.data?.so_sec.find(([x]) => x === genre)
  const base = filterFromParams(params)
  // gênero só secundário: a parada conta os secundários, senão fica vazia
  const filter = { ...base, genre, withSec: base.withSec || Boolean(onlySec && !info) }

  return (
    <div className="page page--wide">
      <PageHeader title={genre} subtitle={t('Gênero')} trailing={<BackToAlbuns />} />
      <div className="page__body alb-page">
        {info && (
          <>
            <div className="alb-kpis">
              <div><strong>{formatNumber(info.n)}</strong><span>{t('álbuns como principal')}</span></div>
              <div><strong>{formatNumber(info.sec)}</strong><span>{t('como secundário')}</span></div>
              <div><strong>{refRating(info.media)}</strong><span>{t('nota média')}</span></div>
              <div><strong>{info.ini}</strong><span>{t('primeiro álbum')}</span></div>
            </div>
            <section aria-labelledby="g-dec">
              <h2 id="g-dec" className="alb-h2">{t('Álbuns por década')}</h2>
              <Bars
                label={t('Álbuns de {g} por década', { g: genre })}
                data={(idx.data?.decadas ?? [])
                  .map((d, i) => ({ d, v: info.dec[i] ?? 0 }))
                  // de 1940 em diante, ou desde a primeira década com álbum do gênero
                  .filter((x, i, all) => x.d >= 1940 || all.slice(0, i + 1).some((y) => y.v > 0))
                  .map(({ d, v }) => ({ k: String(d), v, title: decadeLabel(d), label: d >= 1940 ? String(d).slice(2) : String(d) }))}
              />
              <p className="alb-note">{t('Auge nos {d}.', { d: decadeLabel(info.pico) })}</p>
            </section>
            {info.viz.length > 0 && (
              <section aria-labelledby="g-viz">
                <h2 id="g-viz" className="alb-h2">{t('Vizinhos')}</h2>
                <p className="alb-note">{t('Gêneros que mais aparecem junto de {g} nos mesmos álbuns.', { g: genre })}</p>
                <span className="alb-genre-chips">
                  {info.viz.map((v) => (
                    <Link key={v} to={genrePath(v)} className="alb-gchip tap">{v}</Link>
                  ))}
                </span>
              </section>
            )}
            {info.art.length > 0 && (
              <section aria-labelledby="g-art">
                <h2 id="g-art" className="alb-h2">{t('Quem mais gravou')}</h2>
                <span className="alb-genre-chips">
                  {info.art.map(([s, nome]) => (
                    <Link key={s} to={artistPath(s)} className="alb-gchip alb-gchip--main tap">{nome}</Link>
                  ))}
                </span>
              </section>
            )}
          </>
        )}
        {!info && onlySec && <p className="alb-note">{t('{g} aparece só como gênero secundário ({n}).', { g: genre, n: tp(onlySec[1], '{n} álbum', '{n} álbuns') })}</p>}

        <h2 className="alb-h2">{chartTitle(filter)}</h2>
        <PeriodPicker value={filter} onChange={(f) => setParams(filterToParams({ ...f, genre: null }, params), { replace: true })} />
        <div className="alb-toolbar">
          <GenrePicker fixed value={filter} onChange={(f) => setParams(filterToParams({ ...f, genre: null }, params), { replace: true })} />
          <ViewToggle view={view} onChange={setView} />
        </div>
        <ChartList filter={filter} view={view} />
      </div>
    </div>
  )
}
