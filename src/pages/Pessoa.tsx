import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { DiaryList, WatchlistGrid } from '../components/review/DiaryViews'
import { Avatar, Cover, ReviewCard } from '../components/review/ReviewCard'
import { smallBtn } from '../components/social/PersonRow'
import { Glass } from '../components/ui/Glass'
import { useAuth } from '../lib/auth'
import { formatRating } from '../lib/categories'
import { displayName } from '../lib/format'
import { useUserReviews } from '../lib/queries'
import { useFriendState, useProfile, useRemoveFriend, useRequestFriend, useRespondFriend, useTasteMatch } from '../lib/social'
import { ErrorState, LoadingCards } from './states'

export default function Pessoa() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { userId } = useAuth()
  const profile = useProfile(id)
  const reviews = useUserReviews(id ?? null)
  const state = useFriendState(id)
  const taste = useTasteMatch(id)
  const request = useRequestFriend()
  const respond = useRespondFriend()
  const remove = useRemoveFriend()
  const [tab, setTab] = useState<'reviews' | 'diario' | 'quero'>('reviews')

  if (id && id === userId) return <Navigate to="/perfil" replace />
  if (profile.error) return <div className="page"><ErrorState error={profile.error} /></div>
  if (!profile.data) return <div className="page"><div className="page__body"><LoadingCards count={2} /></div></div>

  const p = profile.data
  const list = reviews.data ?? []
  const busy = request.isPending || respond.isPending || remove.isPending
  const match = taste.data
  const withText = list.filter((r) => r.body || r.photos.length)

  const action =
    state === 'amigos' ? (
      <button
        type="button"
        className="btn btn--plain tap"
        style={smallBtn}
        disabled={busy}
        onClick={() => {
          if (window.confirm(`Desfazer amizade com ${displayName(p)}? Vocês deixam de ver as reviews "Amigos" um do outro.`)) remove.mutate(p.id)
        }}
      >
        Amigos ✓
      </button>
    ) : state === 'enviado' ? (
      <button type="button" className="btn btn--plain tap" style={smallBtn} disabled={busy} onClick={() => remove.mutate(p.id)}>
        Cancelar pedido
      </button>
    ) : state === 'recebido' ? (
      <button type="button" className="btn btn--primary tap" style={smallBtn} disabled={busy} onClick={() => respond.mutate({ other: p.id, accept: true })}>
        Aceitar amizade
      </button>
    ) : (
      <button type="button" className="btn btn--primary tap" style={smallBtn} disabled={busy} onClick={() => request.mutate(p.id)}>
        Adicionar
      </button>
    )

  return (
    <div className="page">
      <div aria-hidden="true" style={{ height: 'calc(200px + var(--safe-top))', background: 'linear-gradient(135deg, #0A5A54, #0A84FF 55%, #AF52DE)' }} />
      <button
        type="button"
        className="glass glass--pill tap"
        aria-label="Voltar"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/amigos'))}
        style={{ position: 'absolute', top: 'calc(var(--safe-top) + 12px)', left: 16, zIndex: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)' }}
      >
        <svg width="12" height="20" viewBox="0 0 12 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 2L2 10l8 8" />
        </svg>
      </button>

      <Glass style={{ margin: '-110px 16px 0', position: 'relative', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar profile={p} size={64} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
            <strong style={{ fontSize: 22, letterSpacing: -0.4 }}>{displayName(p)}</strong>
            {p.username && <span style={{ fontSize: 15, color: 'var(--text-2)' }}>@{p.username}</span>}
          </div>
          {action}
        </div>
        {state === 'nenhuma' && (
          <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--text-2)' }}>
            Vocês ainda não são amigos: aqui aparecem só as reviews públicas.
          </p>
        )}
      </Glass>

      {match && match.rows.length > 0 && (
        <section style={{ margin: '20px 16px 0' }} aria-label="Comparação de gosto">
          <div className="review-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <strong style={{ fontSize: 34, letterSpacing: -1 }}>{match.score}%</strong>
              <span style={{ fontSize: 15, color: 'var(--text-2)' }}>
                de concordância em {match.rows.length} {match.rows.length === 1 ? 'item' : 'itens'} que vocês dois avaliaram
              </span>
            </div>
            <div className="group" style={{ background: 'var(--fill)' }}>
              {match.rows.slice(0, 6).map((r) => (
                <Link key={r.item_id} to={`/item/${r.item_id}`} className="group__row tap" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <Cover item={{ title: r.title, category: r.category as never, image_url: r.image_url }} size={36} radius={8} />
                  <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                    você {formatRating(r.my_rating)} · {displayName(p).split(' ')[0]} {formatRating(r.their_rating)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <div style={{ padding: '24px 16px 0' }}>
        <div className="segmented" role="tablist" aria-label="Listas" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          {(['reviews', 'diario', 'quero'] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} aria-checked={tab === t} onClick={() => setTab(t)}>
              {t === 'reviews' ? 'Reviews' : t === 'diario' ? 'Diário' : 'Quero ver'}
            </button>
          ))}
        </div>
      </div>
      <div className="page__body">
        {reviews.isLoading && <LoadingCards count={2} />}
        {tab === 'reviews' && (
          <>
            {withText.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
            {!reviews.isLoading && withText.length === 0 && (
              <p className="empty-note">
                {state === 'amigos' ? 'Nenhuma review com texto ainda.' : 'Nenhuma review pública. Adicione como amigo para ver mais.'}
              </p>
            )}
          </>
        )}
        {tab === 'diario' && <DiaryList entries={list} empty={state === 'amigos' ? 'Diário vazio.' : 'Nada público no diário. Adicione como amigo para ver mais.'} />}
        {tab === 'quero' && p && (
          <WatchlistGrid userId={p.id} empty={state === 'amigos' ? 'Lista vazia (ou só com itens privados).' : 'Adicione como amigo para ver o que essa pessoa quer ver.'} />
        )}
      </div>
    </div>
  )
}
