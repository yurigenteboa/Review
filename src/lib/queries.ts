// Todas as leituras e escritas no Supabase passam por aqui.
// As regras de quem vê o quê estão no banco (RLS): o app só pede, o banco filtra.
import { locale, t } from './i18n'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PLACE_SEARCH, type CategoryId } from './categories'
import { compressImage } from './images'
import { PHOTO_BUCKET, supabase } from './supabase'
import type { ChildEntry, ChildItem, Item, Profile, Review, Visibility, WatchedWhere } from './types'

export const REVIEW_SELECT = `
  id, user_id, rating, body, criteria_scores, visibility, created_at,
  experienced_at, rewatch, loved, spoiler, watched_where, parent_review_id,
  item:items!inner ( id, category, title, subtitle, image_url, year, parent_id ),
  author:profiles!reviews_user_id_fkey ( id, username, display_name, avatar_url ),
  photos:review_photos ( storage_path, position ),
  companions:entry_companions ( user:profiles ( id, username, display_name, avatar_url ) ),
  likes ( user_id ),
  comments ( count )
`

// O Postgres devolve numeric como string; aqui vira número (vazio continua vazio = "vi sem nota").
export const normalize = (rows: unknown[]): Review[] =>
  (rows as Review[]).map((r) => ({ ...r, rating: r.rating == null ? null : Number(r.rating) }))

/**
 * Diário: a mesma pessoa pode ter várias entradas do mesmo item.
 * Para médias, histograma e "amigos que viram", vale a entrada mais recente de cada pessoa.
 */
export function latestPerPerson(list: Review[]): Review[] {
  const seen = new Map<string, Review>()
  for (const r of sortDiary(list)) if (!seen.has(r.user_id)) seen.set(r.user_id, r)
  return [...seen.values()]
}

/** Mais recentes primeiro: data em que viu, depois a hora do registro. */
export function sortDiary(list: Review[]): Review[] {
  return [...list].sort((a, b) =>
    a.experienced_at === b.experienced_at ? b.created_at.localeCompare(a.created_at) : b.experienced_at.localeCompare(a.experienced_at),
  )
}

/** Média só das entradas com nota (as mais recentes de cada pessoa). */
export function averageRating(list: Review[]): { avg: number; n: number } {
  const rated = latestPerPerson(list).filter((r): r is Review & { rating: number } => r.rating != null)
  return { avg: rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : 0, n: rated.length }
}

// ---------- Fase 1: coisas dentro de coisas ----------

/**
 * Anexa a cada entrada as filhas dela (o que foi pedido na noite), numa consulta só.
 * Consulta separada de propósito: o banco decide pela RLS quais filhas você vê (as mesmas da mãe).
 */
export async function attachChildren(list: Review[]): Promise<Review[]> {
  const ids = list.filter((r) => !r.parent_review_id).map((r) => r.id)
  if (!ids.length) return list
  const { data, error } = await supabase
    .from('reviews')
    .select('id, parent_review_id, rating, item:items!inner ( id, title, category )')
    .in('parent_review_id', ids)
    .order('created_at', { ascending: true })
  if (error) throw error
  const byParent = new Map<string, ChildEntry[]>()
  for (const c of (data ?? []) as unknown as ChildEntry[]) {
    const entry = { ...c, rating: c.rating == null ? null : Number(c.rating) }
    byParent.set(c.parent_review_id, [...(byParent.get(c.parent_review_id) ?? []), entry])
  }
  return list.map((r) => (byParent.has(r.id) ? { ...r, children: byParent.get(r.id) } : r))
}

/** Preenche `parent_title` ("no Bar Brahma") nos itens que moram em outro. */
export async function attachParentTitles<T extends Item>(items: T[]): Promise<T[]> {
  const ids = [...new Set(items.map((i) => i.parent_id).filter((x): x is string => Boolean(x)))]
  if (!ids.length) return items
  const { data } = await supabase.from('items').select('id, title').in('id', ids)
  const names = new Map((data ?? []).map((p: { id: string; title: string }) => [p.id, p.title]))
  return items.map((i) => (i.parent_id ? { ...i, parent_title: names.get(i.parent_id) ?? null } : i))
}

