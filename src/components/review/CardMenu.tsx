import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { requestCompose } from '../../lib/composeBus'
import { DID_VERB, WANT_LABEL, useToggleWatchlist, useWatchlist } from '../../lib/diary'
import { useToggleLike } from '../../lib/social'
import type { Review } from '../../lib/types'
import { Sheet } from '../ui/Sheet'

import { t } from '../../lib/i18n'
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
      if (navigator.share) await navigator.share({ title: item.title, text: t('{title} no MMisc', { title: item.title }), url })
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
            {t('Abrir')}
          </button>
          {!mine && userId && (
            <button
              type="button"
              className="group__row tap card-menu__row"
              onClick={run(() => toggleLike.mutate({ reviewId: review.id, liked, uid: userId }))}
            >
              {liked ? t('Descurtir a review') : t('Curtir a review')}
            </button>
          )}
          <button
            type="button"
            className="group__row tap card-menu__row"
            disabled={myList.isLoading}
            onClick={run(() => want.mutate({ itemId: item.id, on: !inList }))}
          >
            {inList ? t('Tirar da lista “{lista}”', { lista: WANT_LABEL[item.category] }) : WANT_LABEL[item.category]}
          </button>
          <button
            type="button"
            className="group__row tap card-menu__row"
            onClick={run(() => requestCompose({ itemId: item.id, title: item.title, category: item.category }))}
          >
            {mine ? t('{v} de novo', { v: DID_VERB[item.category] }) : t('{v} também · registrar', { v: DID_VERB[item.category] })}
          </button>
          <button type="button" className="group__row tap card-menu__row" onClick={run(share)}>
            {t('Compartilhar')}
          </button>
        </div>
      </div>
    </Sheet>
  )
}
