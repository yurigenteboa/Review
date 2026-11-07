import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CategoryTag, ReviewCard } from '../components/review/ReviewCard'
import type { ComposeStart } from '../components/review/ComposeSheet'
import { Glass } from '../components/ui/Glass'
import { Stars } from '../components/ui/Stars'
import { useAuth } from '../lib/auth'
import { catColor, categoryById, childCategories, formatRating } from '../lib/categories'
import { initials } from '../lib/format'
import { averageRating, latestPerPerson, sortDiary, useChildItems, useDeleteReview, useItem, useItemRedirect, useItemReviews } from '../lib/queries'
import { DID_VERB, WANT_VERB, useItemWatchers, useToggleWatchlist } from '../lib/diary'
import { isTmdbMovie } from '../lib/movie'
import Filme from './Filme'
import { EmptyState, ErrorState, LoadingCards } from './states'

export default function Item({ onCompose }: { onCompose: (s: ComposeStart) => void }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { userId } = useAuth()
  const item = useItem(id)
  const reviews = useItemReviews(id)
  const del = useDeleteReview()
  const watchers = useItemWatchers(id)
  const want = useToggleWatchlist()
  const iWant = (watchers.data ?? []).some((w) => w.user_id === userId)
  // Fase 1: item fundido em outro (duplicado) -> abre o certo, sem empilhar o link velho no histórico
  const missing = item.isSuccess && !item.data
  const redirect = useItemRedirect(id, missing)
  useEffect(() => {
    if (redirect.data) navigate(`/item/${redirect.data}`, { replace: true })
  }, [redirect.data, navigate])

  if (item.error) return <div className="page"><ErrorState error={item.error} onRetry={() => void item.refetch()} /></div>
  if (missing && (redirect.isLoading || redirect.data)) return <div className="page"><div className="page__body"><LoadingCards count={2} /></div></div>
  if (missing)
    return (
      <div className="page">
        <EmptyState
          title="Esse item não existe mais"
          text="O link pode ser antigo ou o item foi apagado."
          action={{ label: 'Ir para a busca', onClick: () => navigate('/buscar') }}
        />
      </div>
    )
  if (!item.data) return <div className="page"><div className="page__body"><LoadingCards count={2} /></div></div>

  const it = item.data
  // Filmes do TMDB ganham a página completa (F1); o resto segue o layout geral.
  if (isTmdbMovie(it)) return <Filme key={it.id} item={it} onCompose={onCompose} />
  const cat = categoryById(it.category)
  // diário: várias entradas por pessoa; média e critérios usam a mais recente de cada um
  const list = sortDiary(reviews.data ?? [])
  const latest = latestPerPerson(list)
  const { avg, n: rated } = averageRating(list)
  const mine = list.find((r) => r.user_id === userId)
  const verb = DID_VERB[it.category]

  const crit = cat.criteria.map((c) => {
    const vals = latest.map((r) => r.criteria_scores?.[c]).filter((v): v is number => typeof v === 'number' && v > 0)
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
        {it.parent_id && (
          <Link to={`/item/${it.parent_id}`} className="link-btn tap" style={{ display: 'inline-flex', minHeight: 36, alignItems: 'center', fontSize: 15 }}>
            no {it.parent_title ?? 'lugar'} ›
          </Link>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>{rated ? formatRating(avg) : '–'}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Stars value={avg} size={20} />
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
              {rated === 0 ? 'Sem notas ainda' : rated === 1 ? '1 nota' : `${rated} notas`}
              {list.length > rated ? ` · ${list.length} ${list.length === 1 ? 'registro' : 'registros'}` : ''}
            </span>
          </div>
        </div>

        {crit.some((c) => c.n > 0) && (
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

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button
            type="button"
            className="btn btn--primary tap"
            style={{ flex: 1 }}
            onClick={() => onCompose({ category: it.category, title: it.title, itemId: it.id })}
          >
            {mine ? `${verb} de novo` : `${verb} · registrar`}
          </button>
          <button
            type="button"
            className="btn btn--plain tap"
            aria-pressed={iWant}
            disabled={want.isPending}
            onClick={() => want.mutate({ itemId: it.id, on: !iWant })}
            style={iWant ? { background: 'color-mix(in srgb, var(--accent) 16%, var(--fill))', color: 'var(--accent-ink)' } : undefined}
          >
            {iWant ? '✓ Na lista' : `Quero ${WANT_VERB[it.category]}`}
          </button>
        </div>
      </Glass>

      {childCategories(it.category).length > 0 && (
        <PlaceMenu placeId={it.id} onCompose={() => onCompose({ category: it.category, title: it.title, itemId: it.id })} />
      )}

      <h2 style={{ margin: '24px 20px 10px', fontSize: 22, letterSpacing: -0.4 }}>Reviews</h2>
      <div className="page__body" style={{ paddingTop: 0 }}>
        {reviews.isLoading && <LoadingCards count={1} />}
        {list.map((r) => (
          <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <ReviewCard review={r} showItem={false} />
            {r.user_id === userId && (
              <span style={{ alignSelf: 'flex-end', display: 'flex', gap: 16 }}>
                <button type="button" className="link-btn" style={{ fontSize: 14 }} onClick={() => onCompose({ edit: r })}>
                  Editar
                </button>
                <button
                  type="button"
                  className="link-btn"
                  disabled={del.isPending}
                  onClick={() => {
                    if (window.confirm('Apagar esta entrada do diário? Isso não pode ser desfeito.')) del.mutate(r)
                  }}
                  style={{ fontSize: 14, color: 'var(--cat-filme-ink)' }}
                >
                  Apagar
                </button>
              </span>
            )}
          </div>
        ))}
        {!reviews.isLoading && list.length === 0 && (
          <p style={{ margin: 0, padding: 20, textAlign: 'center', background: 'var(--surface)', borderRadius: 'var(--r-lg)', color: 'var(--text-3)' }}>
            Ninguém registrou ainda. Seja o primeiro.
          </p>
        )}
      </div>
    </div>
  )
}

/** Fase 1 · "O que pedir aqui": o que mora no lugar, do mais avaliado para o menos. */
function PlaceMenu({ placeId, onCompose }: { placeId: string; onCompose: () => void }) {
  const menu = useChildItems(placeId)
  const list = menu.data ?? []
  return (
    <section aria-labelledby="o-que-pedir">
      <h2 id="o-que-pedir" style={{ margin: '24px 20px 10px', fontSize: 22, letterSpacing: -0.4 }}>O que pedir aqui</h2>
      <div className="page__body" style={{ paddingTop: 0 }}>
        {menu.isLoading && <LoadingCards count={1} />}
        {list.length > 0 && (
          <div className="group">
            {list.map((c) => (
              <Link key={c.id} to={`/item/${c.id}`} className="group__row tap place-menu__row">
                <span aria-hidden="true" style={{ flex: 'none', width: 10, height: 10, borderRadius: 5, background: catColor(c.category) }} />
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <strong style={{ fontWeight: 600 }}>{c.title}</strong>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{categoryById(c.category).label}</span>
                </span>
                <span className="place-menu__meta">
                  <strong>{c.rated ? formatRating(c.avg) : '–'}</strong>
                  {c.entries === 1 ? '1 registro' : `${c.entries} registros`}
                </span>
              </Link>
            ))}
          </div>
        )}
        {!menu.isLoading && list.length === 0 && (
          <EmptyState
            title="Ninguém contou o que pediu aqui"
            text="Registre sua ida e diga o que pediu: drinks, pratos e o banheiro."
            action={{ label: 'Registrar o que pedi', onClick: onCompose }}
          />
        )}
      </div>
    </section>
  )
}
