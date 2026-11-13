// Acervo de álbuns (migração 202611131600_albuns_acervo.sql + scripts/albuns/acervo.py).
// Paradas, artistas, gêneros e a ficha do álbum. Só leitura: o acervo é catálogo, não conteúdo de ninguém.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { formatNumber, locale, t } from './i18n'
import { ensureCatalogItem, type CatalogResult } from './queries'
import { supabase } from './supabase'
import type { Item } from './types'

/** Uma linha da view `albuns`. */
export interface Album {
  id: string
  title: string
  artists: string[] | null
  artist_slugs: string[] | null
  release_date: string | null
  date_precision: 'dia' | 'mes' | 'ano' | null
  year: number
  decade: number
  chart: string
  chart_pos: number | null
  genres: string[] | null
  genres_sec: string[] | null
  genre_main: string | null
  ref_rating: number | null
  ref_count: number
  ref_reviews: number
  score: number
  cover_url: string | null
  mbid: string | null
}

const COLS =
  'id, title, artists, artist_slugs, release_date, date_precision, year, decade, chart, chart_pos, genres, genres_sec, genre_main, ref_rating, ref_count, ref_reviews, score, cover_url, mbid'

/** O Postgres devolve numeric como texto. */
const toAlbum = (r: Record<string, unknown>): Album => ({
  ...(r as unknown as Album),
  ref_rating: r.ref_rating == null ? null : Number(r.ref_rating),
  score: Number(r.score),
})
const toAlbums = (rows: unknown[] | null): Album[] => (rows ?? []).map((r) => toAlbum(r as Record<string, unknown>))

/** Tabela ainda não criada/carregada (antes de aplicar a migração): a tela mostra um aviso, não um erro. */
export function isMissingAcervo(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null
  return Boolean(e && (e.code === 'PGRST205' || e.code === '42P01' || e.code === 'PGRST202' || /albuns|album_catalog/.test(e.message ?? '')))
}

export const PAGE = 50

/** Capa: a achada pelo script (Deezer) ou, com o id do MusicBrainz, a do Cover Art Archive. */
export const albumCover = (a: Pick<Album, 'cover_url' | 'mbid'>): string | null =>
  a.cover_url ?? (a.mbid ? `https://coverartarchive.org/release-group/${a.mbid}/front-250` : null)

export const artistLine = (a: Pick<Album, 'artists'>) => (a.artists ?? []).join(', ')

/** Vira um resultado de catálogo: com MusicBrainz, é o mesmo item da busca do app; sem, `acervo`. */
export function albumToResult(a: Album): CatalogResult {
  return {
    source: a.mbid ? 'musicbrainz' : 'acervo',
    external_id: a.mbid ?? a.id,
    category: 'album',
    title: a.title,
    subtitle: artistLine(a) || null,
    image_url: albumCover(a),
    year: a.year,
    lat: null,
    lng: null,
    metadata: { acervo: a.id },
  }
}

/** "16 de junho de 1972" / "junho de 1972" / "1972", no idioma da pessoa. */
export function albumDate(a: Pick<Album, 'release_date' | 'date_precision' | 'year'>): string {
  if (!a.release_date || a.date_precision === 'ano' || !a.date_precision) return String(a.year)
  const d = new Date(`${a.release_date}T12:00:00`)
  if (Number.isNaN(d.getTime())) return String(a.year)
  return a.date_precision === 'dia'
    ? d.toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' })
    : d.toLocaleDateString(locale(), { month: 'long', year: 'numeric' })
}

/** 74000 -> "74 mil" (pt) / "74K" (en) */
export const compact = (n: number) => formatNumber(n, { notation: 'compact', maximumFractionDigits: 1 })

/** Nota de referência com 2 casas: "4,26" */
export const refRating = (n: number | null) => (n == null ? '–' : formatNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

/** "anos 1970" */
export const decadeLabel = (d: number) => (d < 1950 ? t('antes de 1950') : t('anos {d}', { d }))

/** A parada de origem: "1972" ou "anos 1950" (os anos antes de 1960 vêm por década). */
export const chartLabel = (chart: string) => (/^\d{4}s$/.test(chart) ? t('anos {d}', { d: chart.slice(0, 4) }) : chart)

// ---------------------------------------------------------------- paradas

export interface ChartFilter {
  /** 'tudo' | 'antes' (< 1950) | década (1970) */
  period: 'tudo' | 'antes' | number
  /** ano dentro da década (ordem da parada original) */
  year?: number | null
  genre?: string | null
  /** conta também quem tem o gênero como secundário */
  withSec?: boolean
}

export function useAlbumChart(f: ChartFilter) {
  return useInfiniteQuery({
    queryKey: ['albuns', 'parada', f.period, f.year ?? null, f.genre ?? null, Boolean(f.withSec)],
    initialPageParam: 0,
    staleTime: 60 * 60 * 1000,
    getNextPageParam: (last: Album[], all) => (last.length === PAGE ? all.length * PAGE : undefined),
    queryFn: async ({ pageParam }) => {
      let q = supabase.from('albuns').select(COLS)
      if (f.year) q = q.eq('year', f.year)
      else if (f.period === 'antes') q = q.lt('year', 1950)
      else if (typeof f.period === 'number') q = q.eq('decade', f.period)
      if (f.genre) {
        const g = JSON.stringify(f.genre) // "Rock & Roll" -> entre aspas na lista do PostgREST
        q = f.withSec ? q.or(`genres.cs.{${g}},genres_sec.cs.{${g}}`) : q.contains('genres', [f.genre])
      }
      // Ano: a ordem da parada original. Período maior: nota ponderada.
      q = f.year ? q.order('chart_pos', { ascending: true, nullsFirst: false }) : q.order('score', { ascending: false })
      const { data, error } = await q.order('id').range(pageParam, pageParam + PAGE - 1)
      if (error) throw error
      return toAlbums(data)
    },
  })
}

export function useArtistAlbums(slug: string | undefined) {
  return useQuery({
    queryKey: ['albuns', 'artista', slug],
    enabled: Boolean(slug),
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('albuns').select(COLS).contains('artist_slugs', [slug!]).order('year').limit(400)
      if (error) throw error
      return toAlbums(data)
    },
  })
}

