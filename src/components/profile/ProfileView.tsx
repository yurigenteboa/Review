import { useState, type CSSProperties } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { DiaryList, WatchlistGrid } from '../review/DiaryViews'
import { Avatar, Cover, ReviewCard } from '../review/ReviewCard'
import { smallBtn } from '../social/PersonRow'
import { Glass } from '../ui/Glass'
import { signOut } from '../../lib/auth'
import { catColor, categoryById, formatRating, type CategoryId } from '../../lib/categories'
import { useMyServices } from '../../lib/diary'
import { displayName } from '../../lib/format'
import { BIO_MAX, useProfileFull, useSaveProfile, type ProfileFull } from '../../lib/profile'
import {
  byCategory,
  categoriesWithEntries,
  compatHighlights,
  compatScore,
  coverImages,
  ratingHistogram,
  summary,
  tasteLabels,
  topRated,
  type CategoryFilter,
} from '../../lib/profileStats'
import { useUserReviews } from '../../lib/queries'
import { useFriendState, useRemoveFriend, useRequestFriend, useRespondFriend, useTasteMatch } from '../../lib/social'
import type { TasteRow } from '../../lib/types'
import { ErrorState, LoadingCards } from '../../pages/states'
import { RatingBars, YearHeatmap } from './ProfileCharts'
import './profile.css'

type Tab = 'diario' | 'reviews' | 'quero'
const TAB_LABEL: Record<Tab, string> = { diario: 'Diário', reviews: 'Reviews', quero: 'Quero ver' }

const thisYear = String(new Date().getFullYear())

/**
 * Perfil único: o seu (/perfil) e o dos outros (/u/:id) usam a mesma tela.
 * Muda só o que é do dono: editar, sair, streamings. Filtros ficam na URL (?cat= e ?aba=).
 */
