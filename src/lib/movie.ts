// Página do filme 2.0: ficha completa vinda da Edge Function "movie-details".
// O formato abaixo é o mesmo que a função devolve (supabase/functions/movie-details).
import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Item } from './types'

import { t } from './i18n'
export interface MoviePerson {
  id: number
  name: string
  /** personagem (elenco) ou função traduzida (equipe) */
  role: string
  photo: string | null
}

export interface MovieProvider {
  id: number
  name: string
  logo: string | null
}

export interface MovieSimilar {
  id: number
  title: string
  original_title: string | null
  year: number | null
  poster: string | null
  overview: string | null
}

export interface MovieDetails {
  tmdb_id: number
  title: string
  original_title: string | null
  tagline: string | null
  overview: string | null
  year: number | null
  release_date: string | null
  runtime: number | null
  certification_br: string | null
  genres: string[]
  poster: string | null
  backdrop: string | null
  directors: string[]
  cast: MoviePerson[]
  crew: MoviePerson[]
  trailer: { key: string; name: string } | null
  providers: { link: string | null; flatrate: MovieProvider[]; rent: MovieProvider[]; buy: MovieProvider[] } | null
  recommendations: MovieSimilar[]
  tmdb_rating: number | null
  tmdb_votes: number | null
  fetched_at: string
}

interface MovieResponse {
  details?: MovieDetails
  missingKey?: string
  error?: string
}

export const isTmdbMovie = (item: Pick<Item, 'category' | 'source'>) =>
  item.category === 'filme' && item.source === 'tmdb-movie'

/** Ficha do filme. A função guarda no banco por 7 dias; aqui fica 1 h em memória. */
export function useMovieDetails(item: Item | undefined) {
  const enabled = Boolean(item && isTmdbMovie(item))
  return useQuery({
    queryKey: ['movie-details', item?.id],
    enabled,
    staleTime: 60 * 60 * 1000,
    // se o banco já tem a ficha, a tela aparece na hora
    initialData: () => cachedFromItem(item),
    initialDataUpdatedAt: () => {
      const at = item?.metadata?.fetched_at
      return typeof at === 'string' ? new Date(at).getTime() : undefined
    },
    queryFn: async (): Promise<MovieResponse> => {
      const { data, error } = await supabase.functions.invoke<MovieResponse>('movie-details', {
        body: { item_id: item!.id },
      })
      if (error) throw error
      return data ?? {}
    },
  })
}

function cachedFromItem(item: Item | undefined): MovieResponse | undefined {
  const t = item?.metadata?.tmdb
  if (t && typeof t === 'object' && 'tmdb_id' in t) return { details: t as MovieDetails }
  return undefined
}

// ---------- imagens e textos ----------

type Size = 'w92' | 'w185' | 'w342' | 'w500' | 'w780' | 'w1280' | 'original'
export const tmdbImg = (path: string | null | undefined, size: Size = 'w342') =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null

/** 134 -> "2h 14min" */
export function formatRuntime(min: number | null): string | null {
  if (!min) return null
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!h) return `${m}min`
  return m ? `${h}h ${m}min` : `${h}h`
}

/** "L", "10", "12", "14", "16", "18" -> rótulo acessível */
export function certificationLabel(c: string): string {
  return c === 'L' ? t('Livre para todos os públicos') : t('Não recomendado para menores de {c} anos', { c })
}
