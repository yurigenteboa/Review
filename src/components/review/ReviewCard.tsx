import { useState } from 'react'
import { Link } from 'react-router-dom'
import { catInk, categoryById, formatRating, type CategoryId } from '../../lib/categories'
import { avatarColor, displayName, initials, timeAgo } from '../../lib/format'
import { usePhotoUrls } from '../../lib/queries'
import { VISIBILITY_LABEL, type Item, type Profile, type Review } from '../../lib/types'
import { Stars } from '../ui/Stars'
import { CommentIcon, HeartIcon } from '../ui/Icons'
import { useAuth } from '../../lib/auth'
import { useToggleLike } from '../../lib/social'
import { CommentsSheet } from './CommentsSheet'

type CoverItem = Pick<Item, 'title' | 'category' | 'image_url'>

/** Capa do item: a imagem quando existir (Fase 3), senão gradiente da categoria + iniciais. */
export function Cover({ item, size = 72, radius, fill = false }: { item: CoverItem; size?: number; radius?: number; fill?: boolean }) {
  const [broken, setBroken] = useState(false)
  const r = radius ?? size * 0.22
  const dim = fill ? '100%' : size
  if (item.image_url && !broken) {
    return (
      <img
        src={item.image_url}
        alt=""
        loading="lazy"
        className="cover"
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
    return <img src={profile.avatar_url} alt="" className="avatar" style={{ width: size, height: size, objectFit: 'cover' }} />
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

  return (
    <article className="review-card">
      {showItem && (
        <Link to={`/item/${item.id}`} className="review-card__head tap" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Cover item={item} />
          <div className="review-card__info">
            <CategoryTag category={item.category} />
            <span className="review-card__title">{item.title}</span>
            {item.subtitle && <span className="review-card__sub">{item.subtitle}</span>}
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Stars value={review.rating} />
              <strong style={{ fontSize: 13 }}>{formatRating(review.rating)}</strong>
            </span>
          </div>
        </Link>
      )}
      {!showItem && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Stars value={review.rating} size={16} />
          <strong style={{ fontSize: 14 }}>{formatRating(review.rating)}</strong>
        </span>
      )}
      {review.body && <p className="review-card__text">{review.body}</p>}
      <PhotoStrip paths={photos} />
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
    </article>
  )
}
