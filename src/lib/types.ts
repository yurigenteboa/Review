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
}

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  privado: 'Privado',
  amigos: 'Amigos',
  publico: 'Público',
}