export function useAcervoSearch(q: string) {
  const term = q.trim()
  return useQuery({
    queryKey: ['albuns', 'busca', term.toLowerCase()],
    enabled: term.length >= 2,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_album_catalog', { p_q: term, p_limit: 30 })
      if (error) throw error
      return toAlbums(data as unknown[])
    },
  })
}

/** O álbum do acervo de um item do app (nada = item fora do acervo). */
export function useAlbumForItem(item: Pick<Item, 'id' | 'category' | 'source' | 'external_id' | 'title' | 'subtitle'> | null | undefined) {
  return useQuery({
    queryKey: ['albuns', 'do-item', item?.id],
    enabled: item?.category === 'album',
    staleTime: 60 * 60 * 1000,
    retry: false,
    queryFn: async (): Promise<Album | null> => {
      const { data, error } = await supabase.rpc('album_catalog_for', {
        p_source: item!.source ?? 'manual',
        p_external_id: item!.external_id ?? '',
        p_title: item!.title,
        p_artist: (item!.subtitle ?? '').split(',')[0] ?? '',
      })
      if (error) {
        if (isMissingAcervo(error)) return null
        throw error
      }
      const rows = toAlbums(data as unknown[])
      return rows[0] ?? null
    },
  })
}

export function useAlbumSimilar(id: string | undefined) {
  return useQuery({
    queryKey: ['albuns', 'parecidos', id],
    enabled: Boolean(id),
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('album_similar', { p_id: id!, p_limit: 12 })
      if (error) throw error
      return toAlbums(data as unknown[])
    },
  })
}

export interface AlbumPositions {
  no_ano: number
  no_ano_total: number
  na_decada: number
  na_decada_total: number
  no_genero: number
  no_genero_total: number
  geral: number
  geral_total: number
}

export function useAlbumPositions(id: string | undefined) {
  return useQuery({
    queryKey: ['albuns', 'posicoes', id],
    enabled: Boolean(id),
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('album_positions', { p_id: id! })
      if (error) throw error
      return ((data as AlbumPositions[] | null) ?? [])[0] ?? null
    },
  })
}

/** Abre o álbum: cria o item na primeira vez (como na busca) e vai para a página dele. */
export function useOpenAlbum() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: async (a: Album) => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error(t('Sessão expirada. Entre de novo.'))
      return ensureCatalogItem(albumToResult(a), auth.user.id)
    },
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: ['search'] })
      navigate(`/item/${id}`)
    },
  })
}

/** Álbuns que você já registrou, como "fonte:id" (para o ✓ nas paradas). */
export function useMyAlbumKeys(userId: string | null) {
  return useQuery({
    queryKey: ['albuns', 'meus', userId],
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('item:items!inner ( source, external_id, category )')
        .eq('user_id', userId!)
        .eq('item.category', 'album')
        .limit(5000)
      if (error) throw error
      const keys = new Set<string>()
      for (const r of (data ?? []) as unknown as { item: { source: string; external_id: string | null } }[]) {
        if (r.item?.external_id) keys.add(`${r.item.source}:${r.item.external_id}`)
      }
      return keys
    },
  })
}

export const albumKey = (a: Album) => (a.mbid ? `musicbrainz:${a.mbid}` : `acervo:${a.id}`)

// ---------------------------------------------------------------- números (arquivos estáticos do script)

export interface AlbumStats {
  versao: string
  total: number
  media: number
  peso: number
  n_generos: number
  n_artistas: number
  anos: { ano: number; n: number; media: number; top100: number | null }[]
  decadas: { d: number; n: number; top: [string, number][] }[]
  hist: [number, number][]
  generos_top: { g: string; n: number; media: number; dec: number[] }[]
  artistas: { s: string; nome: string; n: number; melhor: number; ini: number; fim: number }[]
}

export interface GenreInfo {
  g: string
  n: number
  sec: number
  media: number
  ini: number
  pico: number
  dec: number[]
  viz: string[]
  art: [string, string][]
}

export interface GenreIndex {
  versao: string
  decadas: number[]
  generos: GenreInfo[]
  so_sec: [string, number][]
}

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(path)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return (await r.json()) as T
}

export function useAlbumStats() {
  return useQuery({ queryKey: ['albuns', 'estatisticas'], staleTime: Infinity, queryFn: () => getJson<AlbumStats>('/albuns/estatisticas.json') })
}

export function useGenreIndex(enabled = true) {
  return useQuery({ queryKey: ['albuns', 'generos'], enabled, staleTime: Infinity, queryFn: () => getJson<GenreIndex>('/albuns/generos.json') })
}

export const genrePath = (g: string) => `/albuns/genero/${encodeURIComponent(g)}`
export const artistPath = (slug: string) => `/albuns/artista/${encodeURIComponent(slug)}`
