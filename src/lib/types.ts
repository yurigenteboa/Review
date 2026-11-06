// Formatos dos dados que vêm do Supabase.
import type { CategoryId } from './categories'

export type Visibility = 'privado' | 'amigos' | 'publico'

export interface Profile {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

export interface Item {
  id: string
  category: CategoryId
  title: string
  subtitle: string | null
  image_url: string | null
  year: number | null
  source?: string
  external_id?: string | null
  /** dados extras da fonte (ex.: ficha do TMDB em metadata.tmdb, com metadata.fetched_at) */
  metadata?: Record<string, unknown> | null
}

export interface ReviewPhoto {
  storage_path: string
  position: number
}

export interface Review {
  id: string
  user_id: string
  rating: number
  body: string | null
  criteria_scores: Record<string, number>
  visibility: Visibility
  created_at: string
  item: Item
  author: Profile
  photos: ReviewPhoto[]
  /** "Contém spoiler" (coluna chega na F2; até lá, use ||trecho|| no texto) */
  spoiler?: boolean
  /** quem curtiu (só as curtidas que você pode ver) */
  likes?: { user_id: string }[]
  /** contagem de comentários */
  comments?: { count: number }[]
}

export interface FriendRow {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  status: 'pendente' | 'aceita'
  requested_by_me: boolean
  since: string
}

export interface Comment {
  id: string
  review_id: string
  user_id: string
  body: string
  created_at: string
  author: Profile
}

export interface Notification {
  id: string
  type: 'friend_request' | 'friend_accepted' | 'like' | 'comment'
  created_at: string
  read_at: string | null
  review_id: string | null
  actor: Profile
  review: { id: string; item: { id: string; title: string } } | null
  comment: { body: string } | null
}

export interface TasteRow {
  item_id: string
  title: string
  category: string
  image_url: string | null
  my_rating: number
  their_rating: number
}

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  privado: 'Privado',
  amigos: 'Amigos',
  publico: 'Público',
}
