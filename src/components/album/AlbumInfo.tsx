import { Link } from 'react-router-dom'
import {
  albumDate, chartLabel, compact, decadeLabel, refRating, useAlbumPositions, useAlbumSimilar, useOpenAlbum, type Album,
} from '../../lib/albuns'
import { formatNumber, t, tp } from '../../lib/i18n'
import { AlbumCover, ArtistLinks, GenreLine } from './AlbumParts'
import './album.css'

/**
 * Página do álbum: a parte que vem do acervo (data, artistas, gêneros com o principal em destaque,
 * nota de referência do público, posições nas paradas e parecidos). Fica logo abaixo do cartão de
 * nota do MMisc, que continua sendo a média de quem registrou aqui.
 */
export function AlbumInfo({ album, mmiscAvg, mmiscN }: { album: Album; mmiscAvg: number; mmiscN: number }) {
  const pos = useAlbumPositions(album.id)
  const p = pos.data
  const yearChart = /^\d{4}$/.test(album.chart)
  const periodo = album.year < 1950 ? 'antes' : String(album.decade)

  return (
    <section className="alb-info" aria-labelledby="alb-ficha">
      <h2 id="alb-ficha" className="alb-h2">{t('Sobre o álbum')}</h2>

      <div className="alb-ref">
        <div className="alb-ref__box">
          <span className="alb-ref__label">{t('Referência do público')}</span>
          <strong className="alb-ref__value">{refRating(album.ref_rating)}</strong>
          <span className="alb-ref__sub">
            {tp(album.ref_count, '{n} nota', '{n} notas', { n: compact(album.ref_count) })}
            {album.ref_reviews > 0 && ` · ${tp(album.ref_reviews, '{n} resenha', '{n} resenhas', { n: compact(album.ref_reviews) })}`}
          </span>
        </div>
        <div className="alb-ref__box">
          <span className="alb-ref__label">{t('No MMisc')}</span>
          <strong className="alb-ref__value">{mmiscN ? refRating(mmiscAvg) : '–'}</strong>
          <span className="alb-ref__sub">{mmiscN ? tp(mmiscN, '{n} nota', '{n} notas') : t('Sem notas ainda')}</span>
        </div>
      </div>

      <div className="group alb-facts">
        <div className="group__row alb-fact">
          <span className="alb-fact__k">{t('Lançamento')}</span>
          <span className="alb-fact__v">{albumDate(album)}</span>
        </div>
        <div className="group__row alb-fact">
          <span className="alb-fact__k">{tp((album.artists ?? []).length, 'Artista', 'Artistas')}</span>
          <span className="alb-fact__v"><ArtistLinks album={album} /></span>
        </div>
        <div className="group__row alb-fact alb-fact--genres">
          <span className="alb-fact__k">{t('Gêneros')}</span>
          <span className="alb-fact__v"><GenreLine album={album} links /></span>
        </div>
      </div>

      <h3 className="alb-h3">{t('Nas paradas')}</h3>
      <div className="alb-ranks">
        {album.chart_pos != null && (
          <Link to={`/albuns?periodo=${periodo}${yearChart && album.year >= 1950 ? `&ano=${album.year}` : ''}`} className="alb-rank tap">
            <strong>{t('{n}º', { n: formatNumber(album.chart_pos) })}</strong>
            <span>{yearChart ? t('de {ano}', { ano: album.chart }) : t('dos {d}', { d: chartLabel(album.chart) })}</span>
          </Link>
        )}
        {p && (
          <>
            <Link to={`/albuns?periodo=${periodo}`} className="alb-rank tap">
              <strong>{t('{n}º', { n: formatNumber(p.na_decada) })}</strong>
              <span>{t('dos {d}', { d: decadeLabel(album.decade) })}</span>
            </Link>
            {album.genre_main && (
              <Link to={`/albuns/genero/${encodeURIComponent(album.genre_main)}`} className="alb-rank tap">
                <strong>{t('{n}º', { n: formatNumber(p.no_genero) })}</strong>
                <span>{t('em {g}', { g: album.genre_main })}</span>
              </Link>
            )}
            <Link to="/albuns" className="alb-rank tap">
              <strong>{t('{n}º', { n: formatNumber(p.geral) })}</strong>
              <span>{t('de {n} no acervo', { n: formatNumber(p.geral_total) })}</span>
            </Link>
          </>
        )}
      </div>
      <p className="alb-note">
        {t('A referência é a média de quem avaliou o álbum no público em geral. Década, gênero e acervo usam a nota ponderada pelo número de notas.')}
      </p>

      <Similar id={album.id} />
    </section>
  )
}

function Similar({ id }: { id: string }) {
  const sim = useAlbumSimilar(id)
  const open = useOpenAlbum()
  const list = sim.data ?? []
  if (!sim.isLoading && list.length === 0) return null
  return (
    <section aria-labelledby="alb-sim">
      <h3 id="alb-sim" className="alb-h3">{t('Parecidos')}</h3>
      <div className="alb-strip no-scrollbar">
        {sim.isLoading && <div className="alb-skeleton alb-skeleton--strip" aria-hidden="true" />}
        {list.map((a) => (
          <button key={a.id} type="button" className="alb-strip__item tap" onClick={() => open.mutate(a)} aria-label={`${a.title}, ${(a.artists ?? []).join(', ')}, ${a.year}`}>
            <AlbumCover album={a} className="alb-strip__cover" />
            <strong aria-hidden="true">{a.title}</strong>
            <span aria-hidden="true">{(a.artists ?? []).join(', ')} · {a.year}</span>
          </button>
        ))}
      </div>
      {open.error && <span role="alert" className="alb-error">{(open.error as Error).message}</span>}
    </section>
  )
}
