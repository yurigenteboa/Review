// Todas as leituras e escritas no Supabase passam por aqui.
// As regras de quem vê o quê estão no banco (RLS): o app só pede, o banco filtra.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CategoryId } from './categories'
import { compressImage } from './images'
import { PHOTO_BUCKET, supabase } from './supabase'
import type { Item, Profile, Review, Visibility } from './types'

const REVIEW_SELECT = `
  id, user_id, rating, body, criteria_scores, visibility, created_at,
  item:items!inner ( id, category, title, subtitle, image_url, year ),
  author:profiles!inner ( id, username, display_name, avatar_url ),
  photos:review_photos ( storage_path, position )
`

// O Postgres devolve numeric como string; aqui vira número.
const normalize = (rows: unknown[]): Review[] =>
  (rows as Review[]).map((r) => ({ ...r, rating: Number(r.rating) }))

// ---------- Leituras ----------

/** Feed: tudo que você pode ver (suas reviews + amigos + públicas), mais recentes primeiro. */
export function useFeed(category: CategoryId | 'all') {
  return useQuery({
    queryKey: ['feed', category],
    queryFn: async () => {
      let q = supabase.from('reviews').select(REVIEW_SELECT).order('created_at', { ascending: false }).limit(50)
      if (category !== 'all') q = q.eq('item.category', category)
      const { data, error } = await q
      if (error) throw error
      return normalize(data ?? [])
    },
  })
}

export function useUserReviews(userId: string | null) {
  return useQuery({
    queryKey: ['user-reviews', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select(REVIEW_SELECT)
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return normalize(data ?? [])
    },
  })
}

export function useItem(id: string | undefined) {
  return useQuery({
    queryKey: ['item', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('id, category, title, subtitle, image_url, year')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as Item
    },
  })
}

export function useItemReviews(itemId: string | undefined) {
  return useQuery({
    queryKey: ['item-reviews', itemId],
    enabled: Boolean(itemId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select(REVIEW_SELECT)
        .eq('item_id', itemId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return normalize(data ?? [])
    },
  })
}

/** Busca no catálogo já cadastrado (as APIs externas entram na Fase 3). */
export function useSearchItems(term: string, category: CategoryId | 'all') {
  const t = term.trim()
  return useQuery({
    queryKey: ['search', t, category],
    queryFn: async () => {
      let q = supabase
        .from('items')
        .select('id, category, title, subtitle, image_url, year, source, external_id')
        .order('created_at', { ascending: false })
        .limit(30)
      if (t) q = q.ilike('title', `%${t.replace(/[%_]/g, '')}%`)
      if (category !== 'all') q = q.eq('category', category)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Item[]
    },
  })
}

export function useMyProfile(userId: string | null) {
  return useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .eq('id', userId!)
        .single()
      if (error) throw error
      return data as Profile
    },
  })
}

/** Fotos ficam em armazenamento privado: o app pede links temporários (1 h). */
export function usePhotoUrls(paths: string[]) {
  return useQuery({
    queryKey: ['photo-urls', paths],
    enabled: paths.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600)
      if (error) throw error
      return (data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[]
    },
  })
}

// ---------- Catálogo externo (Edge Function "catalog-search") ----------

export interface CatalogResult {
  source: string
  external_id: string
  category: CategoryId
  title: string
  subtitle: string | null
  image_url: string | null
  year: number | null
  lat: number | null
  lng: number | null
  metadata: Record<string, unknown>
}

interface CatalogResponse {
  results: CatalogResult[]
  missingKey?: string
  error?: string
}

/**
 * Busca nas fontes externas (TMDB, MusicBrainz, IGDB, Open Library, OpenStreetMap, IBGE).
 * Para bar e banheiro, `near` permite buscar "perto de mim" sem texto.
 */
export function useCatalogSearch(
  category: CategoryId | 'all',
  term: string,
  near?: { lat: number; lng: number } | null,
) {
  const q = term.trim()
  const placeCat = category === 'bar' || category === 'banheiro'
  const enabled = category !== 'all' && (q.length >= 2 || (placeCat && Boolean(near)))
  return useQuery({
    queryKey: ['catalog', category, q.toLowerCase(), near?.lat, near?.lng],
    enabled,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<CatalogResponse> => {
      const { data, error } = await supabase.functions.invoke<CatalogResponse>('catalog-search', {
        body: { category, q, lat: placeCat ? near?.lat : undefined, lng: placeCat ? near?.lng : undefined },
      })
      if (error) throw error
      return data ?? { results: [] }
    },
  })
}

