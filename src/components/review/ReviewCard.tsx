import { useState } from 'react'
import { Link } from 'react-router-dom'
import { catInk, categoryById, formatRating, type CategoryId } from '../../lib/categories'
import { avatarColor, displayName, initials, timeAgo } from '../../lib/format'
import { usePhotoUrls } from '../../lib/queries'
import { VISIBILITY_LABEL, WATCHED_WHERE_LABEL, type ChildEntry, type Item, type Profile, type Review } from '../../lib/types'
import { DID_VERB, formatDay } from '../../lib/diary'
import { Stars } from '../ui/Stars'
import { CommentIcon, HeartIcon } from '../ui/Icons'
import { useAuth } from '../../lib/auth'
import { useToggleLike } from '../../lib/social'
import { CommentsSheet } from './CommentsSheet'
import { CardMenu } from './CardMenu'
import { useDoubleTap, useLongPress } from '../../lib/gestures'
import { haptic } from '../../lib/haptics'
import { SpoilerText } from './SpoilerText'

type CoverItem = Pick<Item, 'title' | 'category' | 'image_url'>

/** Capa do item: a imagem quando existir (Fase 3), senão gradiente da categoria + iniciais. */
export function Cover({ item, size = 72, radius, fill = false }: { item: CoverItem; size?: number; radius?: number; fill?: boolean }) {
  const [broken, setBroken] = useState(false)
  // M0: a capa aparece suavemente quando termina de baixar (sem o "pisca" seco)
  const [loaded, setLoaded] = useState(false)
  const r = radius ?? size * 0.22
  const dim = fill ? '100%' : size
  if (item.image_url && !broken) {
    return (
      <img
        src={item.image_url}
        alt=""
        loading="lazy"
        decoding="async"
        className={`cover cover--img${loaded ? ' is-loaded' : ''}`}
        // imagem que já estava no cache: marca como pronta na hora, sem animação
        ref={(el) => {
          if (el?.complete && el.naturalWidth > 0 && !loaded) setLoaded(true)
        }}
        onLoad={() => setLoaded(true)}
        onError={() => setBroken(true)}
        style={{ width: dim, height: dim, borderRadius: r, objectFit: 'cover', background: 'var(--fill)' }}
      />
    )
  }
  return (
    <div
      className="cover"
      aria-hidden="true"
      style={{
        width: dim,
        height: dim,
        borderRadius: r,
        fontSize: fill ? 28 : size * 0.3,
        background: `linear-gradient(135deg, color-mix(in srgb, var(--cat-${item.category}) 55%, #000), var(--cat-${item.category}))`,
      }}
    >
      {initials(item.title)}
    </div>
  )
}

export function CategoryTag({ category }: { category: CategoryId }) {
  return (
    <span
      className="cat-tag"
      style={{ color: catInk(category), background: `color-mix(in srgb, var(--cat-${category}) 14%, transparent)` }}
    >
      {categoryById(category).label}
    </span>
  )
}

export function Avatar({ profile, size = 28 }: { profile: Pick<Profile, 'id' | 'display_name' | 'username' | 'avatar_url'>; size?: number }) {
  if (profile.avatar_url) {
    // no-referrer: a foto do Google (lh3.googleusercontent.com) às vezes recusa pedidos com referrer
    return <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" className="avatar" style={{ width: size, height: size, objectFit: 'cover' }} />
  }
  return (
    <span className="avatar" aria-hidden="true" style={{ width: size, height: size, fontSize: size * 0.38, background: avatarColor(profile.id) }}>
      {initials(profile.display_name ?? profile.username)}
    </span>
  )
}

export function PhotoStrip({ paths }: { paths: string[] }) {
  const { data: urls } = usePhotoUrls(paths)
  if (!paths.length) return null
  return (
    <div className="photo-strip no-scrollbar">
      {(urls ?? paths.map(() => '')).map((u, i) =>
        u ? (
          <img key={i} src={u} alt={`Foto ${i + 1} da review`} loading="lazy" />
        ) : (
          <span key={i} className="photo-strip__ph" />
        ),
      )}
    </div>
  )
}

/** Linha do diário: nota (ou "vi"), ♥, revi, dia, onde e com quem. */
export function EntryLine({ review, big = false }: { review: Review; big?: boolean }) {
  const verb = DID_VERB[review.item.category]
  const people = review.companions?.map((c) => displayName(c.user)) ?? []
  return (
    <span className="entry-meta" style={{ marginTop: big ? 0 : 2 }}>
      {review.rating != null ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text)' }}>
          <Stars value={review.rating} size={big ? 16 : 14} withNumber />
          <strong style={{ fontSize: big ? '0.875rem' : '0.8125rem' }}>{formatRating(review.rating)}</strong>
        </span>
      ) : (
        <strong style={{ color: 'var(--text-2)', fontWeight: 600 }}>{verb}, sem nota</strong>
      )}
      {review.loved && (
        <span className="loved" role="img" aria-label="Curtiu">
          ♥
        </span>
      )}
      {review.rewatch && <span>↻ de novo</span>}
      <span>{formatDay(review.experienced_at)}</span>
      {review.watched_where && <span>{WATCHED_WHERE_LABEL[review.watched_where]}</span>}
      {people.length > 0 && <span>com {people.join(', ')}</span>}
    </span>
  )
}

