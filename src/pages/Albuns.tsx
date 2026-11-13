import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AcervoMissing, AlbumList, ChartList, ViewToggle, useAlbumView } from '../components/album/AlbumParts'
import { GenreHeatmap, HBars, Bars } from '../components/album/AlbumCharts'
import { GenrePicker, PeriodPicker } from '../components/album/ChartFilters'
import { SearchIcon } from '../components/ui/Icons'
import { PageHeader } from '../components/ui/PageHeader'
import { artistPath, decadeLabel, genrePath, isMissingAcervo, useAcervoSearch, useAlbumStats, useGenreIndex, type ChartFilter } from '../lib/albuns'
import { formatRating } from '../lib/categories'
import { useDebounced } from '../lib/hooks'
import { EmptyState, ErrorState } from './states'
import '../components/album/album.css'

import { formatNumber, t, tp } from '../lib/i18n'

type Tab = 'paradas' | 'generos' | 'numeros'

/** Filtro da parada guardado no endereço (?periodo=1970&ano=1972&genero=MPB&sec=1): voltar e compartilhar mantêm. */
export function filterFromParams(p: URLSearchParams): ChartFilter {
  const per = p.get('periodo')
  const period: ChartFilter['period'] = per === 'antes' ? 'antes' : per && /^\d{4}$/.test(per) ? Number(per) : 'tudo'
  const ano = Number(p.get('ano'))
  return {
    period,
    year: typeof period === 'number' && ano >= period && ano < period + 10 ? ano : null,
    genre: p.get('genero') || null,
    withSec: p.get('sec') === '1',
  }
}

export function filterToParams(f: ChartFilter, base: URLSearchParams): URLSearchParams {
  const p = new URLSearchParams(base)
  const set = (k: string, v: string | null) => (v ? p.set(k, v) : p.delete(k))
  set('periodo', f.period === 'tudo' ? null : String(f.period))
  set('ano', f.year ? String(f.year) : null)
  set('genero', f.genre ?? null)
  set('sec', f.withSec ? '1' : null)
  return p
}

/**
 * Aba Álbuns: o acervo de referência (paradas anuais de 1909 a 2017).
 * Paradas por período e gênero, índice de gêneros e números do acervo.
 */
export default function Albuns() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('aba') === 'generos' ? 'generos' : params.get('aba') === 'numeros' ? 'numeros' : 'paradas'
  const filter = filterFromParams(params)
  const [view, setView] = useAlbumView()
  const [q, setQ] = useState('')
  const term = useDebounced(q.trim(), 350)
  const stats = useAlbumStats()

  const setTab = (next: Tab) => {
    const p = new URLSearchParams(params)
    if (next === 'paradas') p.delete('aba')
    else p.set('aba', next)
    setParams(p, { replace: true })
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'paradas', label: t('Paradas') },
    { id: 'generos', label: t('Gêneros') },
    { id: 'numeros', label: t('Números') },
  ]

  return (
    <div className="page page--wide">
      <PageHeader
        title={t('Álbuns')}
        subtitle={stats.data ? t('{n} de {de} a {ate}, com a nota de referência do público', { n: tp(stats.data.total, '{n} álbum', '{n} álbuns'), de: stats.data.anos[0]?.ano, ate: stats.data.anos[stats.data.anos.length - 1]?.ano }) : undefined}
      >
        <label className="search-field">
          <span style={{ color: 'var(--text-3)', display: 'flex' }}>
            <SearchIcon size={18} />
          </span>
          <span className="visually-hidden">{t('Buscar no acervo')}</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Álbum ou artista…')} />
        </label>
        {term.length < 2 && (
          <div className="segmented" role="tablist" aria-label={t('Seções')} style={{ marginTop: 12 }}>
            {TABS.map((x) => (
              <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)}>
                {x.label}
              </button>
            ))}
          </div>
        )}
      </PageHeader>

      <div className="page__body alb-page">
        {term.length >= 2 ? (
          <SearchResults term={term} view={view} />
        ) : tab === 'paradas' ? (
          <>
            <PeriodPicker value={filter} onChange={(f) => setParams(filterToParams(f, params), { replace: true })} />
            <div className="alb-toolbar">
              <GenrePicker value={filter} onChange={(f) => setParams(filterToParams(f, params), { replace: true })} />
              <ViewToggle view={view} onChange={setView} />
            </div>
            <h2 className="alb-h2">{chartTitle(filter)}</h2>
            <ChartList filter={filter} view={view} />
          </>
        ) : tab === 'generos' ? (
          <GenresTab />
        ) : (
          <NumbersTab />
        )}
      </div>
    </div>
  )
}

