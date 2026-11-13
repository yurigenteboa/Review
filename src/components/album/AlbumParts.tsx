import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import {
  albumCover, albumKey, artistLine, artistPath, compact, genrePath, isMissingAcervo, refRating,
  useAlbumChart, useMyAlbumKeys, useOpenAlbum, type Album, type ChartFilter,
} from '../../lib/albuns'
import { initials } from '../../lib/format'
import { EmptyState, ErrorState } from '../../pages/states'
import './album.css'

import { t, tp } from '../../lib/i18n'

export type AlbumView = 'lista' | 'grade'

/** Capa quadrada do acervo; sem imagem (ou imagem quebrada), gradiente da categoria + iniciais. */
export function AlbumCover({ album, size, className = '' }: { album: Pick<Album, 'title' | 'cover_url' | 'mbid'>; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false)
  const src = albumCover(album)
  const style = size ? { width: size, height: size } : undefined
  if (src && !broken)
    return <img className={`alb-cover ${className}`} src={src} alt="" loading="lazy" decoding="async" style={style} onError={() => setBroken(true)} />
  return (
    <span className={`alb-cover alb-cover--empty ${className}`} aria-hidden="true" style={style}>
      {initials(album.title)}
    </span>
  )
}

/** Gêneros: o principal em destaque, os secundários mais discretos. Com `links`, cada um abre a página do gênero. */
export function GenreLine({ album, links = false, max }: { album: Pick<Album, 'genres' | 'genres_sec'>; links?: boolean; max?: number }) {
  const main = album.genres ?? []
  const sec = (album.genres_sec ?? []).slice(0, max ?? 99)
  if (!links)
    return (
      <span className="alb-genres">
        <strong>{main.join(', ')}</strong>
        {sec.length > 0 && <span> · {sec.join(', ')}</span>}
      </span>
    )
  return (
    <span className="alb-genre-chips">
      {main.map((g) => (
        <Link key={g} to={genrePath(g)} className="alb-gchip alb-gchip--main tap">{g}</Link>
      ))}
      {sec.map((g) => (
        <Link key={g} to={genrePath(g)} className="alb-gchip tap">{g}</Link>
      ))}
    </span>
  )
}

interface RowProps {
  album: Album
  rank?: number
  heard?: boolean
  onOpen: (a: Album) => void
  /** mostra a data completa em vez do ano */
  fullDate?: string
}

/** Linha da parada: posição, capa, título, artista, ano, gêneros e nota de referência. Toque abre o álbum. */
export function AlbumRow({ album, rank, heard, onOpen, fullDate }: RowProps) {
  const label = [
    rank ? t('{n}º', { n: rank }) : '',
    album.title,
    artistLine(album),
    String(album.year),
    t('referência {r} com {n}', { r: refRating(album.ref_rating), n: tp(album.ref_count, '{n} nota', '{n} notas') }),
    heard ? t('você já registrou') : '',
  ].filter(Boolean).join(', ')
  return (
    <button type="button" className="alb-row tap" onClick={() => onOpen(album)} aria-label={label}>
      {rank != null && <span className="alb-row__rank" aria-hidden="true">{rank}</span>}
      <AlbumCover album={album} className="alb-row__cover" />
      <span className="alb-row__text" aria-hidden="true">
        <strong className="alb-row__title">{album.title}</strong>
        <span className="alb-row__artist">{artistLine(album)}</span>
        <span className="alb-row__meta">
          {fullDate ?? album.year}
          {heard && <span className="alb-heard"> · ✓ {t('ouvido')}</span>}
        </span>
        <GenreLine album={album} max={2} />
      </span>
      <span className="alb-row__score" aria-hidden="true">
        <strong>{refRating(album.ref_rating)}</strong>
        <small>{compact(album.ref_count)}</small>
      </span>
    </button>
  )
}

/** Cartão da grade: capa grande com a posição, título e artista. */
export function AlbumTile({ album, rank, heard, onOpen }: RowProps) {
  return (
    <button
      type="button"
      className="alb-tile tap"
      onClick={() => onOpen(album)}
      aria-label={[rank ? t('{n}º', { n: rank }) : '', album.title, artistLine(album), String(album.year), heard ? t('você já registrou') : ''].filter(Boolean).join(', ')}
    >
      <span className="alb-tile__art" aria-hidden="true">
        <AlbumCover album={album} className="alb-tile__cover" />
        {rank != null && <span className="alb-tile__rank">{rank}</span>}
        {heard && <span className="alb-tile__heard">✓</span>}
      </span>
      <strong className="alb-tile__title" aria-hidden="true">{album.title}</strong>
      <span className="alb-tile__artist" aria-hidden="true">{artistLine(album)} · {album.year}</span>
    </button>
  )
}

