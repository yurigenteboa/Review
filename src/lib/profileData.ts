// Etapa 2 do perfil: favoritos, "agora", metas, Top 10, fotos de perfil/capa e links.
// Regras de quem vê o quê ficam no banco (migração 202611061930_perfil_etapa2.sql).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CategoryId } from './categories'
import { compressImage } from './images'
import { supabase } from './supabase'
import type { Item, Visibility } from './types'

const ITEM_FIELDS = 'id, category, title, subtitle, image_url, year'
export const PROFILE_MEDIA_BUCKET = 'profile-media'

export interface ProfileLink {
  label: string
  url: string
}

export interface FavoriteRow {
  category: CategoryId
  position: number
  visibility: Visibility
  item: Item
}

export interface NowRow {
  category: CategoryId
  set_at: string
  visibility: Visibility
  item: Item
}

export interface GoalRow {
  id: string
  year: number
  category: CategoryId | null
  target: number
  visibility: Visibility
}

export interface RankingRow {
  year: number
  category: CategoryId
  position: number
  visibility: Visibility
  item: Item
}

const invalidate = (qc: ReturnType<typeof useQueryClient>, key: string) => qc.invalidateQueries({ queryKey: [key] })

// ---------- Favoritos ----------

export function useFavorites(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['favorites', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('favorites')
        .select(`category, position, visibility, item:items!inner ( ${ITEM_FIELDS} )`)
        .eq('user_id', userId!)
        .order('category')
        .order('position')
      if (error) throw error
      return (data ?? []) as unknown as FavoriteRow[]
    },
  })
}

/** Coloca o item na posição (1 a 4) da categoria. Se ele já estava em outra posição, sai de lá. */
export function useSetFavorite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { userId: string; category: CategoryId; position: number; itemId: string }) => {
      const del = await supabase.from('favorites').delete().eq('user_id', p.userId).eq('item_id', p.itemId)
      if (del.error) throw del.error
      const { error } = await supabase
        .from('favorites')
        .upsert({ user_id: p.userId, category: p.category, position: p.position, item_id: p.itemId }, { onConflict: 'user_id,category,position' })
      if (error) throw error
    },
    onSuccess: () => invalidate(qc, 'favorites'),
  })
}

export function useRemoveFavorite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { userId: string; category: CategoryId; position: number }) => {
      const { error } = await supabase.from('favorites').delete().eq('user_id', p.userId).eq('category', p.category).eq('position', p.position)
      if (error) throw error
    },
    onSuccess: () => invalidate(qc, 'favorites'),
  })
}

// ---------- Agora ----------

/** Depois de 60 dias sem mudar, o "agora" some do perfil (o dono vê um lembrete). */
export const NOW_STALE_DAYS = 60
export const isStale = (iso: string) => Date.now() - new Date(iso).getTime() > NOW_STALE_DAYS * 86_400_000

export function useNow(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['now', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_now')
        .select(`category, set_at, visibility, item:items!inner ( ${ITEM_FIELDS} )`)
        .eq('user_id', userId!)
        .order('set_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as NowRow[]
    },
  })
}

export function useSetNow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { userId: string; category: CategoryId; itemId: string }) => {
      const { error } = await supabase
        .from('profile_now')
        .upsert({ user_id: p.userId, category: p.category, item_id: p.itemId, set_at: new Date().toISOString() }, { onConflict: 'user_id,category' })
      if (error) throw error
    },
    onSuccess: () => invalidate(qc, 'now'),
  })
}

export function useClearNow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { userId: string; category: CategoryId }) => {
      const { error } = await supabase.from('profile_now').delete().eq('user_id', p.userId).eq('category', p.category)
      if (error) throw error
    },
    onSuccess: () => invalidate(qc, 'now'),
  })
}

// ---------- Metas ----------

export function useGoals(userId: string | null | undefined, year: number) {
  return useQuery({
    queryKey: ['goals', userId, year],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('goals')
        .select('id, year, category, target, visibility')
        .eq('user_id', userId!)
        .eq('year', year)
      if (error) throw error
      return (data ?? []) as GoalRow[]
    },
  })
}

export function useSaveGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { id?: string; year: number; category: CategoryId | null; target: number; visibility: Visibility }) => {
      const row = { year: p.year, category: p.category, target: p.target, visibility: p.visibility }
      const { error } = p.id ? await supabase.from('goals').update(row).eq('id', p.id) : await supabase.from('goals').insert(row)
      if (error) {
        if (error.code === '23505') throw new Error('Já existe uma meta para isso neste ano.')
        throw error
      }
    },
    onSuccess: () => invalidate(qc, 'goals'),
  })
}

export function useDeleteGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('goals').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidate(qc, 'goals'),
  })
}

// ---------- Top 10 ----------

export function useRankings(userId: string | null | undefined, year: number) {
  return useQuery({
    queryKey: ['rankings', userId, year],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rankings')
        .select(`year, category, position, visibility, item:items!inner ( ${ITEM_FIELDS} )`)
        .eq('user_id', userId!)
        .eq('year', year)
        .order('category')
        .order('position')
      if (error) throw error
      return (data ?? []) as unknown as RankingRow[]
    },
  })
}

