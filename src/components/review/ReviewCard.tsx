import { useState } from 'react'
import { catInk, categoryById, formatRating } from '../../lib/categories'
import type { Item, Review } from '../../lib/sample'
import { HeartIcon } from '../ui/Icons'
import { Stars } from '../ui/Stars'

interface CoverProps {
  item: Item
  size?: number
}

/** Capa provisória (gradiente + iniciais) até termos imagens das APIs. */
export function Cover({ item, size = 72 }: CoverProps) {
  return (
    <div
      className="cover"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        fontSize: size * 0.3,
        background: `linear-gradient(135deg, ${item.colors[0]}, ${item.colors[1]})`,
      }}
    >
      {item.glyph}
    </div>
  )
}

export function CategoryTag({ item }: { item: Item }) {
  return (
    <span
      className="cat-tag"
      style={{
        color: catInk(item.category),
        background: `color-mix(in srgb, var(--cat-${item.category}) 14%, transparent)`,
      }}
    >
      {categoryById(item.category).label}
    </span>
  )
}

interface ReviewCardProps {
  review: Review
  item: Item
  onOpen?: () => void
}

/** Card do feed: capa, título, nota, texto, autor e curtir. */
export function ReviewCard({ review, item, onOpen }: ReviewCardProps) {
  const [liked, setLiked] = useState(false)
  return (
    <article className="review-card">
      <button type="button" className="review-card__head tap" onClick={onOpen}>
        <Cover item={item} />
        <div className="review-card__info">
          <CategoryTag item={item} />
          <span className="review-card__title">{item.title}</span>
          <span className="review-card__sub">{item.subtitle}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Stars value={review.rating} />
            <strong style={{ fontSize: 13 }}>{formatRating(review.rating)}</strong>
          </span>
        </div>
      </button>
      <p className="review-card__text">{review.text}</p>
      <div className="review-card__foot">
        <span className="review-card__author">
          <span className="avatar" style={{ width: 28, height: 28, fontSize: 11, background: review.avatarColor }}>
            {review.initials}
          </span>
          <span>
            <strong style={{ fontWeight: 600 }}>{review.author}</strong> · {review.time}
          </span>
        </span>
        <button
          type="button"
          className="like-btn tap"
          aria-pressed={liked}
          aria-label={liked ? 'Descurtir' : 'Curtir'}
          onClick={() => setLiked(!liked)}
        >
          <HeartIcon filled={liked} />
          {review.likes + (liked ? 1 : 0)}
        </button>
      </div>
    </article>
  )
}