/** O que mora num lugar, com média (entrada mais recente de cada pessoa) e quantos registraram. */
export function useChildItems(parentId: string | undefined) {
  return useQuery({
    queryKey: ['child-items', parentId],
    enabled: Boolean(parentId),
    queryFn: async (): Promise<ChildItem[]> => {
      const { data, error } = await supabase
        .from('items')
        .select('id, title, category, reviews ( user_id, rating, experienced_at, created_at )')
        .eq('parent_id', parentId!)
        .limit(200)
      if (error) throw error
      type Row = { id: string; title: string; category: Item['category']; reviews: { user_id: string; rating: number | null; experienced_at: string; created_at: string }[] }
      return ((data ?? []) as unknown as Row[])
        .map((row) => {
          const latest = new Map<string, number | null>()
          const sorted = [...row.reviews].sort((a, b) =>
            a.experienced_at === b.experienced_at ? b.created_at.localeCompare(a.created_at) : b.experienced_at.localeCompare(a.experienced_at),
          )
          for (const r of sorted) if (!latest.has(r.user_id)) latest.set(r.user_id, r.rating == null ? null : Number(r.rating))
          const rated = [...latest.values()].filter((v): v is number => v != null)
          return {
            id: row.id,
            title: row.title,
            category: row.category,
            avg: rated.length ? rated.reduce((s, v) => s + v, 0) / rated.length : 0,
            rated: rated.length,
            entries: row.reviews.length,
          }
        })
        .sort((a, b) => b.rated - a.rated || b.avg - a.avg || a.title.localeCompare(b.title, locale()))
    },
  })
}

// ---------- Fase 2: ranking pessoal de lugares (comparação) e "onde tomar X" ----------

export interface PlaceRank {
  item_id: string
  title: string
  bucket: 1 | 2 | 3
  pos: number
}

/** Seus lugares de uma categoria, em ordem: grupo (gostei > ok > não gostei) e posição dentro dele. */
export function useMyPlaceRanks(category: CategoryId, userId: string | null) {
  return useQuery({
    queryKey: ['place-ranks', userId, category],
    enabled: Boolean(userId),
    queryFn: async (): Promise<PlaceRank[]> => {
      const { data, error } = await supabase
        .from('place_ranks')
        .select('item_id, bucket, pos, item:items!inner ( title )')
        .eq('user_id', userId!)
        .eq('category', category)
        .order('bucket', { ascending: false })
        .order('pos', { ascending: false })
      if (error) throw error
      type Row = { item_id: string; bucket: 1 | 2 | 3; pos: number; item: { title: string } }
      return ((data ?? []) as unknown as Row[]).map((r) => ({ item_id: r.item_id, title: r.item.title, bucket: r.bucket, pos: Number(r.pos) }))
    },
  })
}

export interface BestPlace {
  item_id: string
  place_id: string
  place_title: string
  place_area: string | null
  place_category: CategoryId
  avg_rating: number | null
  ratings: number
}

/** Onde tomar/comer um genérico ("Negroni"), do melhor para o pior, com as notas que você pode ver. */
export function useBestPlaces(genericId: string | undefined, area: string) {
  const a = area.trim()
  return useQuery({
    queryKey: ['best-places', genericId, a.toLowerCase()],
    enabled: Boolean(genericId),
    queryFn: async (): Promise<BestPlace[]> => {
      const { data, error } = await supabase.rpc('best_places_for', { p_generic: genericId!, p_area: a || null })
      if (error) throw error
      return ((data ?? []) as BestPlace[]).map((r) => ({ ...r, avg_rating: r.avg_rating == null ? null : Number(r.avg_rating) }))
    },
  })
}

/** O genérico de um drink/prato de lugar ("Negroni do Bar X" -> "Negroni"). */
export function useGenericOf(itemId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['generic-of', itemId],
    enabled: Boolean(itemId) && enabled,
    queryFn: async () => {
      const { data } = await supabase.from('item_links').select('to_item').eq('from_item', itemId!).eq('tipo', 'e_um').maybeSingle()
      return (data?.to_item as string | undefined) ?? null
    },
  })
}

// ---------- Fase 2c: mapa ----------

export interface MapPlace {
  id: string
  title: string
  subtitle: string | null
  category: CategoryId
  lat: number
  lng: number
  avg: number
  rated: number
  /** você registrou */
  mine: boolean
  /** quantas pessoas (que você pode ver) registraram */
  people: number
}

