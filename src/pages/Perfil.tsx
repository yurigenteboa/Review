import { Link } from 'react-router-dom'
import { Cover } from '../components/review/ReviewCard'
import { Glass } from '../components/ui/Glass'
import { formatRating } from '../lib/categories'
import { REVIEWS, itemById } from '../lib/sample'

export default function Perfil() {
  const mine = REVIEWS.filter((r) => r.author === 'Você')
  const cats = new Set(mine.map((r) => itemById(r.itemId).category)).size
  const avg = mine.length ? mine.reduce((s, r) => s + r.rating, 0) / mine.length : 0

  const stats = [
    { value: String(mine.length), label: 'reviews' },
    { value: String(cats), label: 'categorias' },
    { value: mine.length ? formatRating(avg) : '–', label: 'nota média' },
  ]

  return (
    <div className="page">
      {/* Fundo colorido: o vidro precisa de cor atrás para aparecer */}
      <div
        aria-hidden="true"
        style={{
          height: 'calc(230px + var(--safe-top))',
          background: 'linear-gradient(135deg, #6E3AA8, #FF6B4A 55%, #FFB340)',
        }}
      />
      <Glass style={{ margin: '-120px 16px 0', position: 'relative', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            className="avatar"
            style={{ width: 68, height: 68, fontSize: 24, background: 'linear-gradient(135deg, #1C1C1E, #48484A)', border: '3px solid #fff' }}
          >
            YS
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <strong style={{ fontSize: 22, letterSpacing: -0.4 }}>Yuri Soares</strong>
            <span style={{ fontSize: 15, color: 'var(--text-2)' }}>@yuri · São Paulo</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 18 }}>
          {stats.map((s) => (
            <div
              key={s.label}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', borderRadius: 16, background: 'var(--glass-bg)' }}
            >
              <strong style={{ fontSize: 22 }}>{s.value}</strong>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </Glass>

      <h2 style={{ margin: '24px 20px 10px', fontSize: 22, letterSpacing: -0.4 }}>Suas reviews</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, padding: '0 16px' }}>
        {mine.map((r) => (
          <div key={r.id} style={{ position: 'relative' }}>
            <Cover item={itemById(r.itemId)} size={110} />
            <span
              className="glass glass--pill"
              style={{ position: 'absolute', left: 8, bottom: 8, padding: '3px 8px', fontSize: 12, fontWeight: 700, boxShadow: 'none' }}
            >
              ★ {formatRating(r.rating)}
            </span>
          </div>
        ))}
      </div>

      <p style={{ margin: '24px 20px 0', fontSize: 13, color: 'var(--text-3)' }}>
        Veja todos os componentes em <Link to="/kit">/kit</Link>.
      </p>
    </div>
  )
}
