import { useOwnerAccentStyle } from '../../lib/appearance'
import { useState, type CSSProperties } from 'react'
import { RankingsSection } from './RankingsSection'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { DiaryList, WatchlistGrid } from '../review/DiaryViews'
import { Cover, ReviewCard } from '../review/ReviewCard'
import { Glass } from '../ui/Glass'
import { signOut } from '../../lib/auth'
import { catColor, categoryById, formatRating, type CategoryId } from '../../lib/categories'
import { useMyServices } from '../../lib/diary'
import { displayName } from '../../lib/format'
import { useProfileFull, type ProfileFull } from '../../lib/profile'
import { friendsLabel, useFavorites, useRatingVsFriends, useSaveProfileExtras } from '../../lib/profileData'
import { publicProfileUrl } from '../../lib/publicProfile'
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
import { AvatarViewer } from './AvatarViewer'
import { EditProfileSheet } from './EditProfileSheet'
import { RatingBars, YearHeatmap } from './ProfileCharts'
import { Achievements, Goals, LinksRow, NowLine, Showcase, TopTen } from './ProfileSections'
import { t, tp } from '../../lib/i18n'
import './profile.css'

type Tab = 'diario' | 'reviews' | 'quero'
const TAB_LABEL: Record<Tab, string> = { diario: t('Diário'), reviews: t('Reviews'), quero: t('Quero ver') }

const thisYear = String(new Date().getFullYear())

/**
 * Perfil único: o seu (/perfil) e o dos outros (/u/:id) usam a mesma tela.
 * Muda só o que é do dono: editar, sair, streamings. Filtros ficam na URL (?cat= e ?aba=).
 */