export function chartTitle(f: ChartFilter): string {
  const when = f.year ? t('de {ano}', { ano: f.year }) : f.period === 'tudo' ? t('de todos os tempos') : f.period === 'antes' ? t('de antes de 1950') : t('dos {d}', { d: decadeLabel(f.period) })
  return f.genre ? t('Melhores de {g} {when}', { g: f.genre, when }) : t('Melhores álbuns {when}', { when })
}

function SearchResults({ term, view }: { term: string; view: 'lista' | 'grade' }) {
  const s = useAcervoSearch(term)
  if (s.error) return isMissingAcervo(s.error) ? <AcervoMissing /> : <ErrorState error={s.error} onRetry={() => void s.refetch()} />
  if (s.isLoading) return <p className="field-hint" role="status">{t('Buscando…')}</p>
  const list = s.data ?? []
  if (list.length === 0) return <EmptyState title={t('Nada no acervo com “{v}”', { v: term })} text={t('O acervo vai de 1909 a 2017. Para outros álbuns, use a Busca.')} />
  return (
    <>
      <span className="field-label">{tp(list.length, '{n} resultado', '{n} resultados')}</span>
      <AlbumList albums={list} view={view} ranked={false} />
    </>
  )
}

function GenresTab() {
  const idx = useGenreIndex()
  const stats = useAlbumStats()
  const [q, setQ] = useState('')
  const [order, setOrder] = useState<'n' | 'media' | 'ini'>('n')
  const list = useMemo(() => {
    const all = [...(idx.data?.generos ?? [])]
    const n = q.trim().toLowerCase()
    const f = n ? all.filter((g) => g.g.toLowerCase().includes(n)) : all
    if (order === 'media') f.sort((a, b) => (b.n >= 20 ? 1 : 0) - (a.n >= 20 ? 1 : 0) || b.media - a.media)
    if (order === 'ini') f.sort((a, b) => a.ini - b.ini || b.n - a.n)
    return f.slice(0, 200)
  }, [idx.data, q, order])
  if (idx.error) return <ErrorState error={idx.error} onRetry={() => void idx.refetch()} />

  return (
    <>
      {stats.data && (
        <section aria-labelledby="gen-dec">
          <h2 id="gen-dec" className="alb-h2">{t('O que dominou cada década')}</h2>
          <div className="alb-decades">
            {[...stats.data.decadas].reverse().map((d) => (
              <div key={d.d} className="alb-decade">
                <Link to={`/albuns?periodo=${d.d < 1950 ? 'antes' : d.d}`} className="alb-decade__title alb-link">{decadeLabel(d.d)}</Link>
                <span className="alb-genre-chips">
                  {d.top.slice(0, 5).map(([g, c]) => (
                    <Link key={g} to={genrePath(g)} className="alb-gchip tap" title={tp(c, '{n} álbum', '{n} álbuns')}>{g}</Link>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <h2 className="alb-h2">{idx.data ? tp(idx.data.generos.length, '{n} gênero principal', '{n} gêneros principais') : t('Gêneros')}</h2>
      <label style={{ display: 'block' }}>
        <span className="visually-hidden">{t('Filtrar gêneros')}</span>
        <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Filtrar gêneros (ex.: Bossa Nova)')} />
      </label>
      <div className="chips no-scrollbar" role="group" aria-label={t('Ordenar')}>
        <button type="button" className="chip tap" aria-pressed={order === 'n'} onClick={() => setOrder('n')}>{t('Mais álbuns')}</button>
        <button type="button" className="chip tap" aria-pressed={order === 'media'} onClick={() => setOrder('media')}>{t('Maior nota média')}</button>
        <button type="button" className="chip tap" aria-pressed={order === 'ini'} onClick={() => setOrder('ini')}>{t('Mais antigos')}</button>
      </div>
      {idx.isLoading && <div className="alb-skeleton" aria-hidden="true" />}
      <div className="group">
        {list.map((g) => (
          <Link key={g.g} to={genrePath(g.g)} className="group__row tap alb-genre-row">
            <span className="alb-genre-row__text">
              <strong>{g.g}</strong>
              <small>{t('desde {ano} · auge nos {d}', { ano: g.ini, d: decadeLabel(g.pico) })}</small>
            </span>
            <span className="alb-genre-row__meta">
              <strong>{formatRating(g.media)}</strong>
              <small>{tp(g.n, '{n} álbum', '{n} álbuns')}</small>
            </span>
          </Link>
        ))}
      </div>
      {order === 'media' && <p className="alb-note">{t('Na ordem por nota, gêneros com menos de 20 álbuns vão para o fim.')}</p>}
    </>
  )
}

function NumbersTab() {
  const stats = useAlbumStats()
  const navigate = useNavigate()
  if (stats.error) return <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
  if (!stats.data) return <div className="alb-skeleton" aria-hidden="true" />
  const s = stats.data
  // mapa de calor de 1940 em diante (antes disso há poucos álbuns por década)
  const from = s.decadas.findIndex((d) => d.d >= 1940)
  const decades = s.decadas.slice(from).map((d) => d.d)
  const totals = s.decadas.slice(from).map((d) => d.n)
  const heat = s.generos_top.slice(0, 20).map((g) => ({ g: g.g, dec: g.dec.slice(from) }))
  const best = [...s.anos].filter((a) => a.top100 != null).sort((a, b) => (b.top100 ?? 0) - (a.top100 ?? 0)).slice(0, 5)
  return (
    <>
      <div className="alb-kpis">
        <div><strong>{formatNumber(s.total)}</strong><span>{t('álbuns')}</span></div>
        <div><strong>{formatNumber(s.n_generos)}</strong><span>{t('gêneros principais')}</span></div>
        <div><strong>{formatNumber(s.n_artistas)}</strong><span>{t('artistas')}</span></div>
        <div><strong>{formatNumber(s.media, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><span>{t('nota média')}</span></div>
      </div>

      <section aria-labelledby="num-heat">
        <h2 id="num-heat" className="alb-h2">{t('Gêneros ao longo do tempo')}</h2>
        <p className="alb-note">{t('Quanto cada gênero ocupa dos álbuns de cada década (os 20 maiores). Toque no nome para abrir.')}</p>
        <GenreHeatmap genres={heat} decades={decades} totals={totals} />
      </section>

      <section aria-labelledby="num-hist">
        <h2 id="num-hist" className="alb-h2">{t('Como as notas se distribuem')}</h2>
        <Bars
          label={t('Álbuns por nota de referência')}
          data={s.hist.filter(([k]) => k >= 2.5).map(([k, v]) => {
            const label = formatNumber(k, { minimumFractionDigits: 1 })
            // rótulo só de meio em meio ponto (2,5 · 3,0 · 3,5…)
            return { k: label, v, title: t('nota {k}', { k: label }), label: Math.round(k * 10) % 5 === 0 ? label : '' }
          })}
        />
        <p className="alb-note">{t('Cada barra junta as notas de 0,1 em 0,1 (ex.: 3,8 = de 3,80 a 3,89).')}</p>
      </section>

      <section aria-labelledby="num-anos">
        <h2 id="num-anos" className="alb-h2">{t('Os anos mais fortes')}</h2>
        <p className="alb-note">{t('Média da nota de referência dos 100 melhores álbuns de cada ano.')}</p>
        <div className="group">
          {best.map((a) => (
            <button key={a.ano} type="button" className="group__row tap alb-genre-row" onClick={() => navigate(`/albuns?periodo=${a.ano < 1950 ? 'antes' : Math.floor(a.ano / 10) * 10}${a.ano >= 1950 ? `&ano=${a.ano}` : ''}`)}>
              <span className="alb-genre-row__text"><strong>{a.ano}</strong><small>{t('ver a parada do ano')}</small></span>
              <span className="alb-genre-row__meta"><strong>{formatNumber(a.top100 ?? 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="num-art">
        <h2 id="num-art" className="alb-h2">{t('Artistas com mais álbuns no acervo')}</h2>
        <HBars
          label={t('Artistas com mais álbuns no acervo')}
          data={s.artistas.slice(0, 15).map((a) => ({ k: a.nome, v: a.n, to: artistPath(a.s), sub: `${a.ini}–${a.fim}` }))}
        />
      </section>
      <p className="alb-note">{t('Atenção: as paradas de cada ano têm tamanhos diferentes (500 a 2.000 álbuns), então contar álbuns por ano mede o tamanho da lista, não a produção da época.')}</p>
    </>
  )
}
