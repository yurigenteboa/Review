// Diário (lista por mês) e "Quero ver" (grade com filtro de streaming), usados no seu perfil e no de amigos.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMyServices, useWatchlist } from '../../lib/diary'
import type { Review } from '../../lib/types'
import { Cover, EntryLine } from './ReviewCard'

const monthLabel = (iso: string) => {
  const [y, m] = iso.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

/** Diário agrupado por mês: dia, capa, título e a linha da entrada. */
export function DiaryList({ entries, empty }: { entries: Review[]; empty: string }) {
  if (!entries.length) return <p className="empty-note">{empty}</p>
  const groups = new Map<string, Review[]>()
  for (const r of entries) {
    const key = r.experienced_at.slice(0, 7)
    groups.set(key, [...(groups.get(key) ?? []), r])
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {[...groups.entries()].map(([key, list]) => (
        <section key={key} aria-label={monthLabel(key)}>
          <h3 className="diary-month">{monthLabel(key)}</h3>
          <ul className="group" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {list.map((r) => (
              <li key={r.id}>
                <Link to={`/item/${r.item.id}`} className="group__row tap diary-row">
                  <span className="diary-row__day" aria-hidden="true">
                    {Number(r.experienced_at.slice(8, 10))}
                  </span>
                  <Cover item={r.item} size={44} radius={8} />
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                    <strong className="diary-row__title">{r.item.title}</strong>
                    <EntryLine review={r} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** "Quero ver" de uma pessoa. O filtro usa os streamings que VOCÊ assina. */
export function WatchlistGrid({ userId, empty }: { userId: string; empty: string }) {
  const list = useWatchlist(userId)
  const services = useMyServices()
  const [onlyMine, setOnlyMine] = useState(false)
  const mineIds = new Set((services.data ?? []).map((s) => s.provider_id))
  const rows = list.data ?? []

  // só filmes com a ficha do TMDB já guardada sabem onde estão passando
  const available = (r: (typeof rows)[number]) => (r.item.providers?.flatrate ?? []).some((p) => mineIds.has(p.id))
  const unknown = rows.filter((r) => r.item.source === 'tmdb-movie' && !r.item.providers).length
  const shown = onlyMine ? rows.filter(available) : rows

  if (list.isLoading) return <p className="empty-note">Carregando…</p>
  if (!rows.length) return <p className="empty-note">{empty}</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {mineIds.size > 0 && (
        <div className="chips no-scrollbar" role="group" aria-label="Filtrar quero ver" style={{ margin: 0, padding: 0 }}>
          <button type="button" className="chip tap" aria-pressed={!onlyMine} onClick={() => setOnlyMine(false)} style={{ minHeight: 44 }}>
            Tudo ({rows.length})
          </button>
          <button type="button" className="chip tap" aria-pressed={onlyMine} onClick={() => setOnlyMine(true)} style={{ minHeight: 44 }}>
            No que eu assino ({rows.filter(available).length})
          </button>
        </div>
      )}
      {mineIds.size === 0 && (
        <p className="field-hint" style={{ margin: 0 }}>
          Dica: na página de um filme, em “Onde assistir”, toque em “Meus streamings” para filtrar esta lista pelo que você assina.
        </p>
      )}
      {onlyMine && shown.length === 0 && <p className="empty-note">Nada desta lista está nos seus streamings agora.</p>}
      <ul className="watch-grid" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {shown.map((r) => (
          <li key={r.item_id}>
            <Link to={`/item/${r.item.id}`} className="tap watch-card" aria-label={r.item.title}>
              <Cover item={r.item} fill radius={12} />
              <span className="watch-card__title">{r.item.title}</span>
              {available(r) && <span className="watch-card__badge">no seu streaming</span>}
            </Link>
          </li>
        ))}
      </ul>
      {onlyMine && unknown > 0 && (
        <p className="field-hint" style={{ margin: 0 }}>
          {unknown} {unknown === 1 ? 'filme ainda não tem' : 'filmes ainda não têm'} dados de streaming: abra a página deles uma vez para atualizar.
        </p>
      )}
    </div>
  )
}
