import { useState } from 'react'
import { Cover } from '../components/review/ReviewCard'
import { CategoryChips } from '../components/ui/Chips'
import { SearchIcon } from '../components/ui/Icons'
import { PageHeader } from '../components/ui/PageHeader'
import { categoryById, type CategoryId } from '../lib/categories'
import { ITEMS } from '../lib/sample'

export default function Buscar() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<CategoryId | 'all'>('all')
  const term = q.trim().toLowerCase()
  const results = ITEMS.filter(
    (i) =>
      (cat === 'all' || i.category === cat) &&
      (!term || `${i.title} ${i.subtitle}`.toLowerCase().includes(term)),
  )

  return (
    <div className="page">
      <PageHeader title="Buscar">
        <label className="search-field">
          <span style={{ color: 'var(--text-3)', display: 'flex' }}>
            <SearchIcon size={18} />
          </span>
          <span className="visually-hidden">Buscar álbuns, filmes e lugares</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Álbuns, filmes, bares, banheiros…"
          />
        </label>
        <div style={{ marginTop: 12 }}>
          <CategoryChips value={cat} onChange={setCat} />
        </div>
      </PageHeader>

      <div className="page__body">
        <div className="group">
          {results.map((i) => (
            <div key={i.id} className="group__row">
              <Cover item={i} size={44} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <strong style={{ fontWeight: 600, fontSize: 16 }}>{i.title}</strong>
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
                  {categoryById(i.category).label} · {i.subtitle}
                </span>
              </div>
            </div>
          ))}
          {term && (
            <div className="group__row" style={{ color: 'var(--accent-ink)', fontWeight: 600 }}>
              Criar “{q.trim()}” manualmente (Fase 2)
            </div>
          )}
        </div>
        <p style={{ margin: '0 4px', fontSize: 12, color: 'var(--text-3)' }}>
          Na Fase 3, a busca consulta TMDB, MusicBrainz, IGDB, Google Places e OpenStreetMap.
        </p>
      </div>
    </div>
  )
}
