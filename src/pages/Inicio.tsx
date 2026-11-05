import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ReviewCard } from '../components/review/ReviewCard'
import { CategoryChips } from '../components/ui/Chips'
import { PageHeader } from '../components/ui/PageHeader'
import type { CategoryId } from '../lib/categories'
import { REVIEWS, itemById } from '../lib/sample'

export default function Inicio() {
  const [cat, setCat] = useState<CategoryId | 'all'>('all')
  const feed = REVIEWS.filter((r) => cat === 'all' || itemById(r.itemId).category === cat)

  return (
    <div className="page">
      <PageHeader
        title="Início"
        subtitle="O que seus amigos andam avaliando"
        trailing={
          <Link
            to="/perfil"
            className="avatar tap"
            aria-label="Abrir seu perfil"
            style={{ width: 40, height: 40, fontSize: 14, background: 'linear-gradient(135deg, #1C1C1E, #48484A)', textDecoration: 'none' }}
          >
            YS
          </Link>
        }
      >
        <CategoryChips value={cat} onChange={setCat} />
      </PageHeader>

      <div className="page__body">
        {feed.map((r) => (
          <ReviewCard key={r.id} review={r} item={itemById(r.itemId)} />
        ))}
        {feed.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-3)', padding: '40px 0' }}>
            Nenhuma review nessa categoria ainda.
          </p>
        )}
      </div>
    </div>
  )
}