/** Lista ou grade de álbuns, com o ✓ dos que você registrou e o "abrir" que cria o item. */
export function AlbumList({ albums, view, ranked = true, startRank = 1, dateOf }: { albums: Album[]; view: AlbumView; ranked?: boolean; startRank?: number; dateOf?: (a: Album) => string }) {
  const { userId } = useAuth()
  const mine = useMyAlbumKeys(userId)
  const open = useOpenAlbum()
  const heard = (a: Album) => Boolean(mine.data?.has(albumKey(a)))
  return (
    <>
      {view === 'grade' ? (
        <div className="alb-grid">
          {albums.map((a, i) => (
            <AlbumTile key={a.id} album={a} rank={ranked ? startRank + i : undefined} heard={heard(a)} onOpen={(x) => open.mutate(x)} />
          ))}
        </div>
      ) : (
        <div className="alb-list">
          {albums.map((a, i) => (
            <AlbumRow key={a.id} album={a} rank={ranked ? startRank + i : undefined} heard={heard(a)} onOpen={(x) => open.mutate(x)} fullDate={dateOf?.(a)} />
          ))}
        </div>
      )}
      {open.isPending && <span role="status" className="field-hint">{t('Abrindo…')}</span>}
      {open.error && (
        <span role="alert" className="alb-error">{t('Não deu para abrir: {message}', { message: (open.error as Error).message })}</span>
      )}
    </>
  )
}

/** Aviso enquanto o acervo não foi carregado no banco. */
export function AcervoMissing() {
  return (
    <EmptyState
      title={t('O acervo ainda não foi carregado')}
      text={t('Os álbuns aparecem aqui assim que a tabela do acervo for criada e importada no banco.')}
    />
  )
}

/** Parada com "carregar mais" (50 por vez). */
export function ChartList({ filter, view }: { filter: ChartFilter; view: AlbumView }) {
  const chart = useAlbumChart(filter)
  const albums = (chart.data?.pages ?? []).flat()
  if (chart.error) return isMissingAcervo(chart.error) ? <AcervoMissing /> : <ErrorState error={chart.error} onRetry={() => void chart.refetch()} />
  return (
    <div className="alb-chart">
      {chart.isLoading && <div className="alb-skeleton" aria-hidden="true" />}
      {chart.isLoading && <span className="visually-hidden" role="status">{t('Carregando…')}</span>}
      {!chart.isLoading && albums.length === 0 && <EmptyState title={t('Nenhum álbum com esse filtro')} text={t('Tente outro período ou gênero.')} />}
      <AlbumList albums={albums} view={view} />
      {chart.hasNextPage && (
        <button type="button" className="btn btn--plain tap alb-more" disabled={chart.isFetchingNextPage} onClick={() => void chart.fetchNextPage()}>
          {chart.isFetchingNextPage ? t('Carregando…') : t('Mostrar mais 50')}
        </button>
      )}
      {albums.length > 0 && (
        <p className="alb-note">
          {filter.year
            ? t('Ordem da parada original do ano.')
            : t('Ordem pela nota de referência ponderada: álbum com poucas notas fica mais perto da média geral.')}
        </p>
      )}
    </div>
  )
}

/** Alternar lista × grade (lembra a escolha no aparelho). */
export function useAlbumView(): [AlbumView, (v: AlbumView) => void] {
  const [view, setView] = useState<AlbumView>(() => {
    try {
      return localStorage.getItem('mmisc.albunsVista') === 'grade' ? 'grade' : 'lista'
    } catch {
      return 'lista'
    }
  })
  const set = (v: AlbumView) => {
    setView(v)
    try {
      localStorage.setItem('mmisc.albunsVista', v)
    } catch {
      /* navegação privada: só não lembra */
    }
  }
  return [view, set]
}

export function ViewToggle({ view, onChange }: { view: AlbumView; onChange: (v: AlbumView) => void }) {
  return (
    <div className="alb-view" role="group" aria-label={t('Modo de exibição')}>
      <button type="button" className="chip tap" aria-pressed={view === 'lista'} onClick={() => onChange('lista')}>{t('Lista')}</button>
      <button type="button" className="chip tap" aria-pressed={view === 'grade'} onClick={() => onChange('grade')}>{t('Grade')}</button>
    </div>
  )
}

/** Artistas do álbum como links para a página de cada um. */
export function ArtistLinks({ album }: { album: Pick<Album, 'artists' | 'artist_slugs'> }) {
  const names = album.artists ?? []
  const slugs = album.artist_slugs ?? []
  return (
    <>
      {names.map((n, i) => (
        <span key={`${n}-${i}`}>
          {i > 0 && ', '}
          {slugs[i] ? <Link to={artistPath(slugs[i])} className="alb-link">{n}</Link> : n}
        </span>
      ))}
    </>
  )
}
