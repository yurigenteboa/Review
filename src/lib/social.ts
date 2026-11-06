// Amizades, convites, curtidas, comentários, notificações e comparação de gosto.
// As regras ficam no banco (RLS + funções); aqui só chamamos.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Comment, FriendRow, Notification, Profile, TasteRow } from './types'

const PROFILE_FIELDS = 'id, username, display_name, avatar_url'

// ---------- Amizades ----------

export function useFriends() {
  return useQuery({
    queryKey: ['friends'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_friends')
      if (error) throw error
      return (data ?? []) as FriendRow[]
    },
  })
}

/** Estado da amizade com uma pessoa específica, a partir da lista. */
export function useFriendState(otherId: string | undefined) {
  const { data } = useFriends()
  const row = data?.find((f) => f.id === otherId)
  if (!row) return 'nenhuma' as const
  if (row.status === 'aceita') return 'amigos' as const
  return row.requested_by_me ? ('enviado' as const) : ('recebido' as const)
}

function invalidateSocial(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['friends'] })
  qc.invalidateQueries({ queryKey: ['feed'] })
  qc.invalidateQueries({ queryKey: ['user-reviews'] })
  qc.invalidateQueries({ queryKey: ['notifications'] })
  qc.invalidateQueries({ queryKey: ['taste'] })
}

export function useRequestFriend() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (target: string) => {
      const { data, error } = await supabase.rpc('request_friend', { target })
      if (error) throw error
      return data as 'pedido_enviado' | 'aceita' | 'pendente' | 'ja_amigos'
    },
    onSuccess: () => invalidateSocial(qc),
  })
}

export function useRespondFriend() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ other, accept }: { other: string; accept: boolean }) => {
      const { error } = await supabase.rpc('respond_friend', { other, accept })
      if (error) throw error
    },
    onSuccess: () => invalidateSocial(qc),
  })
}

export function useRemoveFriend() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (other: string) => {
      const { error } = await supabase.rpc('remove_friend', { other })
      if (error) throw error
    },
    onSuccess: () => invalidateSocial(qc),
  })
}

export function useSearchPeople(term: string) {
  const t = term.trim().replace(/^@/, '').replace(/[%_,()]/g, '')
  return useQuery({
    queryKey: ['people', t.toLowerCase()],
    enabled: t.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_FIELDS)
        .or(`username.ilike.%${t}%,display_name.ilike.%${t}%`)
        .limit(20)
      if (error) throw error
      return (data ?? []) as Profile[]
    },
  })
}

export function useProfile(id: string | undefined) {
  return useQuery({
    queryKey: ['profile', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select(PROFILE_FIELDS).eq('id', id!).single()
      if (error) throw error
      return data as Profile
    },
  })
}

// ---------- Convites ----------

export function useInviteCode() {
  return useQuery({
    queryKey: ['invite-code'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_invite_code')
      if (error) throw error
      return data as string
    },
  })
}

export function useResetInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('reset_invite_code')
      if (error) throw error
      return data as string
    },
    onSuccess: (code) => qc.setQueryData(['invite-code'], code),
  })
}

export const inviteUrl = (code: string) => `${window.location.origin}/convite/${code}`

export async function inviteOwner(code: string) {
  const { data } = await supabase.rpc('invite_owner', { invite: code })
  return ((data ?? []) as { id: string; display_name: string | null; username: string | null }[])[0] ?? null
}

export async function acceptInvite(code: string) {
  const { data, error } = await supabase.rpc('accept_invite', { invite: code })
  if (error) throw error
  return data as string
}

/** Guarda o código enquanto a pessoa faz login (o link abre antes de existir sessão). */
export const PENDING_INVITE_KEY = 'mmisc.pendingInvite'
export const savePendingInvite = (code: string) => {
  try {
    localStorage.setItem(PENDING_INVITE_KEY, code)
  } catch {
    /* modo privado: segue sem guardar */
  }
}
export const takePendingInvite = (): string | null => {
  try {
    const c = localStorage.getItem(PENDING_INVITE_KEY)
    localStorage.removeItem(PENDING_INVITE_KEY)
    return c
  } catch {
    return null
  }
}
export const peekPendingInvite = (): string | null => {
  try {
    return localStorage.getItem(PENDING_INVITE_KEY)
  } catch {
    return null
  }
}

// ---------- Curtidas ----------

export function useToggleLike() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ reviewId, liked, uid }: { reviewId: string; liked: boolean; uid: string }) => {
      if (liked) {
        const { error } = await supabase.from('likes').delete().eq('review_id', reviewId).eq('user_id', uid)
        if (error) throw error
      } else {
        const { error } = await supabase.from('likes').insert({ review_id: reviewId, user_id: uid })
        if (error && error.code !== '23505') throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['item-reviews'] })
      qc.invalidateQueries({ queryKey: ['user-reviews'] })
    },
  })
}

// ---------- Comentários ----------

export function useComments(reviewId: string | null) {
  return useQuery({
    queryKey: ['comments', reviewId],
    enabled: Boolean(reviewId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comments')
        .select(`id, review_id, user_id, body, created_at, author:profiles!comments_user_id_fkey ( ${PROFILE_FIELDS} )`)
        .eq('review_id', reviewId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as Comment[]
    },
  })
}

export function useAddComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ reviewId, body, uid }: { reviewId: string; body: string; uid: string }) => {
      const { error } = await supabase.from('comments').insert({ review_id: reviewId, body: body.trim(), user_id: uid })
      if (error) throw error
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['comments', v.reviewId] })
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['item-reviews'] })
    },
  })
}

export function useDeleteComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (c: Comment) => {
      const { error } = await supabase.from('comments').delete().eq('id', c.id)
      if (error) throw error
    },
    onSuccess: (_d, c) => {
      qc.invalidateQueries({ queryKey: ['comments', c.review_id] })
      qc.invalidateQueries({ queryKey: ['feed'] })
    },
  })
}

// ---------- Notificações ----------

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select(
          `id, type, created_at, read_at, review_id,
           actor:profiles!notifications_actor_id_fkey ( ${PROFILE_FIELDS} ),
           review:reviews ( id, item:items ( id, title ) ),
           comment:comments ( body )`,
        )
        .order('created_at', { ascending: false })
        .limit(60)
      if (error) throw error
      return (data ?? []) as unknown as Notification[]
    },
  })
}

export function useUnreadCount() {
  const { data } = useNotifications()
  return (data ?? []).filter((n) => !n.read_at).length
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

// ---------- Comparação de gosto ----------

export function useTasteMatch(otherId: string | undefined) {
  return useQuery({
    queryKey: ['taste', otherId],
    enabled: Boolean(otherId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('taste_match', { other: otherId })
      if (error) throw error
      const rows = ((data ?? []) as TasteRow[]).map((r) => ({ ...r, my_rating: Number(r.my_rating), their_rating: Number(r.their_rating) }))
      // concordância: diferença média de nota convertida em 0-100% (0 de diferença = 100%, 4,5 = 0%)
      const score = rows.length
        ? Math.round(100 - (rows.reduce((s, r) => s + Math.abs(r.my_rating - r.their_rating), 0) / rows.length / 4.5) * 100)
        : null
      return { rows, score }
    },
  })
}