export function ProfileView({ userId, isMe }: { userId: string; isMe: boolean }) {
  const navigate = useNavigate()
  const profile = useProfileFull(userId)
  const reviews = useUserReviews(userId)
  const favorites = useFavorites(userId)
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

  const vsFriends = useRatingVsFriends(cat === 'all' ? null : cat, isMe)

  // A4: perfil de outra pessoa na cor de destaque dela
  const ownerAccent = useOwnerAccentStyle(profile.data?.cor_destaque)
  if (profile.error) return <div className="page"><ErrorState error={profile.error} /></div>
  if (!profile.data) return <div className="page"><div className="page__body"><LoadingCards count={2} /></div></div>

  const p = profile.data
  const list = byCategory(all, cat)
  const stats = summary(list, thisYear)
  const color = cat === 'all' ? 'var(--accent)' : catColor(cat)
  const friendLabel = isMe ? friendsLabel(vsFriends.data) : null
  const labels = [...(friendLabel ? [friendLabel] : []), ...tasteLabels(all)].slice(0, 3)
  const hasFavorites = (favorites.data ?? []).length > 0
  const covers = coverImages(all)
  const best = topRated(list)
  const withText = list.filter((r) => r.body || r.photos.length)

  return (
    <div className="page profile" style={isMe ? undefined : ownerAccent}>
      <ProfileCover images={covers} photo={p.cover_mode === 'foto' ? p.cover_url : null} />
      {!isMe && (
        <button
          type="button"
          className="glass glass--pill tap profile__back"
          aria-label={t('Voltar')}
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/amigos'))}
        >
          <svg width="12" height="20" viewBox="0 0 12 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 2L2 10l8 8" />
          </svg>
        </button>
      )}

      <Glass className="profile__card">
        <ProfileHeader profile={p} isMe={isMe} />
        <NowLine userId={userId} isMe={isMe} entries={all} />
        {labels.length > 0 && (
          <ul className="taste-labels" aria-label={t('Rótulos de gosto')}>
            {labels.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
        <dl className="profile__stats">
          <div>
            <dt>{t('em {ano}', { ano: thisYear })}</dt>
            <dd>{stats.entriesThisYear}</dd>
          </div>
          <div>
            <dt>{tp(stats.items, 'item', 'itens')}</dt>
            <dd>{stats.items}</dd>
          </div>
          <div>
            <dt>{t('nota média')}</dt>
            <dd>{stats.average != null ? formatRating(stats.average) : '–'}</dd>
          </div>
        </dl>
      </Glass>

      {cats.length > 1 && (
        <div className="profile__cats">
          <div className="chips no-scrollbar" role="group" aria-label={t('Ver o perfil por categoria')}>
            {(['all', ...cats] as CategoryFilter[]).map((c) => (
              <button
                key={c}
                type="button"
                className="chip tap"
                aria-pressed={cat === c}
                onClick={() => setParam('cat', c === 'all' ? null : c)}
              >
                {c === 'all' ? t('Tudo') : categoryById(c).label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="profile__sections">
        {isMe && <PublicNotice profile={p} />}
        {isMe && <RetroCard />}
        {!isMe && <CompatCard otherId={userId} name={displayName(p)} cat={cat} />}

        <Showcase userId={userId} isMe={isMe} showcase={p.showcase ?? []} cat={cat} entries={all} />

        {!hasFavorites && best.length > 0 && (
          <section className="profile-section" aria-labelledby="sec-best">
            <h2 id="sec-best" className="profile-section__title">{t('Notas mais altas')}</h2>
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

        <TopTen userId={userId} isMe={isMe} cat={cat} entries={all} />

        {isMe && <RankingsSection userId={userId} />}

        <Goals userId={userId} isMe={isMe} entries={all} />

        <Achievements entries={all} isMe={isMe} />

        <section className="profile-section" aria-labelledby="sec-activity">
          <h2 id="sec-activity" className="profile-section__title">{t('Atividade')}</h2>
          <YearHeatmap entries={list} color={color} />
        </section>

        <section className="profile-section" aria-labelledby="sec-ratings">
          <h2 id="sec-ratings" className="profile-section__title">{t('Notas')}</h2>
          <RatingBars bins={ratingHistogram(list)} color={color} average={stats.average} />
        </section>

        <div className="segmented" role="tablist" aria-label={t('Listas')} style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          {(Object.keys(TAB_LABEL) as Tab[]).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setParam('aba', k === (isMe ? 'diario' : 'reviews') ? null : k)}>
              {k === 'diario' ? t('Diário ({n})', { n: list.length }) : TAB_LABEL[k]}
            </button>
          ))}
        </div>

        {reviews.isLoading && <LoadingCards count={2} />}
        {tab === 'diario' && (
          <DiaryList entries={list} empty={isMe ? t('Seu diário está vazio. Registre o primeiro pelo + da barra.') : t('Nada no diário que você possa ver.')} />
        )}
        {tab === 'reviews' && (
          <div className="profile__reviews">
            {withText.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
            {!reviews.isLoading && withText.length === 0 && (
              <p className="empty-note">{isMe ? t('Nenhuma review com texto ou foto ainda.') : t('Nenhuma review com texto que você possa ver.')}</p>
            )}
          </div>
        )}
        {tab === 'quero' && (
          <>
            <WatchlistGrid
              userId={userId}
              empty={isMe ? t('Nada na lista. Toque no marcador da página de um filme (ou em “Quero …” nos outros itens).') : t('Lista vazia (ou só com itens privados).')}
            />
            {isMe && <MyServicesHint />}
          </>
        )}

        {isMe && (
          <div className="profile__footer">
            <Link to="/aparencia" className="btn btn--plain tap public-cta__btn">
              {t('Aparência e acessibilidade')}
            </Link>
            <Link to="/retrospectiva" className="btn btn--plain tap public-cta__btn">
              {t('Retrospectiva de {thisYear}', { thisYear })}
            </Link>
            <Link to="/importar" className="btn btn--plain tap public-cta__btn">
              {t('Importar do Letterboxd')}
            </Link>
            {p.is_public && p.username && (
              <Link to={`/@${p.username}`} className="btn btn--plain tap public-cta__btn">
                {t('Ver meu perfil público')}
              </Link>
            )}
            <button type="button" className="btn btn--plain tap" onClick={() => signOut()}>
              {t('Sair da conta')}
            </button>
            <Link to="/kit">{t('Ver componentes do design system')}</Link>
          </div>
        )}
      </div>
    </div>
  )
}

/** Mosaico desfocado das capas que a pessoa mais curte; sem capas, um degradê. */
function ProfileCover({ images, photo }: { images: string[]; photo: string | null }) {
  return (
    <div className="profile__cover" aria-hidden="true">
      {photo ? (
        <img className="profile__cover-photo" src={photo} alt="" />
      ) : images.length >= 3 ? (
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
  const [editing, setEditing] = useState(false)
  return (
    <>
      <div className="profile__identity">
        {/* toque/clique amplia a foto; o dono troca por ali */}
        <AvatarViewer profile={p} size={76} isMe={isMe} />
        <div className="profile__names">
          <h1>{displayName(p)}</h1>
          <span>{p.username ? `@${p.username}` : isMe ? t('sem @ ainda') : ''}</span>
        </div>
      </div>
      {p.bio ? (
        <p className="profile__bio">{p.bio}</p>
      ) : (
        isMe && (
          <button type="button" className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setEditing(true)}>
            {t('+ Escrever uma bio')}
          </button>
        )
      )}
      <LinksRow links={p.links ?? []} />
      <div className="profile__actions">
        {isMe ? (
          <button type="button" className="btn btn--plain tap" onClick={() => setEditing(true)}>
            {t('Editar perfil')}
          </button>
        ) : (
          <FriendAction id={p.id} name={displayName(p)} />
        )}
      </div>
      {isMe && editing && <EditProfileSheet profile={p} onClose={() => setEditing(false)} />}
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
        disabled={busy}
        aria-label={t('Amigos. Tocar para desfazer a amizade')}
        onClick={() => {
          if (window.confirm(t('Desfazer amizade com {name}? Vocês deixam de ver as reviews "Amigos" um do outro.', { name }))) remove.mutate(id)
        }}
      >
        {t('Amigos ✓')}
      </button>
    )
  if (state === 'enviado')
    return (
      <button
        type="button"
        className="btn btn--plain tap"
        disabled={busy}
        aria-label={t('Pedido enviado. Tocar para cancelar')}
        onClick={() => {
          if (window.confirm(t('Cancelar o pedido de amizade para {name}?', { name }))) remove.mutate(id)
        }}
      >
        {t('Pedido enviado')}
      </button>
    )
  if (state === 'recebido')
    return (
      <>
        <button type="button" className="btn btn--primary tap" disabled={busy} onClick={() => respond.mutate({ other: id, accept: true })}>
          {t('Aceitar pedido')}
        </button>
        <button type="button" className="btn btn--plain tap" disabled={busy} onClick={() => respond.mutate({ other: id, accept: false })}>
          {t('Recusar')}
        </button>
      </>
    )
  return (
    <button type="button" className="btn btn--primary tap" disabled={busy} onClick={() => request.mutate(id)}>
      {t('Adicionar amigo')}
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
      return <p className="profile-section__hint profile__notice">{t('Vocês ainda não são amigos: aqui aparecem só as reviews públicas.')}</p>
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
            {t('Compatibilidade')}
          </h2>
          <p className="profile-section__hint" style={{ margin: '2px 0 0' }}>
            {tp(rows.length, '{score}% de concordância em {n} item que vocês dois avaliaram', '{score}% de concordância em {n} itens que vocês dois avaliaram', { score })}
          </p>
        </div>
      </div>
      {bothLove.length > 0 && <CompatRow title={t('Vocês dois amam')} rows={bothLove.slice(0, 4)} first={first} />}
      {clashes.length > 0 && <CompatRow title={t('Onde mais discordam')} rows={clashes.slice(0, 2)} first={first} />}
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
              {t('você {nota} · {first} {nota2}', { nota: formatRating(r.my_rating), first, nota2: formatRating(r.their_rating) })}
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
  return <p className="field-hint" style={{ margin: 0 }}>{t('Você assina: {v}.', { v: services.data.map((s) => s.name).join(', ') })}</p>
}

/** Aviso de primeira vez: o perfil passou a ter link público (ligado por padrão). */
const PUBLIC_NOTICE_KEY = 'mmisc.publicNoticeSeen'
function PublicNotice({ profile: p }: { profile: ProfileFull }) {
  const extras = useSaveProfileExtras()
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem(PUBLIC_NOTICE_KEY) === '1'
    } catch {
      return false
    }
  })
  const close = () => {
    try {
      localStorage.setItem(PUBLIC_NOTICE_KEY, '1')
    } catch {
      /* modo privado: o aviso volta na próxima vez */
    }
    setSeen(true)
  }
  if (seen || !p.is_public) return null
  return (
    <section className="profile-section public-notice" aria-labelledby="sec-public-notice">
      <h2 id="sec-public-notice" className="profile-section__title" style={{ margin: 0 }}>
        {t('Seu perfil agora tem um link público')}
      </h2>
      <p>
        {p.username
          ? t('Quem abrir {link} vê nome, foto, bio, links e só o que estiver como Público (reviews, favoritos, Top 10). Amigos, metas, quero ver e o que é só para amigos ficam de fora.', { link: <strong>{publicProfileUrl(p.username).replace(/^https?:\/\//, '')}</strong> })
          : t('Quando você escolher um @, quem abrir o seu link vai ver nome, foto, bio, links e só o que estiver como Público (reviews, favoritos, Top 10). Amigos, metas, quero ver e o que é só para amigos ficam de fora.')}
      </p>
      <div className="public-notice__actions">
        {p.username && (
          <Link to={`/@${p.username}`} className="btn btn--primary tap public-cta__btn" onClick={close}>
            {t('Ver como fica')}
          </Link>
        )}
        <button
          type="button"
          className="btn btn--plain tap"
          disabled={extras.isPending}
          onClick={() => extras.mutate({ userId: p.id, is_public: false }, { onSuccess: close })}
        >
          {t('Deixar privado')}
        </button>
        <button type="button" className="btn btn--plain tap" onClick={close}>
          {t('Ok')}
        </button>
      </div>
    </section>
  )
}

/** Em dezembro (ano atual) e janeiro (ano anterior), a retrospectiva aparece em destaque. */
function RetroCard() {
  const now = new Date()
  const month = now.getMonth()
  if (month !== 11 && month !== 0) return null
  const year = month === 11 ? now.getFullYear() : now.getFullYear() - 1
  return (
    <Link to={`/retrospectiva?ano=${year}`} className="profile-section retro-card tap">
      <strong>{t('Sua retrospectiva de {year} está pronta', { year })}</strong>
      <span className="profile-section__hint">{t('Números do ano, recordes e uma imagem para os Stories.')}</span>
    </Link>
  )
}
