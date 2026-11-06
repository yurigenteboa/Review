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

export type WatchedWhere = 'cinema' | 'streaming' | 'casa' | 'outro'

export interface Review {
  id: string
  user_id: string
  /** vazio = "vi" sem nota */
  rating: number | null
  body: string | null
  criteria_scores: Record<string, number>
  visibility: Visibility
  created_at: string
  /** dia em que viu / ouviu / foi (diário) */
  experienced_at: string
  rewatch: boolean
  /** ♥ no item (não confundir com curtidas na review) */
  loved: boolean
  watched_where: WatchedWhere | null
  item: Item
  author: Profile
  photos: ReviewPhoto[]
  /** "Contém spoiler": o texto inteiro fica borrado até o toque */
  spoiler: boolean
  /** amigos marcados em "vi com quem" */
  companions?: { user: Profile }[]
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
  type: 'friend_request' | 'friend_accepted' | 'like' | 'comment' | 'companion'
  created_at: string
  read_at: string | null
  review_id: string | null
  actor: Profile
  /** 'companion': o item e a data em que viram juntos */
  item: { id: string; title: string; category: string } | null
  meta: { watched_on?: string; watched_where?: WatchedWhere | null }
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

export interface WatchlistRow {
  user_id: string
  item_id: string
  visibility: Visibility
  created_at: string
  item: Item & { providers?: { flatrate?: { id: number; name: string }[] } | null }
  person?: Profile
}

export interface UserService {
  provider_id: number
  name: string
  logo_path: string | null
}

export const WATCHED_WHERE_LABEL: Record<WatchedWhere, string> = {
  cinema: 'Cinema',
  streaming: 'Streaming',
  casa: 'Em casa',
  outro: 'Outro',
}

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  privado: 'Privado',
  amigos: 'Amigos',
  publico: 'Público',
}
