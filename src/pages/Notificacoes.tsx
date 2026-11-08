import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../components/review/ReviewCard'
import { smallBtn } from '../components/social/PersonRow'
import { PageHeader } from '../components/ui/PageHeader'
import type { ComposeStart } from '../components/review/ComposeSheet'
import { useAuth } from '../lib/auth'
import type { CategoryId } from '../lib/categories'
import { formatDay } from '../lib/diary'
import { displayName, timeAgo } from '../lib/format'
import { useUserReviews } from '../lib/queries'
import { useFriends, useMarkAllRead, useNotifications, useRespondFriend } from '../lib/social'
import type { Notification } from '../lib/types'
import { EmptyState, LoadingCards } from './states'

function text(n: Notification) {
  const who = displayName(n.actor)
  const item = n.review?.item?.title
  switch (n.type) {
    case 'friend_request':
      return `${who} quer ser seu amigo`
    case 'friend_accepted':
      return `Você e ${who} agora são amigos`
    case 'like':
      return `${who} curtiu sua review${item ? ` de ${item}` : ''}`
    case 'comment':
      return `${who} comentou na sua review${item ? ` de ${item}` : ''}${n.comment?.body ? `: “${n.comment.body.slice(0, 80)}”` : ''}`
    case 'companion':
      return `${who} registrou que vocês ${n.item?.category === 'album' ? 'ouviram' : ['bar', 'restaurante', 'cafe', 'cidade'].includes(n.item?.category ?? '') ? 'foram a' : 'viram'} ${n.item?.title ?? 'algo'} juntos${n.meta?.watched_on ? ` (${formatDay(n.meta.watched_on)})` : ''}`
  }
}

function linkOf(n: Notification) {
  if (n.type === 'like' || n.type === 'comment') return n.review?.item ? `/item/${n.review.item.id}` : '/'
  if (n.type === 'companion') return n.item ? `/item/${n.item.id}` : '/'
  return `/u/${n.actor.id}`
}

export default function Notificacoes({ onCompose }: { onCompose: (s: ComposeStart) => void }) {
  const { userId } = useAuth()
  const mine = useUserReviews(userId)
  const list = useNotifications()
  const markAll = useMarkAllRead()
  const friends = useFriends()
  const respond = useRespondFriend()
  const unread = (list.data ?? []).some((n) => !n.read_at)

  // ao abrir a tela, marca tudo como lido (o destaque some na próxima visita)
  useEffect(() => {
    if (!unread) return
    const t = setTimeout(() => markAll.mutate(), 1500)
    return () => clearTimeout(t)
  }, [unread]) // eslint-disable-line react-hooks/exhaustive-deps

  const pendingFrom = new Set((friends.data ?? []).filter((f) => f.status === 'pendente' && !f.requested_by_me).map((f) => f.id))

  return (
    <div className="page">
      <PageHeader title="Notificações" />
      <div className="page__body">
        {list.isLoading && <LoadingCards count={2} />}
        {list.data?.length === 0 && <EmptyState title="Nada por aqui" text="Curtidas, comentários, pedidos de amizade e quem viu algo com você aparecem aqui." />}
        {(list.data?.length ?? 0) > 0 && (
          <div className="group">
            {list.data!.map((n) => (
              <div key={n.id} className="group__row" style={{ alignItems: 'flex-start', background: n.read_at ? undefined : 'color-mix(in srgb, var(--accent) 8%, transparent)' }}>
                <Link to={`/u/${n.actor.id}`} style={{ display: 'flex' }}>
                  <Avatar profile={n.actor} size={40} />
                </Link>
                <Link to={linkOf(n)} style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
                  <span style={{ display: 'block', fontSize: '0.9375rem', lineHeight: 1.35 }}>{text(n)}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{timeAgo(n.created_at)}</span>
                </Link>
                {n.type === 'companion' && n.item && !(mine.data ?? []).some((r) => r.item.id === n.item!.id && r.experienced_at === n.meta?.watched_on) && (
                  <button
                    type="button"
                    className="btn btn--primary tap"
                    style={smallBtn}
                    onClick={() =>
                      onCompose({
                        itemId: n.item!.id,
                        title: n.item!.title,
                        category: n.item!.category as CategoryId,
                        prefill: { experiencedAt: n.meta?.watched_on, watchedWhere: n.meta?.watched_where ?? null, companions: [n.actor.id] },
                      })
                    }
                  >
                    Registrar
                  </button>
                )}
                {n.type === 'friend_request' && pendingFrom.has(n.actor.id) && (
                  <button type="button" className="btn btn--primary tap" style={smallBtn} disabled={respond.isPending} onClick={() => respond.mutate({ other: n.actor.id, accept: true })}>
                    Aceitar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