/** Lugares com coordenada que você ou quem você pode ver registrou (a RLS de reviews decide). */
export function useMapPlaces(userId: string | null) {
  return useQuery({
    queryKey: ['map-places', userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async (): Promise<MapPlace[]> => {
      const { data, error } = await supabase
        .from('reviews')
        .select('user_id, rating, experienced_at, created_at, item:items!inner ( id, title, subtitle, category, lat, lng )')
        .in('item.category', PLACE_SEARCH)
        .not('item.lat', 'is', null)
        .order('experienced_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1000)
      if (error) throw error
      type Row = { user_id: string; rating: number | null; item: { id: string; title: string; subtitle: string | null; category: CategoryId; lat: number; lng: number } }
      const byItem = new Map<string, { item: Row['item']; latest: Map<string, number | null> }>()
      for (const r of (data ?? []) as unknown as Row[]) {
        const e = byItem.get(r.item.id) ?? { item: r.item, latest: new Map<string, number | null>() }
        // já vem do mais recente para o mais antigo: a primeira de cada pessoa é a que vale
        if (!e.latest.has(r.user_id)) e.latest.set(r.user_id, r.rating == null ? null : Number(r.rating))
        byItem.set(r.item.id, e)
      }
      return [...byItem.values()].map(({ item, latest }) => {
        const rated = [...latest.values()].filter((v): v is number => v != null)
        return {
          id: item.id,
          title: item.title,
          subtitle: item.subtitle,
          category: item.category,
          lat: Number(item.lat),
          lng: Number(item.lng),
          avg: rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : 0,
          rated: rated.length,
          mine: latest.has(userId!),
          people: latest.size,
        }
      })
    },
  })
}

/** Link de item que foi fundido em outro: devolve o id novo (ou null). */
export function useItemRedirect(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['item-redirect', id],
    enabled: Boolean(id) && enabled,
    queryFn: async () => {
      const { data } = await supabase.from('item_redirects').select('new_id').eq('old_id', id!).maybeSingle()
      return (data?.new_id as string | undefined) ?? null
    },
  })
}

// ---------- Leituras ----------

