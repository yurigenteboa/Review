import { useNavigate, useParams } from 'react-router-dom'
import { CategoryTag, ReviewCard } from '../components/review/ReviewCard'
import type { ComposeStart } from '../components/review/ComposeSheet'
import { Glass } from '../components/ui/Glass'
import { Stars } from '../components/ui/Stars'
import { useAuth } from '../lib/auth'
import { categoryById, formatRating } from '../lib/categories'
import { initials } from '../lib/format'
import { useDeleteReview, useItem, useItemReviews } from '../lib/queries'
import { isTmdbMovie } from '../lib/movie'
import Filme from './Filme'
import { ErrorState, LoadingCards } from './states'

export default function Item({ onCompose }: { onCompose: (s: ComposeStart) => void }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { userId } = useAuth()
  const item = useItem(id)
  const reviews = useItemReviews(id)
  const del = useDeleteReview()

  if (item.error) return <div className="page"><ErrorState error={item.error} /></div>
  if (!item.data) return <div className="page"><div className="page__body"><LoadingCards count={2} /></div></div>

  const it = item.data
  // Filmes do TMDB ganham a página completa (F1); o resto segue o layout geral.
  if (isTmdbMovie(it)) return <Filme key={it.id} item={it} onCompose={onCompose} />
  const cat = categoryById(it.category)
  const list = reviews.data ?? []
  const avg = list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0
  const mine = list.find((r) => r.user_id === userId)

  const crit = cat.criteria.map((c) => {
    const vals = list.map((r) => r.criteria_scores?.[c]).filter((v): v is number => typeof v === 'number' && v > 0)
    const v = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    return { label: c, value: v, n: vals.length }
  })

  return (
    <div className="page">
      <div
        style={{
          position: 'relative',
          height: 'calc(360px + var(--safe-top))',
          overflow: 'hidden',
          background: `linear-gradient(160deg, color-mix(in srgb, var(--cat-${it.category}) 50%, #000), var(--cat-${it.category}))`,
        }}
      >
        {it.image_url ? (
          <>
            {/* a própria capa, desfocada, vira o fundo colorido para o vidro */}
            <img
              src={it.image_url}
              alt=""
              aria-hidden="true"
              style={{ position: 'absolute', inset: -40, width: 'calc(100% + 80px)', height: 'calc(100% + 80px)', objectFit: 'cover', filter: 'blur(40px) saturate(160%)', opacity: 0.9 }}
            />
            <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(var(--safe-top) + 40px)', display: 'flex', justifyContent: 'center' }}>
              <img
                src={it.image_url}
                alt={`Capa de ${it.title}`}
                style={{
                  height: it.category === 'album' ? 170 : 200,
                  width: it.category === 'album' ? 170 : 'auto',
                  objectFit: 'cover',
                  borderRadius: it.category === 'album' ? 12 : 14,
                  boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
                }}
              />
            </div>
          </>
        ) : (
          <span aria-hidden="true" style={{ position: 'absolute', left: 24, bottom: 120, fontSize: 96, fontWeight: 800, color: 'rgba(255,255,255,0.9)', letterSpacing: -4 }}>
            {initials(it.title)}
          </span>
        )}
      </div>

      <button
        type="button"
        className="glass glass--pill tap"
        aria-label="Voltar"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
        style={{ position: 'fixed', top: 'calc(var(--safe-top) + 12px)', left: 16, zIndex: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)' }}
      >
        <svg width="12" height="20" viewBox="0 0 12 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 2L2 10l8 8" />
        </svg>
      </button>

      <Glass style={{ margin: '-110px 16px 0', position: 'relative', padding: 20 }}>
        <CategoryTag category={it.category} />
        <h1 style={{ margin: '8px 0 2px', fontSize: 28, fontWeight: 800, letterSpacing: -0.6, lineHeight: 1.1 }}>{it.title}</h1>
        {it.subtitle && <p style={{ margin: 0, fontSize: 15, color: 'var(--text-2)' }}>{it.subtitle}</p>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>{list.length ? formatRating(avg) : '–'}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Stars value={avg} size={20} />
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
              {list.length === 0 ? 'Sem reviews ainda' : list.length === 1 ? '1 review' : `${list.length} reviews`}
            </span>
          </div>
        </div>

        {list.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
            {crit.map((c) => (
              <div key={c.label} style={{ display: 'grid', gridTemplateColumns: '96px minmax(0, 1fr) 28px', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{c.label}</span>
                <div style={{ height: 8, borderRadius: 4, background: 'var(--fill)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(c.value / 5) * 100}%`, borderRadius: 4, background: `var(--cat-${it.category})` }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{c.n ? formatRating(c.value) : '–'}</span>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          className="btn btn--primary tap"
          style={{ width: '100%', marginTop: 20 }}
          onClick={() => onCompose({ category: it.category, title: it.title, itemId: it.id })}
        >
          {mine ? 'Refazer minha review' : 'Avaliar'}
        </button>
      </Glass>

      <h2 style={{ margin: '24px 20px 10px', fontSize: 22, letterSpacing: -0.4 }}>Reviews</h2>
      <div className="page__body" style={{ paddingTop: 0 }}>
        {reviews.isLoading && <LoadingCards count={1} />}
        {list.map((r) => (
          <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <ReviewCard review={r} showItem={false} />
            {r.user_id === userId && (
              <button
                type="button"
                className="tap"
                disabled={del.isPending}
                onClick={() => {
                  if (window.confirm('Apagar a sua review? Isso não pode ser desfeito.')) del.mutate(r)
                }}
                style={{ alignSelf: 'flex-end', border: 'none', background: 'none', color: 'var(--cat-filme-ink)', fontSize: 14, fontWeight: 600, minHeight: 36 }}
              >
                Apagar minha review
              </button>
            )}
          </div>
        ))}
        {!reviews.isLoading && list.length === 0 && (
          <p style={{ margin: 0, padding: 20, textAlign: 'center', background: 'var(--surface)', borderRadius: 'var(--r-lg)', color: 'var(--text-3)' }}>
            Ninguém avaliou ainda. Seja o primeiro.
          </p>
        )}
      </div>
    </div>
  )
}
