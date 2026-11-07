import { useQuery } from '@tanstack/react-query'
import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { displayName } from '../../lib/format'
import { NOW_VERB, isStale, useNow, type NowRow } from '../../lib/profileData'
import { useMyProfile, useUserReviews } from '../../lib/queries'
import { useFriends } from '../../lib/social'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../lib/types'
import { Avatar, Cover } from '../review/ReviewCard'

// O seletor de "agora" é do perfil: só baixa quando você toca no seu círculo
const NowSheet = lazy(() => import('../profile/ProfileSections').then((m) => ({ default: m.NowSheet })))

type FriendNow = NowRow & { user_id: string }

/** "Agora" dos amigos (o banco só devolve o que eles deixaram visível para você). */
function useFriendsNow(ids: string[]) {
  return useQuery({
    queryKey: ['now', 'friends', ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_now')
        .select('user_id, category, set_at, visibility, item:items!inner ( id, category, title, subtitle, image_url, year )')
        .in('user_id', ids)
        .order('set_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as FriendNow[]
    },
  })
}

/**
 * Fileira "Agora" no topo do Início (M3), estilo Stories: você primeiro (toque para mudar)
 * e os amigos com o que estão vendo, ouvindo, jogando… Toque no amigo abre o item.
 * Some sozinha quando ninguém marcou nada e você também não.
 */
export function NowStrip() {
  const { userId } = useAuth()
  const { data: me } = useMyProfile(userId)
  const friends = useFriends()
  const accepted = (friends.data ?? []).filter((f) => f.status === 'aceita')
  const people = new Map<string, Profile>(accepted.map((f) => [f.id, f]))
  const theirs = useFriendsNow(accepted.map((f) => f.id))
  const mine = useNow(userId)
  const [editing, setEditing] = useState(false)
  // o seletor de "agora" usa o seu diário; só busca quando abre
  const myEntries = useUserReviews(editing ? userId : null)

  // um círculo por amigo: o "agora" mais recente dele, se não estiver velho
  const latest = new Map<string, FriendNow>()
  for (const r of theirs.data ?? []) if (!isStale(r.set_at) && !latest.has(r.user_id)) latest.set(r.user_id, r)
  const myFresh = (mine.data ?? []).filter((r) => !isStale(r.set_at))
  const myTop = myFresh[0]

  if (!me || !userId) return null
  if (latest.size === 0 && accepted.length === 0 && !myTop) return null

  return (
    <section className="now-strip" aria-label="Agora: o que você e seus amigos estão curtindo">
      <ul className="now-strip__list no-scrollbar">
        <li>
          <button type="button" className="now-bubble tap" onClick={() => setEditing(true)} aria-label={myTop ? `Você está ${NOW_VERB[myTop.category]} ${myTop.item.title}. Mudar` : 'Marcar o que você está vendo ou ouvindo agora'}>
            <span className={`now-bubble__ring ${myTop ? '' : 'now-bubble__ring--empty'}`}>
              <Avatar profile={me} size={58} />
              {myTop ? (
                <span className="now-bubble__cover">
                  <Cover item={myTop.item} size={26} radius={7} />
                </span>
              ) : (
                <span className="now-bubble__plus" aria-hidden="true">
                  +
                </span>
              )}
            </span>
            <span className="now-bubble__name">Você</span>
            <span className="now-bubble__what">{myTop ? myTop.item.title : 'Seu agora'}</span>
          </button>
        </li>
        {[...latest.values()].map((r) => {
          const p = people.get(r.user_id)
          if (!p) return null
          return (
            <li key={r.user_id}>
              <Link to={`/item/${r.item.id}`} className="now-bubble tap" aria-label={`${displayName(p)} está ${NOW_VERB[r.category]} ${r.item.title}`}>
                <span className="now-bubble__ring">
                  <Avatar profile={p} size={58} />
                  <span className="now-bubble__cover">
                    <Cover item={r.item} size={26} radius={7} />
                  </span>
                </span>
                <span className="now-bubble__name">{displayName(p).split(' ')[0]}</span>
                <span className="now-bubble__what">{r.item.title}</span>
              </Link>
            </li>
          )
        })}
      </ul>
      {editing && (
        <Suspense fallback={null}>
          <NowSheet open={editing} onClose={() => setEditing(false)} userId={userId} entries={myEntries.data ?? []} current={mine.data ?? []} />
        </Suspense>
      )}
    </section>
  )
}
