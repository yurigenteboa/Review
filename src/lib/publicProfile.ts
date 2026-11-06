// Perfil público (mmisc.com.br/@usuario): abre sem login.
// Tudo vem de UMA função do banco (public_profile), que só devolve o que é público
// e só se a pessoa não deixou o perfil privado.
import { useQuery } from '@tanstack/react-query'
import type { CategoryId } from './categories'
import type { ProfileLink } from './profileData'
import { supabase } from './supabase'
import type { Item, Review } from './types'

export interface PublicProfileData {
  profile: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    bio: string | null
    cover_mode: 'auto' | 'foto'
    cover_url: string | null
    links: ProfileLink[]
    showcase: CategoryId[]
  }
  favorites: { category: CategoryId; position: number; item: Item }[]
  now: { category: CategoryId; set_at: string; item: Item }[]
  rankings: { year: number; category: CategoryId; position: number; item: Item }[]
  reviews: {
    id: string
    rating: number | string | null
    body: string | null
    spoiler: boolean
    experienced_at: string
    created_at: string
    loved: boolean
    rewatch: boolean
    item: Item
  }[]
}

/** "@Yuri" -> "yuri"; null se não parecer um @ válido. */
export function parseHandle(path: string): string | null {
  const m = path.match(/^\/@([A-Za-z0-9_.]{3,24})\/?$/)
  return m ? m[1].toLowerCase() : null
}

export const publicProfileUrl = (username: string) => `${window.location.origin}/@${username}`

export function usePublicProfile(handle: string | null) {
  return useQuery({
    queryKey: ['public-profile', handle],
    enabled: Boolean(handle),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('public_profile', { p_handle: handle })
      if (error) throw error
      return (data ?? null) as PublicProfileData | null
    },
  })
}

/** As reviews públicas no formato que as funções de estatística do perfil usam. */
export function asReviews(d: PublicProfileData): Review[] {
  const author = { id: d.profile.id, username: d.profile.username, display_name: d.profile.display_name, avatar_url: d.profile.avatar_url }
  return d.reviews.map((r) => ({
    id: r.id,
    user_id: d.profile.id,
    rating: r.rating == null ? null : Number(r.rating),
    body: r.body,
    criteria_scores: {},
    visibility: 'publico',
    created_at: r.created_at,
    experienced_at: r.experienced_at,
    rewatch: r.rewatch,
    loved: r.loved,
    spoiler: r.spoiler,
    watched_where: null,
    item: r.item,
    author,
    photos: [],
  }))
}
