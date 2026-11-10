// F2: "quero ver", notas privadas, ♥ no item e streamings que a pessoa assina.
// As regras de quem vê o quê ficam no banco (RLS); aqui só pedimos.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CategoryId } from './categories'
import { supabase } from './supabase'
import type { Profile, Review, UserService, Visibility, WatchlistRow } from './types'

import { locale, t } from './i18n'
const PROFILE_FIELDS = 'id, username, display_name, avatar_url'

/** Botão do "quero ..." por categoria: "Quero ver", "Quero ouvir"… */
export const WANT_LABEL: Record<CategoryId, string> = {
  album: t('Quero ouvir'),
  filme: t('Quero ver'),
  serie: t('Quero ver'),
  jogo: t('Quero jogar'),
  livro: t('Quero ler'),
  bar: t('Quero ir'),
  banheiro: t('Quero conhecer'),
  cidade: t('Quero conhecer'),
  drink: t('Quero provar'),
  prato: t('Quero provar'),
  restaurante: t('Quero ir'),
  cafe: t('Quero ir'),
}

/** Verbo do registro por categoria: "Vi", "Ouvi", "Joguei"... */
export const DID_VERB: Record<CategoryId, string> = {
  album: t('Ouvi'),
  filme: t('Vi'),
  serie: t('Vi'),
  jogo: t('Joguei'),
  livro: t('Li'),
  bar: t('Fui'),
  banheiro: t('Usei'),
  cidade: t('Fui'),
  drink: t('Provei'),
  prato: t('Provei'),
  restaurante: t('Fui'),
  cafe: t('Fui'),
}

// ---------- Quero ver ----------

// providers do streaming vêm da ficha do TMDB guardada em items.metadata (F1), quando existir
const WATCHLIST_ITEM = `item:items!inner ( id, category, title, subtitle, image_url, year, source, providers:metadata->tmdb->providers )`

/** Lista "quero ver" de uma pessoa (a sua ou a de um amigo, conforme a visibilidade). */
export function useWatchlist(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['watchlist', 'user', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('watchlist')
        .select(`user_id, item_id, visibility, created_at, ${WATCHLIST_ITEM}`)
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as WatchlistRow[]
    },
  })
}

/** Quem quer ver este item (você e os amigos que deixaram visível). */
export function useItemWatchers(itemId: string | undefined) {
  return useQuery({
    queryKey: ['watchlist', 'item', itemId],
    enabled: Boolean(itemId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('watchlist')
        .select(`user_id, item_id, visibility, created_at, person:profiles!watchlist_user_id_fkey ( ${PROFILE_FIELDS} )`)
        .eq('item_id', itemId!)
      if (error) throw error
      return (data ?? []) as unknown as (Omit<WatchlistRow, 'item'> & { person: Profile })[]
    },
  })
}

export function useToggleWatchlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, on, visibility = 'amigos' }: { itemId: string; on: boolean; visibility?: Visibility }) => {
      const { data: auth } = await supabase.auth.getUser()
      const uid = auth.user?.id
      if (!uid) throw new Error(t('Sessão expirada. Entre de novo.'))
      if (on) {
        const { error } = await supabase.from('watchlist').upsert({ user_id: uid, item_id: itemId, visibility })
        if (error) throw error
      } else {
        const { error } = await supabase.from('watchlist').delete().eq('user_id', uid).eq('item_id', itemId)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  })
}

// ---------- ♥ no item ----------

/** Liga ou desliga o ♥ na sua entrada mais recente do item. */
export function useToggleLoved() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ review, loved }: { review: Review; loved: boolean }) => {
      const { error } = await supabase.from('reviews').update({ loved }).eq('id', review.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['item-reviews'] })
      qc.invalidateQueries({ queryKey: ['user-reviews'] })
      qc.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}

// ---------- Nota privada ----------

export function useEntryNote(reviewId: string | undefined) {
  return useQuery({
    queryKey: ['entry-note', reviewId],
    enabled: Boolean(reviewId),
    queryFn: async () => {
      const { data, error } = await supabase.from('entry_notes').select('body').eq('review_id', reviewId!).maybeSingle()
      if (error) throw error
      return (data?.body as string | undefined) ?? ''
    },
  })
}

/** Suas notas privadas de várias entradas de uma vez (página do item). */
export function useMyNotes(reviewIds: string[]) {
  return useQuery({
    queryKey: ['entry-note', 'many', reviewIds],
    enabled: reviewIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('entry_notes').select('review_id, body').in('review_id', reviewIds)
      if (error) throw error
      return Object.fromEntries((data ?? []).map((n) => [n.review_id as string, n.body as string])) as Record<string, string>
    },
  })
}

// ---------- Meus streamings ----------

export function useMyServices() {
  return useQuery({
    queryKey: ['services'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('user_services').select('provider_id, name, logo_path').order('name')
      if (error) throw error
      return (data ?? []) as UserService[]
    },
  })
}

export function useToggleService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ service, on }: { service: UserService; on: boolean }) => {
      const { data: auth } = await supabase.auth.getUser()
      const uid = auth.user?.id
      if (!uid) throw new Error(t('Sessão expirada. Entre de novo.'))
      if (on) {
        const { error } = await supabase
          .from('user_services')
          .upsert({ user_id: uid, provider_id: service.provider_id, name: service.name, logo_path: service.logo_path })
        if (error) throw error
      } else {
        const { error } = await supabase.from('user_services').delete().eq('user_id', uid).eq('provider_id', service.provider_id)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  })
}

// ---------- utilidades ----------

/** "2026-11-06" -> "6 de nov." (com ano quando não é o ano atual) */
export function formatDay(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const sameYear = y === new Date().getFullYear()
  return date.toLocaleDateString(locale(), { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
}

/** Data local de hoje / ontem no formato do banco (AAAA-MM-DD). */
export function localDay(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