/** Feed: tudo que você pode ver (suas reviews + amigos + públicas), mais recentes primeiro. */
export function useFeed(category: CategoryId | 'all') {
  return useQuery({
    queryKey: ['feed', category],
    queryFn: async () => {
      let q = supabase
        .from('reviews')
        .select(REVIEW_SELECT)
        .is('parent_review_id', null)
        .order('created_at', { ascending: false })
        .limit(50)
      if (category !== 'all') q = q.eq('item.category', category)
      const { data, error } = await q
      if (error) throw error
      return attachChildren(normalize(data ?? []))
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
        .is('parent_review_id', null)
        .order('experienced_at', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return attachChildren(normalize(data ?? []))
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
        .select('id, category, title, subtitle, image_url, year, source, external_id, metadata, parent_id')
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      // null = item não existe (link antigo, item apagado): a tela mostra "não encontrado", não é erro
      if (!data) return null
      const [withParent] = await attachParentTitles([data as Item])
      return withParent
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
        .order('experienced_at', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return attachChildren(normalize(data ?? []))
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
        .select('id, category, title, subtitle, image_url, year, source, external_id, parent_id')
        .order('created_at', { ascending: false })
        .limit(30)
      if (t) q = q.ilike('title', `%${t.replace(/[%_]/g, '')}%`)
      if (category !== 'all') q = q.eq('category', category)
      const { data, error } = await q
      if (error) throw error
      return attachParentTitles((data ?? []) as Item[])
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
  const placeCat = category !== 'all' && PLACE_SEARCH.includes(category)
  const enabled = category !== 'all' && (q.length >= 2 || (placeCat && Boolean(near)))
  return useQuery({
    queryKey: ['catalog', category, q.toLowerCase(), near?.lat, near?.lng],
    enabled,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<CatalogResponse> => {
      const web = supabase.functions.invoke<CatalogResponse>('catalog-search', {
        body: { category, q, lat: placeCat ? near?.lat : undefined, lng: placeCat ? near?.lng : undefined },
      })
      // Álbuns: o acervo de referência vem primeiro (mesma busca do app, sem esperar a internet cair)
      const acervo = category === 'album' && q.length >= 2 ? searchAcervo(q) : Promise.resolve([] as CatalogResult[])
      const [{ data, error }, fromAcervo] = await Promise.all([web, acervo])
      if (error && fromAcervo.length === 0) throw error
      const res = data ?? { results: [] }
      if (fromAcervo.length === 0) return res
      const seen = new Set(fromAcervo.map((r) => `${r.source}:${r.external_id}`))
      return { ...res, results: [...fromAcervo, ...(res.results ?? []).filter((r) => !seen.has(`${r.source}:${r.external_id}`))] }
    },
  })
}

/**
 * Busca no acervo de álbuns (migração 202611131600). Com id do MusicBrainz, vira o mesmo item da
 * busca na internet; sem, entra como `acervo`. Sem a tabela (antes da migração), devolve vazio.
 */
async function searchAcervo(q: string): Promise<CatalogResult[]> {
  const { data, error } = await supabase.rpc('search_album_catalog', { p_q: q, p_limit: 8 })
  if (error || !Array.isArray(data)) return []
  return (data as { id: string; title: string; artists: string[] | null; year: number; cover_url: string | null; mbid: string | null }[]).map((a) => ({
    source: a.mbid ? 'musicbrainz' : 'acervo',
    external_id: a.mbid ?? a.id,
    category: 'album' as const,
    title: a.title,
    subtitle: (a.artists ?? []).join(', ') || null,
    image_url: a.cover_url ?? (a.mbid ? `https://coverartarchive.org/release-group/${a.mbid}/front-250` : null),
    year: a.year,
    lat: null,
    lng: null,
    metadata: { acervo: a.id },
  }))
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
      if (!auth.user) throw new Error(t('Sessão expirada. Entre de novo.'))
      return ensureCatalogItem(r, auth.user.id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['search'] }),
  })
}

// ---------- Escritas ----------

export interface NewReview {
  /** preenchido = editar essa entrada do diário; vazio = nova entrada */
  reviewId?: string
  category: CategoryId
  /** item já existente escolhido na lista; se vazio, cria (ou reaproveita) pelo título */
  itemId?: string
  /** resultado vindo das APIs externas, cadastrado no catálogo na hora de publicar */
  external?: CatalogResult
  title: string
  subtitle?: string
  /** vazio = "vi" sem nota */
  rating: number | null
  body: string
  criteria: Record<string, number>
  visibility: Visibility
  photos: File[]
  experiencedAt: string
  rewatch: boolean
  loved: boolean
  spoiler: boolean
  watchedWhere: WatchedWhere | null
  /** nota privada (só você vê); vazio apaga */
  note: string
  /** ids de amigos em "vi com quem" */
  companions: string[]
  /** Fase 1: o que foi pedido no lugar (vira entradas filhas). Item novo = só o nome. */
  orders?: OrderInput[]
  /** Fase 2: lugar ranqueado por comparação (grupo + posição); grava em place_ranks */
  rank?: { bucket: 1 | 2 | 3; pos: number } | null
}

export interface OrderInput {
  /** item que já mora no lugar; vazio = cria (ou reaproveita) pelo nome */
  itemId?: string
  title: string
  category: CategoryId
  rating: number | null
}

export function useCreateReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewReview) => {
      const { data: auth } = await supabase.auth.getUser()
      const uid = auth.user?.id
      if (!uid) throw new Error(t('Sessão expirada. Entre de novo.'))

      // 1. Item: usa o escolhido, reaproveita um manual com o mesmo nome ou cria um novo
      let itemId = input.itemId
      if (!itemId && input.external) itemId = await ensureCatalogItem(input.external, uid)
      if (!itemId) {
        const title = input.title.trim()
        const { data: existing } = await supabase
          .from('items')
          .select('id')
          .eq('category', input.category)
          .is('parent_id', null) // não confunde com o "Banheiro" de dentro de algum bar
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

      // 2. Entrada do diário: nova, ou edição de uma que já existe
      const fields = {
        rating: input.rating,
        body: input.body.trim() || null,
        criteria_scores: input.criteria,
        visibility: input.visibility,
        experienced_at: input.experiencedAt,
        rewatch: input.rewatch,
        loved: input.loved,
        spoiler: input.spoiler && Boolean(input.body.trim()),
        watched_where: input.watchedWhere,
      }
      const saved = input.reviewId
        ? await supabase.from('reviews').update(fields).eq('id', input.reviewId).eq('user_id', uid).select('id').single()
        : await supabase.from('reviews').insert({ ...fields, user_id: uid, item_id: itemId }).select('id').single()
      if (saved.error) throw saved.error
      const reviewId = saved.data.id as string

      // 3. Nota privada (tabela só do dono)
      const note = input.note.trim()
      if (note) {
        const { error } = await supabase.from('entry_notes').upsert({ review_id: reviewId, user_id: uid, body: note })
        if (error) throw error
      } else if (input.reviewId) {
        await supabase.from('entry_notes').delete().eq('review_id', reviewId)
      }

      // 4. Vi com quem: acrescenta os novos e tira os desmarcados
      const { data: current } = input.reviewId
        ? await supabase.from('entry_companions').select('user_id').eq('review_id', reviewId)
        : { data: [] as { user_id: string }[] }
      const before = new Set((current ?? []).map((c) => c.user_id))
      const after = new Set(input.companions)
      const add = [...after].filter((id) => !before.has(id))
      const remove = [...before].filter((id) => !after.has(id))
      if (add.length) {
        const { error } = await supabase.from('entry_companions').insert(add.map((user_id) => ({ review_id: reviewId, user_id })))
        if (error) throw error
      }
      if (remove.length) await supabase.from('entry_companions').delete().eq('review_id', reviewId).in('user_id', remove)

      // 5. Fotos: comprime no aparelho, envia para a pasta do usuário e registra
      const { count } = await supabase.from('review_photos').select('id', { count: 'exact', head: true }).eq('review_id', reviewId)
      for (const [i, file] of input.photos.entries()) {
        const blob = await compressImage(file)
        const path = `${uid}/${reviewId}/${crypto.randomUUID()}.webp`
        const { error: upErr } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(path, blob, { contentType: 'image/webp' })
        if (upErr) throw upErr
        const { error: phErr } = await supabase.from('review_photos').insert({ review_id: reviewId, storage_path: path, position: (count ?? 0) + i })
        if (phErr) throw phErr
      }

      // 6a. Fase 2: posição no seu ranking de lugares (comparação)
      if (input.rank) {
        const { error } = await supabase.from('place_ranks').upsert({
          user_id: uid,
          category: input.category,
          item_id: itemId,
          bucket: input.rank.bucket,
          pos: input.rank.pos,
          visibility: input.visibility,
        })
        if (error) throw error
      }

      // 6. Fase 1: o que foi pedido vira entradas filhas desta (o banco copia visibilidade e data)
      const orders = (input.orders ?? []).filter((o) => o.title.trim())
      if (orders.length) {
        const ids: string[] = []
        for (const o of orders) {
          if (o.itemId) {
            ids.push(o.itemId)
            continue
          }
          const { data: childId, error } = await supabase.rpc('ensure_child_item', {
            p_parent: itemId,
            p_category: o.category,
            p_title: o.title.trim(),
          })
          if (error) throw error
          ids.push(childId as string)
        }
        const { error } = await supabase.from('reviews').insert(
          orders.map((o, i) => ({
            user_id: uid,
            item_id: ids[i],
            parent_review_id: reviewId,
            rating: o.rating,
            visibility: input.visibility,
            experienced_at: input.experiencedAt,
          })),
        )
        if (error) throw error
      }

      return { reviewId, itemId, edited: Boolean(input.reviewId) }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['user-reviews'] })
      qc.invalidateQueries({ queryKey: ['item-reviews'] })
      qc.invalidateQueries({ queryKey: ['search'] })
      qc.invalidateQueries({ queryKey: ['watchlist'] })
      qc.invalidateQueries({ queryKey: ['entry-note'] })
      qc.invalidateQueries({ queryKey: ['child-items'] })
      qc.invalidateQueries({ queryKey: ['place-ranks'] })
      qc.invalidateQueries({ queryKey: ['best-places'] })
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
        if (error.code === '23505') throw new Error(t('Esse @ já está em uso.'))
        if (error.code === '23514') throw new Error(t('O @ precisa ter de 3 a 24 letras minúsculas, números, ponto ou _.'))
        throw error
      }
    },
    onSuccess: () => qc.invalidateQueries(),
  })
}

