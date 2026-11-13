import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { decadeLabel, genrePath } from '../../lib/albuns'
import { formatNumber, t } from '../../lib/i18n'
import { formatRating } from '../../lib/categories'

// Gráficos simples em SVG/HTML, uma cor só (a da categoria Álbum, em intensidades):
// cada um é uma série única, então não há legenda; o número de cada barra aparece ao passar
// o dedo/mouse (title) e está no rótulo para leitor de tela.

/** Barras verticais (ex.: álbuns por década de um gênero). */
export function Bars({ data, label, height = 120, format = (n: number) => formatNumber(n) }: {
  data: { k: string; v: number; title?: string; label?: string }[]
  label: string
  height?: number
  format?: (n: number) => string
}) {
  const max = Math.max(1, ...data.map((d) => d.v))
  return (
    <figure className="alb-bars" aria-label={label} style={{ height: height + 34 }}>
      <div className="alb-bars__plot" style={{ height }}>
        {data.map((d) => (
          <div key={d.k} className="alb-bars__col" title={`${d.title ?? d.k}: ${format(d.v)}`} role="img" aria-label={`${d.title ?? d.k}: ${format(d.v)}`}>
            <span className="alb-bars__bar" style={{ height: `${Math.max(d.v ? 2 : 0, (d.v / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="alb-bars__axis" aria-hidden="true">
        {data.map((d) => (
          <span key={d.k}>{d.label ?? d.k}</span>
        ))}
      </div>
    </figure>
  )
}

/** Barras horizontais com nome e número (ex.: artistas com mais álbuns). */
export function HBars({ data, label }: { data: { k: string; v: number; to?: string; sub?: string }[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.v))
  return (
    <ol className="alb-hbars" aria-label={label}>
      {data.map((d) => {
        const inner = (
          <>
            <span className="alb-hbars__name">
              {d.k}
              {d.sub && <small>{d.sub}</small>}
            </span>
            <span className="alb-hbars__track" aria-hidden="true">
              <span style={{ width: `${(d.v / max) * 100}%` }} />
            </span>
            <span className="alb-hbars__v">{formatNumber(d.v)}</span>
          </>
        )
        return <li key={d.k}>{d.to ? <Link to={d.to} className="alb-hbars__row tap">{inner}</Link> : <span className="alb-hbars__row">{inner}</span>}</li>
      })}
    </ol>
  )
}

/**
 * Mapa de calor gênero × década: quanto da década cada gênero ocupa (fatia dos álbuns da década).
 * Intensidade única (sequencial), do fundo até a cor da categoria; o número exato no toque/hover.
 */
export function GenreHeatmap({ genres, decades, totals }: {
  genres: { g: string; dec: number[] }[]
  decades: number[]
  totals: number[]
}) {
  const share = genres.map((g) => g.dec.map((v, i) => (totals[i] ? v / totals[i] : 0)))
  const max = Math.max(0.0001, ...share.flat())
  const cols = decades.map((d) => String(d).slice(2))
  return (
    <div className="alb-heat" style={{ '--cols': decades.length } as CSSProperties} role="table" aria-label={t('Gêneros por década: fatia dos álbuns de cada década')}>
      <div className="alb-heat__row alb-heat__head" role="row">
        <span role="columnheader" className="alb-heat__name">{t('Gênero')}</span>
        {decades.map((d, i) => (
          <span key={d} role="columnheader" className="alb-heat__col" title={decadeLabel(d)}>{cols[i]}</span>
        ))}
      </div>
      {genres.map((g, r) => (
        <div key={g.g} className="alb-heat__row" role="row">
          <Link role="rowheader" to={genrePath(g.g)} className="alb-heat__name alb-link">{g.g}</Link>
          {share[r].map((s, i) => {
            const pct = formatNumber(s, { style: 'percent', maximumFractionDigits: 1 })
            return (
              <span
                key={decades[i]}
                role="cell"
                className="alb-heat__cell"
                title={`${g.g} · ${decadeLabel(decades[i])}: ${pct}`}
                aria-label={`${decadeLabel(decades[i])}: ${pct}`}
                style={{ background: s ? `color-mix(in srgb, var(--cat-album) ${Math.round(12 + (s / max) * 88)}%, var(--surface))` : 'var(--fill)' }}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** Carreira do artista: cada álbum é um ponto (ano × nota de referência). */
export function CareerPlot({ points, label }: { points: { x: number; y: number; title: string; id: string }[]; label: string }) {
  if (points.length < 2) return null
  const W = 320
  const H = 140
  const pad = { l: 30, r: 10, t: 10, b: 22 }
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const x0 = Math.min(...xs) - 1
  const x1 = Math.max(...xs) + 1
  const y0 = Math.max(0, Math.floor((Math.min(...ys) - 0.15) * 4) / 4)
  const y1 = Math.min(5, Math.ceil((Math.max(...ys) + 0.15) * 4) / 4)
  const sx = (x: number) => pad.l + ((x - x0) / (x1 - x0)) * (W - pad.l - pad.r)
  const sy = (y: number) => pad.t + (1 - (y - y0) / Math.max(0.01, y1 - y0)) * (H - pad.t - pad.b)
  const ticks = [y0, (y0 + y1) / 2, y1]
  const sorted = [...points].sort((a, b) => a.x - b.x)
  return (
    <figure className="alb-career" aria-label={label}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(v)} y2={sy(v)} className="alb-career__grid" />
            <text x={pad.l - 6} y={sy(v) + 4} textAnchor="end" className="alb-career__tick">{formatRating(v)}</text>
          </g>
        ))}
        <text x={pad.l} y={H - 4} className="alb-career__tick">{Math.round(x0 + 1)}</text>
        <text x={W - pad.r} y={H - 4} textAnchor="end" className="alb-career__tick">{Math.round(x1 - 1)}</text>
        <polyline points={sorted.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')} className="alb-career__line" />
        {sorted.map((p) => (
          <circle key={p.id} cx={sx(p.x)} cy={sy(p.y)} r={4.5} className="alb-career__dot">
            <title>{p.title}</title>
          </circle>
        ))}
      </svg>
    </figure>
  )
}
