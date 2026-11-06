import { useEffect, useRef, type CSSProperties } from 'react'
import { formatRating } from '../../lib/categories'
import { heatLevel, heatmapWeeks } from '../../lib/profileStats'
import type { Review } from '../../lib/types'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** Mapa de calor dos últimos 12 meses (uma célula por dia). Rola para a direita sozinho: hoje fica visível. */
export function YearHeatmap({ entries, color }: { entries: Review[]; color: string }) {
  const weeks = heatmapWeeks(entries)
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [])

  const days = weeks.flat().filter((c) => !c.future)
  const total = days.reduce((s, c) => s + c.count, 0)
  const active = days.filter((c) => c.count > 0).length

  return (
    <figure className="heatmap" style={{ '--heat': color } as CSSProperties}>
      <figcaption className="profile-section__hint">
        {total === 0
          ? 'Nenhum registro nos últimos 12 meses.'
          : `${total} ${total === 1 ? 'registro' : 'registros'} em ${active} ${active === 1 ? 'dia' : 'dias'} nos últimos 12 meses`}
      </figcaption>
      <div className="heatmap__scroll no-scrollbar" ref={scroller}>
        <div className="heatmap__months" aria-hidden="true">
          {weeks.map((w, i) => {
            const first = w.find((c) => c.day.endsWith('-01'))
            return <span key={i}>{first ? MONTHS[Number(first.day.slice(5, 7)) - 1] : ''}</span>
          })}
        </div>
        <div className="heatmap__grid" aria-hidden="true">
          {weeks.map((w, i) => (
            <div key={i} className="heatmap__week">
              {w.map((c) => (
                <span
                  key={c.day}
                  className="heatmap__cell"
                  data-level={c.future ? 'future' : heatLevel(c.count)}
                  title={c.future ? undefined : `${c.day.split('-').reverse().join('/')}: ${c.count}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </figure>
  )
}

/** Distribuição das notas de 0,5 a 5 (como no Letterboxd/RYM). */
export function RatingBars({ bins, color, average }: { bins: number[]; color: string; average: number | null }) {
  const max = Math.max(1, ...bins)
  const total = bins.reduce((s, n) => s + n, 0)
  if (!total) return <p className="profile-section__hint">Ainda sem notas aqui.</p>
  const label = bins
    .map((n, i) => (n ? `${formatRating((i + 1) / 2)}: ${n}` : null))
    .filter(Boolean)
    .join(', ')
  return (
    <figure className="rating-bars" style={{ '--bar': color } as CSSProperties}>
      <div className="rating-bars__plot" role="img" aria-label={`Distribuição de ${total} notas. ${label}.`}>
        {bins.map((n, i) => (
          <span key={i} className="rating-bars__col">
            <span className="rating-bars__count" aria-hidden="true">{n || ''}</span>
            <span className="rating-bars__bar" style={{ height: `${Math.max(n ? 6 : 2, (n / max) * 100)}%` }} />
          </span>
        ))}
      </div>
      <div className="rating-bars__axis" aria-hidden="true">
        <span>½</span>
        <span>★★★★★</span>
      </div>
      <figcaption className="profile-section__hint">
        {total} {total === 1 ? 'nota' : 'notas'}
        {average != null && ` · média ${formatRating(average)}`}
      </figcaption>
    </figure>
  )
}