export function ProfileView({ userId, isMe }: { userId: string; isMe: boolean }) {
  const navigate = useNavigate()
  const profile = useProfileFull(userId)
  const reviews = useUserReviews(userId)
  const [params, setParams] = useSearchParams()

  const all = reviews.data ?? []
  const cats = categoriesWithEntries(all)
  const catParam = params.get('cat') as CategoryId | null
  const cat: CategoryFilter = catParam && cats.includes(catParam) ? catParam : 'all'
  const tabParam = params.get('aba') as Tab | null
  const tab: Tab = tabParam && tabParam in TAB_LABEL ? tabParam : isMe ? 'diario' : 'reviews'
  const setParam = (key: 'cat' | 'aba', value: string | null) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  if (profile.error) return <div className="page"><ErrorState error={profile.error} /></div>
  if (!profile.data) return <div className="page"><div className="page__body"><LoadingCards count={2} /></div></div>

  const p = profile.data
  const list = byCategory(all, cat)
  const stats = summary(list, thisYear)
  const color = cat === 'all' ? 'var(--accent)' : catColor(cat)
  const labels = tasteLabels(all)
  const covers = coverImages(all)
  const best = topRated(list)
  const withText = list.filter((r) => r.body || r.photos.length)

  return (
    <div className="page profile">
      <ProfileCover images={covers} />
      {!isMe && (
        <button
          type="button"
          className="glass glass--pill tap profile__back"
          aria-label="Voltar"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/amigos'))}
        >
          <svg width="12" height="20" viewBox="0 0 12 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 2L2 10l8 8" />
          </svg>
        </button>
      )}

      <Glass className="profile__card">
        <ProfileHeader profile={p} isMe={isMe} />
        {labels.length > 0 && (
          <ul className="taste-labels" aria-label="Rótulos de gosto">
            {labels.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
        <dl className="profile__stats">
          <div>
            <dt>em {thisYear}</dt>
            <dd>{stats.entriesThisYear}</dd>
          </div>
          <div>
            <dt>{stats.items === 1 ? 'item' : 'itens'}</dt>
            <dd>{stats.items}</dd>
          </div>
          <div>
            <dt>nota média</dt>
            <dd>{stats.average != null ? formatRating(stats.average) : '–'}</dd>
          </div>
        </dl>
      </Glass>

      {cats.length > 1 && (
        <div className="profile__cats">
          <div className="chips no-scrollbar" role="group" aria-label="Ver o perfil por categoria">
            {(['all', ...cats] as CategoryFilter[]).map((c) => (
              <button
                key={c}
                type="button"
                className="chip tap"
                aria-pressed={cat === c}
                onClick={() => setParam('cat', c === 'all' ? null : c)}
              >
                {c === 'all' ? 'Tudo' : categoryById(c).label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="profile__sections">
        {!isMe && <CompatCard otherId={userId} name={displayName(p)} cat={cat} />}

        {best.length > 0 && (
          <section className="profile-section" aria-labelledby="sec-best">
            <h2 id="sec-best" className="profile-section__title">Notas mais altas</h2>
            <div className="best-row">
              {best.map((r) => (
                <Link key={r.id} to={`/item/${r.item.id}`} className="best-row__item tap">
                  <span className="best-row__cover">
                    <Cover item={r.item} fill radius={12} />
                  </span>
                  <span className="best-row__title">{r.item.title}</span>
                  <span className="best-row__note">
                    {r.loved && <span className="best-row__loved" aria-label="curtiu">♥ </span>}
                    {formatRating(r.rating ?? 0)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="profile-section" aria-labelledby="sec-activity">
          <h2 id="sec-activity" className="profile-section__title">Atividade</h2>
          <YearHeatmap entries={list} color={color} />
        </section>

        <section className="profile-section" aria-labelledby="sec-ratings">
          <h2 id="sec-ratings" className="profile-section__title">Notas</h2>
          <RatingBars bins={ratingHistogram(list)} color={color} average={stats.average} />
        </section>

        <div className="segmented" role="tablist" aria-label="Listas" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setParam('aba', t === (isMe ? 'diario' : 'reviews') ? null : t)}>
              {t === 'diario' ? `Diário (${list.length})` : TAB_LABEL[t]}
            </button>
          ))}
        </div>

        {reviews.isLoading && <LoadingCards count={2} />}
        {tab === 'diario' && (
          <DiaryList entries={list} empty={isMe ? 'Seu diário está vazio. Registre o primeiro pelo + da barra.' : 'Nada no diário que você possa ver.'} />
        )}
        {tab === 'reviews' && (
          <div className="profile__reviews">
            {withText.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
            {!reviews.isLoading && withText.length === 0 && (
              <p className="empty-note">{isMe ? 'Nenhuma review com texto ou foto ainda.' : 'Nenhuma review com texto que você possa ver.'}</p>
            )}
          </div>
        )}
        {tab === 'quero' && (
          <>
            <WatchlistGrid
              userId={userId}
              empty={isMe ? 'Nada na lista. Toque no marcador da página de um filme (ou em “Quero …” nos outros itens).' : 'Lista vazia (ou só com itens privados).'}
            />
            {isMe && <MyServicesHint />}
          </>
        )}

        {isMe && (
          <div className="profile__footer">
            <button type="button" className="btn btn--plain tap" onClick={() => signOut()}>
              Sair da conta
            </button>
            <Link to="/kit">Ver componentes do design system</Link>
          </div>
        )}
      </div>
    </div>
  )
}

/** Mosaico desfocado das capas que a pessoa mais curte; sem capas, um degradê. */
function ProfileCover({ images }: { images: string[] }) {
  return (
    <div className="profile__cover" aria-hidden="true">
      {images.length >= 3 ? (
        <div className="profile__mosaic">
          {images.slice(0, 6).map((src) => (
            <span key={src} style={{ backgroundImage: `url("${src.replace(/"/g, '%22')}")` }} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ProfileHeader({ profile: p, isMe }: { profile: ProfileFull; isMe: boolean }) {
  const save = useSaveProfile()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')

  const start = () => {
    setName(p.display_name ?? '')
    setUsername(p.username ?? '')
    setBio(p.bio ?? '')
    setEditing(true)
  }

  if (editing) {
    return (
      <form
        className="profile__edit"
        onSubmit={async (e) => {
          e.preventDefault()
          try {
            await save.mutateAsync({ id: p.id, display_name: name, username, bio })
            setEditing(false)
          } catch {
            /* mensagem abaixo */
          }
        }}
      >
        <label>
          <span className="field-label">Nome</span>
          <input className="field" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          <span className="field-label">@ de usuário</span>
          <input
            className="field"
            value={username}
            maxLength={24}
            autoCapitalize="none"
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
            placeholder="yuri"
          />
        </label>
        <label>
          <span className="field-label">Bio</span>
          <textarea
            className="field profile__bio-input"
            value={bio}
            maxLength={BIO_MAX}
            rows={3}
            onChange={(e) => setBio(e.target.value)}
            placeholder="O que você gosta, o que está procurando, onde mais te achar…"
          />
          <span className="field-hint" style={{ textAlign: 'right' }}>
            {bio.length}/{BIO_MAX}
          </span>
        </label>
        {save.error && (
          <span role="alert" style={{ color: 'var(--cat-filme-ink)', fontSize: 14 }}>
            {(save.error as Error).message}
          </span>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--primary tap" disabled={save.isPending} style={{ flex: 1 }}>
            Salvar
          </button>
          <button type="button" className="btn btn--plain tap" onClick={() => setEditing(false)}>
            Cancelar
          </button>
        </div>
      </form>
    )
  }

  return (
    <>
      <div className="profile__identity">
        <Avatar profile={p} size={76} />
        <div className="profile__names">
          <h1>{displayName(p)}</h1>
          <span>{p.username ? `@${p.username}` : isMe ? 'sem @ ainda' : ''}</span>
        </div>
        {isMe ? (
          <button type="button" className="btn btn--plain tap" style={smallBtn} onClick={start}>
            Editar
          </button>
        ) : (
          <FriendAction id={p.id} name={displayName(p)} />
        )}
      </div>
      {p.bio ? (
        <p className="profile__bio">{p.bio}</p>
      ) : (
        isMe && (
          <button type="button" className="link-btn" onClick={start}>
            + Escrever uma bio
          </button>
        )
      )}
    </>
  )
}

function FriendAction({ id, name }: { id: string; name: string }) {
  const state = useFriendState(id)
  const request = useRequestFriend()
  const respond = useRespondFriend()
  const remove = useRemoveFriend()
  const busy = request.isPending || respond.isPending || remove.isPending

  if (state === 'amigos')
    return (
      <button
        type="button"
        className="btn btn--plain tap"
        style={smallBtn}
        disabled={busy}
        onClick={() => {
          if (window.confirm(`Desfazer amizade com ${name}? Vocês deixam de ver as reviews "Amigos" um do outro.`)) remove.mutate(id)
        }}
      >
        Amigos ✓
      </button>
    )
  if (state === 'enviado')
    return (
      <button type="button" className="btn btn--plain tap" style={smallBtn} disabled={busy} onClick={() => remove.mutate(id)}>
        Cancelar pedido
      </button>
    )
  if (state === 'recebido')
    return (
      <button type="button" className="btn btn--primary tap" style={smallBtn} disabled={busy} onClick={() => respond.mutate({ other: id, accept: true })}>
        Aceitar
      </button>
    )
  return (
    <button type="button" className="btn btn--primary tap" style={smallBtn} disabled={busy} onClick={() => request.mutate(id)}>
      Adicionar
    </button>
  )
}

/** Compatibilidade em destaque: placar, o que os dois amam e onde mais discordam. */
function CompatCard({ otherId, name, cat }: { otherId: string; name: string; cat: CategoryFilter }) {
  const taste = useTasteMatch(otherId)
  const state = useFriendState(otherId)
  const rows = (taste.data?.rows ?? []).filter((r) => cat === 'all' || r.category === cat)
  const first = name.split(' ')[0]

  if (!rows.length) {
    if (state === 'nenhuma')
      return <p className="profile-section__hint profile__notice">Vocês ainda não são amigos: aqui aparecem só as reviews públicas.</p>
    return null
  }

  const score = compatScore(rows) ?? 0
  const { bothLove, clashes } = compatHighlights(rows)
  return (
    <section className="profile-section compat" aria-labelledby="sec-compat" style={{ '--score': `${score}%` } as CSSProperties}>
      <div className="compat__head">
        <span className="compat__ring" aria-hidden="true">
          <span>{score}%</span>
        </span>
        <div>
          <h2 id="sec-compat" className="profile-section__title" style={{ margin: 0 }}>
            Compatibilidade
          </h2>
          <p className="profile-section__hint" style={{ margin: '2px 0 0' }}>
            {score}% de concordância em {rows.length} {rows.length === 1 ? 'item' : 'itens'} que vocês dois avaliaram
          </p>
        </div>
      </div>
      {bothLove.length > 0 && <CompatRow title="Vocês dois amam" rows={bothLove.slice(0, 4)} first={first} />}
      {clashes.length > 0 && <CompatRow title="Onde mais discordam" rows={clashes.slice(0, 2)} first={first} />}
    </section>
  )
}

function CompatRow({ title, rows, first }: { title: string; rows: TasteRow[]; first: string }) {
  return (
    <div className="compat__group">
      <h3>{title}</h3>
      <div className="group" style={{ background: 'var(--fill)' }}>
        {rows.map((r) => (
          <Link key={r.item_id} to={`/item/${r.item_id}`} className="group__row tap" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Cover item={{ title: r.title, category: r.category as CategoryId, image_url: r.image_url }} size={36} radius={8} />
            <span className="compat__title">{r.title}</span>
            <span className="compat__notes">
              você {formatRating(r.my_rating)} · {first} {formatRating(r.their_rating)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function MyServicesHint() {
  const services = useMyServices()
  if (!services.data?.length) return null
  return <p className="field-hint" style={{ margin: 0 }}>Você assina: {services.data.map((s) => s.name).join(', ')}.</p>
}
