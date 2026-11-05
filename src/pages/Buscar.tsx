import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Cover } from '../components/review/ReviewCard'
import { CategoryChips } from '../components/ui/Chips'
import { SearchIcon } from '../components/ui/Icons'
import { PageHeader } from '../components/ui/PageHeader'
import { categoryById, type CategoryId } from '../lib/categories'
import { useSearchItems } from '../lib/queries'
import type { ComposeStart } from '../components/review/ComposeSheet'

export default function Buscar({ onCompose }: { onCompose: (s: ComposeStart) => void }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<CategoryId | 'all'>('all')
  const results = useSearchItems(q, cat)
  const term = q.trim()

  return (
    <div className="page">
      <PageHeader title="Buscar">
        <label className="search-field">
          <span style={{ color: 'var(--text-3)', display: 'flex' }}>
            <SearchIcon size={18} />
          </span>
          <span className="visually-hidden">Buscar no catálogo</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Álbuns, filmes, bares, banheiros…" />
        </label>
        <div style={{ marginTop: 12 }}>
          <CategoryChips value={cat} onChange={setCat} />
        </div>
      </PageHeader>

      <div className="page__body">
        <div className="group">
          {results.data?.map((i) => (
            <Link key={i.id} to={`/item/${i.id}`} className="group__row tap" style={{ textDecoration: 'none', color: 'inherit' }}>
              <Cover item={i} size={44} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <strong style={{ fontWeight: 600, fontSize: 16 }}>{i.title}</strong>
                <span style={{ fontSize: 13, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {categoryById(i.category).label}
                  {i.subtitle ? ` · ${i.subtitle}` : ''}
                </span>
              </div>
            </Link>
          ))}
          {results.isLoading && <div className="group__row" style={{ color: 'var(--text-3)' }}>Buscando…</div>}
          {results.data?.length === 0 && !term && (
            <div className="group__row" style={{ color: 'var(--text-3)' }}>O catálogo ainda está vazio.</div>
          )}
          {term && (
            <button
              type="button"
              className="group__row tap"
              onClick={() => onCompose({ title: term, category: cat === 'all' ? undefined : cat })}
              style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', color: 'var(--accent-ink)', fontWeight: 600 }}
            >
              Avaliar “{term}” (criar manualmente)
            </button>
          )}
        </div>
        <p style={{ margin: '0 4px', fontSize: 12, color: 'var(--text-3)' }}>
          Por enquanto a busca mostra o que já foi cadastrado no Review. Na Fase 3 ela passa a consultar TMDB, MusicBrainz, IGDB e mapas.
        </p>
      </div>
    </div>
  )
}
