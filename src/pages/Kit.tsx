import { useState } from 'react'
import { ReviewCard } from '../components/review/ReviewCard'
import { CategoryChips } from '../components/ui/Chips'
import { Glass } from '../components/ui/Glass'
import { PageHeader } from '../components/ui/PageHeader'
import { Sheet } from '../components/ui/Sheet'
import { Stars } from '../components/ui/Stars'
import { CATEGORIES, type CategoryId } from '../lib/categories'
import { REVIEWS, itemById } from '../lib/sample'

/** Vitrine dos componentes, para testar cada um isolado (Fase 1, passo 2). */
export default function Kit() {
  const [cat, setCat] = useState<CategoryId | 'all'>('all')
  const [open, setOpen] = useState(false)

  return (
    <div className="page">
      <PageHeader title="Kit" subtitle="Componentes do design system" />
      <div className="page__body">
        <h2 style={{ margin: '8px 4px 0', fontSize: 15, color: 'var(--text-3)' }}>Vidro sobre cor</h2>
        <div
          style={{
            borderRadius: 'var(--r-lg)',
            padding: 24,
            background: 'linear-gradient(135deg, #4B2380, #FF6B4A 60%, #FFB340)',
          }}
        >
          <Glass style={{ padding: 20 }}>
            <strong>Glass variant="card"</strong>
            <p style={{ margin: '6px 0 0', fontSize: 15 }}>Blur 24 px, saturate 180%, borda hairline.</p>
          </Glass>
        </div>

        <h2 style={{ margin: '8px 4px 0', fontSize: 15, color: 'var(--text-3)' }}>Chips</h2>
        <CategoryChips value={cat} onChange={setCat} />

        <h2 style={{ margin: '8px 4px 0', fontSize: 15, color: 'var(--text-3)' }}>Estrelas</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Stars value={5} size={20} />
          <Stars value={3.5} size={20} />
          <Stars value={1} size={20} />
        </div>

        <h2 style={{ margin: '8px 4px 0', fontSize: 15, color: 'var(--text-3)' }}>Cores das categorias</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {CATEGORIES.map((c) => (
            <span
              key={c.id}
              className="cat-tag"
              style={{ color: `var(--cat-${c.id}-ink)`, background: `color-mix(in srgb, var(--cat-${c.id}) 14%, transparent)` }}
            >
              {c.label}
            </span>
          ))}
        </div>

        <h2 style={{ margin: '8px 4px 0', fontSize: 15, color: 'var(--text-3)' }}>Card de review</h2>
        <ReviewCard review={REVIEWS[0]} item={itemById(REVIEWS[0].itemId)} />

        <h2 style={{ margin: '8px 4px 0', fontSize: 15, color: 'var(--text-3)' }}>Botões e sheet</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn--primary tap" onClick={() => setOpen(true)}>
            Abrir sheet
          </button>
          <button type="button" className="btn btn--plain tap">Secundário</button>
        </div>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Sheet de exemplo">
        <p style={{ fontSize: 15, color: 'var(--text-2)' }}>Arraste para baixo ou toque fora para fechar.</p>
      </Sheet>
    </div>
  )
}
