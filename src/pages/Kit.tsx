import { useState } from 'react'
import { RatingInput } from '../components/review/RatingInput'
import { ReviewCard } from '../components/review/ReviewCard'
import { CategoryChips } from '../components/ui/Chips'
import { Glass } from '../components/ui/Glass'
import { PageHeader } from '../components/ui/PageHeader'
import { Sheet } from '../components/ui/Sheet'
import { Stars } from '../components/ui/Stars'
import { CATEGORIES, type CategoryId } from '../lib/categories'
import type { Review } from '../lib/types'

import { t } from '../lib/i18n'
// Dado fixo só para a vitrine; não vem do banco.
const DEMO: Review = {
  id: 'demo',
  user_id: 'demo',
  rating: 4.5,
  body: t('Exemplo de review para conferir o visual do card.'),
  criteria_scores: {},
  visibility: 'amigos',
  created_at: new Date().toISOString(),
  experienced_at: new Date().toISOString().slice(0, 10),
  rewatch: false,
  loved: true,
  spoiler: false,
  watched_where: null,
  item: { id: 'demo', category: 'album', title: t('Álbum de exemplo'), subtitle: t('Artista · 2026'), image_url: null, year: 2026 },
  author: { id: 'demo-author', username: 'exemplo', display_name: t('Pessoa Exemplo'), avatar_url: null },
  photos: [],
}

/** Vitrine dos componentes, para testar cada um isolado. */
export default function Kit() {
  const [cat, setCat] = useState<CategoryId | 'all'>('all')
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(3.5)

  const h2 = { margin: '8px 4px 0', fontSize: '0.9375rem', color: 'var(--text-3)' }

  return (
    <div className="page">
      <PageHeader title={t('Kit')} subtitle={t('Componentes do design system')} />
      <div className="page__body">
        <h2 style={h2}>{t('Vidro sobre cor')}</h2>
        <div style={{ borderRadius: 'var(--r-lg)', padding: 24, background: 'linear-gradient(135deg, #4B2380, #FF6B4A 60%, #FFB340)' }}>
          <Glass style={{ padding: 20 }}>
            <strong>Glass variant="card"</strong>
            <p style={{ margin: '6px 0 0', fontSize: '0.9375rem' }}>{t('Blur 24 px, saturate 180%, borda hairline.')}</p>
          </Glass>
        </div>

        <h2 style={h2}>{t('Chips')}</h2>
        <CategoryChips value={cat} onChange={setCat} />

        <h2 style={h2}>{t('Estrelas')}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Stars value={5} size={20} />
          <Stars value={3.5} size={20} />
          <Stars value={1} size={20} />
        </div>

        <h2 style={h2}>{t('Seletor de nota')}</h2>
        <RatingInput value={rating} onChange={setRating} />

        <h2 style={h2}>{t('Cores das categorias')}</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {CATEGORIES.map((c) => (
            <span key={c.id} className="cat-tag" style={{ color: `var(--cat-${c.id}-ink)`, background: `color-mix(in srgb, var(--cat-${c.id}) 14%, transparent)` }}>
              {c.label}
            </span>
          ))}
        </div>

        <h2 style={h2}>{t('Card de review')}</h2>
        <ReviewCard review={DEMO} />

        <h2 style={h2}>{t('Botões e sheet')}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn--primary tap" onClick={() => setOpen(true)}>
            {t('Abrir sheet')}
          </button>
          <button type="button" className="btn btn--plain tap">
            {t('Secundário')}
          </button>
        </div>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title={t('Sheet de exemplo')}>
        <p style={{ fontSize: '0.9375rem', color: 'var(--text-2)' }}>{t('Arraste o pegador para baixo ou toque fora para fechar.')}</p>
      </Sheet>
    </div>
  )
}