/** Card do feed: capa, título, nota, texto, fotos, autor, curtidas e comentários. */
export function ReviewCard({ review, showItem = true }: { review: Review; showItem?: boolean }) {
  const { item, author } = review
  const { userId } = useAuth()
  const toggleLike = useToggleLike()
  const [commentsOpen, setCommentsOpen] = useState(false)
  const photos = [...review.photos].sort((a, b) => a.position - b.position).map((p) => p.storage_path)
  const likes = review.likes ?? []
  const liked = likes.some((l) => l.user_id === userId)
  // mostra o novo estado na hora, antes do banco responder
  const pendingLike = toggleLike.isPending ? !liked : liked
  const likeCount = likes.length + (toggleLike.isPending ? (liked ? -1 : 1) : 0)
  const commentCount = review.comments?.[0]?.count ?? 0
  const authorLink = author.id === userId ? '/perfil' : `/u/${author.id}`

  // M3: segurar abre o menu rápido; dois toques (fora de links/botões) curtem, com coraçãozinho
  const [menuOpen, setMenuOpen] = useState(false)
  const [burst, setBurst] = useState<{ x: number; y: number; k: number } | null>(null)
  const longPress = useLongPress(() => {
    haptic()
    setMenuOpen(true)
  })
  const doubleTap = useDoubleTap((pos) => {
    if (!userId || author.id === userId) return
    haptic()
    setBurst({ ...pos, k: Date.now() })
    if (!liked && !toggleLike.isPending) toggleLike.mutate({ reviewId: review.id, liked: false, uid: userId })
  })

  return (
    <article
      className="review-card"
      {...longPress}
      onPointerUp={(e) => {
        longPress.onPointerUp()
        doubleTap.onPointerUp(e)
      }}
    >
      {burst && (
        <span
          key={burst.k}
          className="like-burst"
          aria-hidden="true"
          style={{ left: burst.x, top: burst.y }}
          onAnimationEnd={() => setBurst(null)}
        >
          <HeartIcon size={72} filled />
        </span>
      )}
      {showItem && (
        <Link to={`/item/${item.id}`} className="review-card__head tap" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Cover item={item} />
          <div className="review-card__info">
            <CategoryTag category={item.category} />
            <span className="review-card__title">{item.title}</span>
            {item.subtitle && <span className="review-card__sub">{item.subtitle}</span>}
            <EntryLine review={review} />
          </div>
        </Link>
      )}
      {!showItem && <EntryLine review={review} big />}
      {review.body && <SpoilerText className="review-card__text" text={review.body} whole={review.spoiler === true} />}
      <PhotoStrip paths={photos} />
      {review.children && review.children.length > 0 && <CardOrders entries={review.children} />}
      <div className="review-card__foot">
        <Link to={authorLink} className="review-card__author tap" style={{ textDecoration: 'none', minWidth: 0 }}>
          <Avatar profile={author} />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <strong style={{ fontWeight: 600 }}>{displayName(author)}</strong> · {timeAgo(review.created_at)}
          </span>
        </Link>
        <span style={{ display: 'flex', gap: 6, flex: 'none' }}>
          <button
            type="button"
            className="like-btn tap"
            aria-pressed={pendingLike}
            aria-label={pendingLike ? 'Descurtir' : 'Curtir'}
            disabled={!userId || toggleLike.isPending}
            onClick={() => userId && toggleLike.mutate({ reviewId: review.id, liked, uid: userId })}
          >
            <HeartIcon filled={pendingLike} />
            {likeCount > 0 && likeCount}
          </button>
          <button type="button" className="like-btn tap" aria-label={`Comentários (${commentCount})`} onClick={() => setCommentsOpen(true)}>
            <CommentIcon />
            {commentCount > 0 && commentCount}
          </button>
        </span>
      </div>
      {review.visibility !== 'amigos' && (
        <span className="vis-badge" style={{ alignSelf: 'flex-start', display: 'inline-block', marginTop: 10 }}>
          {VISIBILITY_LABEL[review.visibility]}
        </span>
      )}
      <CommentsSheet review={review} open={commentsOpen} onClose={() => setCommentsOpen(false)} />
      {menuOpen && <CardMenu review={review} open={menuOpen} onClose={() => setMenuOpen(false)} />}
    </article>
  )
}

/** Fase 1: o que foi pedido na noite (entradas filhas), cada um levando à página do item. */
function CardOrders({ entries }: { entries: ChildEntry[] }) {
  return (
    <div className="card-orders" aria-label="O que foi pedido">
      {entries.map((c) => (
        <Link key={c.id} to={`/item/${c.item.id}`} className="card-orders__item tap">
          <span>{c.item.title}</span>
          {c.rating != null && <b>{formatRating(c.rating)}</b>}
        </Link>
      ))}
    </div>
  )
}