// ---------- Fase 2 · "Meus lugares em ordem" ----------

/** Quantos lugares você já ranqueou em cada categoria (para a seção do perfil). */
export function useMyRankCounts(userId: string | null) {
  return useQuery({
    queryKey: ['place-ranks', userId, 'counts'],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Partial<Record<CategoryId, number>>> => {
      const { data, error } = await supabase.from('place_ranks').select('category').eq('user_id', userId!)
      if (error) throw error
      const out: Partial<Record<CategoryId, number>> = {}
      for (const r of (data ?? []) as { category: CategoryId }[]) out[r.category] = (out[r.category] ?? 0) + 1
      return out
    },
  })
}

/**
 * Grava a nova ordem: cada lugar recebe grupo e posição (maior = melhor dentro do grupo).
 * Só as linhas que mudaram vão para o banco. A nota das entradas do diário não muda.
 */
export function useSaveRankOrder(category: CategoryId, userId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (changes: { item_id: string; bucket: 1 | 2 | 3; pos: number }[]) => {
      for (const c of changes) {
        const { error } = await supabase
          .from('place_ranks')
          .update({ bucket: c.bucket, pos: c.pos })
          .eq('user_id', userId!)
          .eq('category', category)
          .eq('item_id', c.item_id)
        if (error) throw error
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['place-ranks', userId] }),
  })
}

/** Tira um lugar do seu ranking (o diário continua igual). */
export function useRemoveRank(category: CategoryId, userId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('place_ranks').delete().eq('user_id', userId!).eq('category', category).eq('item_id', itemId)
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['place-ranks', userId] }),
  })
}