/** Garante que o resultado externo exista na tabela items e devolve o id. */
export async function ensureCatalogItem(r: CatalogResult, uid: string): Promise<string> {
  const { data: found } = await supabase
    .from('items')
    .select('id')
    .eq('source', r.source)
    .eq('external_id', r.external_id)
    .maybeSingle()
  if (found) return found.id
  const { data, error } = await supabase
    .from('items')
    .insert({
      category: r.category,
      title: r.title,
      subtitle: r.subtitle,
      image_url: r.image_url,
      year: r.year,
      source: r.source,
      external_id: r.external_id,
      lat: r.lat,
      lng: r.lng,
      metadata: r.metadata ?? {},
      created_by: uid,
    })
    .select('id')
    .single()
  if (error) {
    // outra pessoa cadastrou o mesmo item no mesmo instante
    if (error.code === '23505') {
      const { data: again } = await supabase.from('items').select('id').eq('source', r.source).eq('external_id', r.external_id).single()
      if (again) return again.id
    }
    throw error
  }
  return data.id
}

export function useOpenCatalogItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (r: CatalogResult) => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error('Sessão expirada. Entre de novo.')
      return ensureCatalogItem(r, auth.user.id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['search'] }),
  })
}

// ---------- Escritas ----------

export interface NewReview {
  category: CategoryId
  /** item já existente escolhido na lista; se vazio, cria (ou reaproveita) pelo título */
  itemId?: string
  /** resultado vindo das APIs externas, cadastrado no catálogo na hora de publicar */
  external?: CatalogResult
  title: string
  subtitle?: string
  rating: number
  body: string
  criteria: Record<string, number>
  visibility: Visibility
  photos: File[]
}

export function useCreateReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewReview) => {
      const { data: auth } = await supabase.auth.getUser()
      const uid = auth.user?.id
      if (!uid) throw new Error('Sessão expirada. Entre de novo.')

      // 1. Item: usa o escolhido, reaproveita um manual com o mesmo nome ou cria um novo
      let itemId = input.itemId
      if (!itemId && input.external) itemId = await ensureCatalogItem(input.external, uid)
      if (!itemId) {
        const title = input.title.trim()
        const { data: existing } = await supabase
          .from('items')
          .select('id')
          .eq('category', input.category)
          .ilike('title', title.replace(/[%_]/g, ''))
          .limit(1)
        itemId = existing?.[0]?.id
        if (!itemId) {
          const { data: created, error } = await supabase
            .from('items')
            .insert({ category: input.category, title, subtitle: input.subtitle?.trim() || null, created_by: uid })
            .select('id')
            .single()
          if (error) throw error
          itemId = created.id
        }
      }

      // 2. Review (se você já avaliou esse item, atualiza a sua review)
      const { data: review, error: reviewError } = await supabase
        .from('reviews')
        .upsert(
          {
            user_id: uid,
            item_id: itemId,
            rating: input.rating,
            body: input.body.trim() || null,
            criteria_scores: input.criteria,
            visibility: input.visibility,
          },
          { onConflict: 'user_id,item_id' },
        )
        .select('id')
        .single()
      if (reviewError) throw reviewError

      // 3. Fotos: comprime no aparelho, envia para a pasta do usuário e registra
      for (const [i, file] of input.photos.entries()) {
        const blob = await compressImage(file)
        const path = `${uid}/${review.id}/${crypto.randomUUID()}.webp`
        const { error: upErr } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(path, blob, { contentType: 'image/webp' })
        if (upErr) throw upErr
        const { error: phErr } = await supabase.from('review_photos').insert({ review_id: review.id, storage_path: path, position: i })
        if (phErr) throw phErr
      }

      return { reviewId: review.id, itemId }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['user-reviews'] })
      qc.invalidateQueries({ queryKey: ['item-reviews'] })
      qc.invalidateQueries({ queryKey: ['search'] })
    },
  })
}

export function useDeleteReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (review: Review) => {
      const paths = review.photos.map((p) => p.storage_path)
      if (paths.length) await supabase.storage.from(PHOTO_BUCKET).remove(paths)
      const { error } = await supabase.from('reviews').delete().eq('id', review.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries(),
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { id: string; display_name: string; username: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: p.display_name.trim() || null, username: p.username.trim().toLowerCase() || null })
        .eq('id', p.id)
      if (error) {
        if (error.code === '23505') throw new Error('Esse @ já está em uso.')
        if (error.code === '23514') throw new Error('O @ precisa ter de 3 a 24 letras minúsculas, números, ponto ou _.')
        throw error
      }
    },
    onSuccess: () => qc.invalidateQueries(),
  })
}
