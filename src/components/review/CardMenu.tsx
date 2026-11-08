import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { requestCompose } from '../../lib/composeBus'
import { DID_VERB, WANT_VERB, useToggleWatchlist, useWatchlist } from '../../lib/diary'
import { useToggleLike } from '../../lib/social'
import type { Review } from '../../lib/types'
import { Sheet } from '../ui/Sheet'

/**
 * Menu rápido de um card do feed (M3): aparece ao segurar o card (ou botão direito no desktop).
 * Ações: abrir, curtir a review, "quero ver/ouvir…", registrar também, compartilhar.
 */
export function CardMenu({ review, open, onClose }: { review: Review; open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const { userId } = useAuth()
  const { item } = review
  const toggleLike = useToggleLike()
  const want = useToggleWatchlist()
  const myList = useWatchlist(open ? userId : null)
  const liked = (review.likes ?? []).some((l) => l.user_id === userId)
  const inList = (myList.data ?? []).some((w) => w.item_id === item.id)
  const mine = review.user_id === userId

  const run = (fn: () => void) => () => {
    onClose()
    fn()
  }

  const share = async () => {
    const url = `${window.location.origin}/item/${item.id}`
    try {
      if (navigator.share) await navigator.share({ title: item.title, text: `${item.title} no MMisc`, url })
      else await navigator.clipboard.writeText(url)
    } catch {
      /* a pessoa fechou a folha de compartilhar */
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={item.title}>
      <div className="card-menu">
        <div className="group">
          <button type="button" className="group__row tap card-menu__row" onClick={run(() => navigate(`/item/${item.id}`))}>
            Abrir
          </button>
          {!mine && userId && (
            <button
              type="button"
              className="group__row tap card-menu__row"
              onClick={run(() => toggleLike.mutate({ reviewId: review.id, liked, uid: userId }))}
            >
              {liked ? 'Descurtir a review' : 'Curtir a review'}
            </button>
          )}
          <button
            type="button"
            className="group__row tap card-menu__row"
            disabled={myList.isLoading}
            onClick={run(() => want.mutate({ itemId: item.id, on: !inList }))}
          >
            {inList ? `Tirar do "quero ${WANT_VERB[item.category]}"` : `Quero ${WANT_VERB[item.category]}`}
          </button>
          <button
            type="button"
            className="group__row tap card-menu__row"
            onClick={run(() => requestCompose({ itemId: item.id, title: item.title, category: item.category }))}
          >
            {mine ? `${DID_VERB[item.category]} de novo` : `${DID_VERB[item.category]} também · registrar`}
          </button>
          <button type="button" className="group__row tap card-menu__row" onClick={run(share)}>
            Compartilhar
          </button>
        </div>
      </div>
    </Sheet>
  )
}