/** Grava o Top 10 inteiro de uma vez (a função do banco apaga e regrava). */
export function useSaveRanking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { year: number; category: CategoryId; itemIds: string[]; visibility: Visibility }) => {
      const { error } = await supabase.rpc('save_ranking', {
        p_year: p.year,
        p_category: p.category,
        p_items: p.itemIds,
        p_visibility: p.visibility,
      })
      if (error) throw error
    },
    onSuccess: () => invalidate(qc, 'rankings'),
  })
}

// ---------- Sua média x amigos ----------

export function useRatingVsFriends(category: CategoryId | null, enabled: boolean) {
  return useQuery({
    queryKey: ['rating-vs-friends', category],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('rating_vs_friends', { p_category: category })
      if (error) throw error
      const row = (data as { my_avg: number | null; my_count: number | null; friends_counted: number; friends_more_generous: number }[] | null)?.[0]
      return row ?? null
    },
  })
}

/**
 * Rótulo "Mais exigente que 80% dos amigos" (ou generoso). Só com 3+ amigos com 5+ notas,
 * e só quando a diferença é clara (80% ou mais de um lado).
 */
export function friendsLabel(r: { my_avg: number | null; friends_counted: number; friends_more_generous: number } | null | undefined): string | null {
  if (!r || r.my_avg == null || r.friends_counted < 3) return null
  const stricter = r.friends_more_generous / r.friends_counted
  if (stricter >= 0.8) return `Mais exigente que ${Math.round(stricter * 100)}% dos amigos`
  if (stricter <= 0.2) return `Mais generoso que ${Math.round((1 - stricter) * 100)}% dos amigos`
  return null
}

// ---------- Fotos, capa, links, vitrine ----------

/**
 * Envia a foto de perfil ou a capa: reduz no aparelho (WebP), sobe para profile-media/<id>/,
 * grava o link público no perfil e apaga a versão anterior.
 */
export function useUploadProfileImage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { userId: string; kind: 'avatar' | 'cover'; file: File }) => {
      const blob = await compressImage(p.file, p.kind === 'avatar' ? 512 : 1600, 0.85)
      const name = `${p.userId}/${p.kind}-${crypto.randomUUID()}.webp`
      const up = await supabase.storage.from(PROFILE_MEDIA_BUCKET).upload(name, blob, { contentType: 'image/webp', cacheControl: '31536000' })
      if (up.error) throw up.error
      const url = supabase.storage.from(PROFILE_MEDIA_BUCKET).getPublicUrl(name).data.publicUrl
      const patch = p.kind === 'avatar' ? { avatar_url: url } : { cover_url: url, cover_mode: 'foto' }
      const { error } = await supabase.from('profiles').update(patch).eq('id', p.userId)
      if (error) throw error
      await removeOldImages(p.userId, p.kind, name)
    },
    onSuccess: () => qc.invalidateQueries(),
  })
}

/** Apaga as versões antigas daquele tipo (avatar-*, cover-*) na pasta da pessoa. */
async function removeOldImages(userId: string, kind: 'avatar' | 'cover', keep: string | null) {
  const { data } = await supabase.storage.from(PROFILE_MEDIA_BUCKET).list(userId)
  const old = (data ?? []).map((f) => `${userId}/${f.name}`).filter((n) => n.startsWith(`${userId}/${kind}-`) && n !== keep)
  if (old.length) await supabase.storage.from(PROFILE_MEDIA_BUCKET).remove(old)
}

export function useRemoveProfileImage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { userId: string; kind: 'avatar' | 'cover' }) => {
      const patch = p.kind === 'avatar' ? { avatar_url: null } : { cover_url: null, cover_mode: 'auto' }
      const { error } = await supabase.from('profiles').update(patch).eq('id', p.userId)
      if (error) throw error
      await removeOldImages(p.userId, p.kind, null)
    },
    onSuccess: () => qc.invalidateQueries(),
  })
}

export function useSaveProfileExtras() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { userId: string; links?: ProfileLink[]; showcase?: CategoryId[]; cover_mode?: 'auto' | 'foto'; is_public?: boolean }) => {
      const patch: Record<string, unknown> = {}
      if (p.links) patch.links = p.links
      if (p.showcase) patch.showcase = p.showcase
      if (p.cover_mode) patch.cover_mode = p.cover_mode
      if (p.is_public !== undefined) patch.is_public = p.is_public
      const { error } = await supabase.from('profiles').update(patch).eq('id', p.userId)
      if (error) {
        if (error.code === '23514') throw new Error('Confira os links: só endereços que começam com https://, até 5.')
        throw error
      }
    },
    onSuccess: () => qc.invalidateQueries(),
  })
}

/** Aceita "letterboxd.com/yuri" e completa com https://. Devolve null se não parecer um link. */
export function normalizeUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  const withScheme = /^https?:\/\//i.test(t) ? t.replace(/^http:\/\//i, 'https://') : `https://${t}`
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'https:' || !u.hostname.includes('.') || /[\s<>"]/.test(withScheme) || withScheme.length > 300) return null
    return u.toString()
  } catch {
    return null
  }
}

/** "https://www.letterboxd.com/yuri/" -> "letterboxd.com" */
export const linkDomain = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
