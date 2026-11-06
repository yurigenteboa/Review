// =====================================================================
// MMISC · Edge Function "movie-details"
// Recebe { item_id } de um filme do catálogo (source = 'tmdb-movie') e
// devolve a ficha completa do TMDB, já enxuta, no formato MovieDetails.
//
// Uma única chamada ao TMDB traz tudo:
//   /movie/{id}?append_to_response=credits,videos,watch/providers,
//               release_dates,recommendations&language=pt-BR
//
// Cache em dois níveis:
//   1. items.metadata.tmdb + items.metadata.fetched_at (7 dias, no banco)
//   2. memória da instância (10 min), para aguentar várias aberturas seguidas
//
// Segurança:
//   - A chave TMDB_TOKEN fica só aqui (Secrets do Supabase).
//   - A função confere o login do usuário (auth.getUser com o token dele)
//     e lê/escreve no banco COMO esse usuário: o RLS continua valendo.
//   - Para gravar o cache usa a RPC cache_movie_details (migração
//     202611061500_f1_movie_cache.sql). Se ela ainda não existir, tenta
//     o update direto (só funciona para quem cadastrou o item) e, se nem
//     isso der, apenas devolve os dados sem guardar.
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const CACHE_DAYS = 7
const MEM_MS = 10 * 60 * 1000
const mem = new Map<string, { at: number; data: MovieDetails }>()

// ---------- Formato devolvido ao app (igual a src/lib/movie.ts) ----------

interface Person {
  id: number
  name: string
  role: string
  photo: string | null
}

interface Provider {
  id: number
  name: string
  logo: string | null
}

interface Similar {
  id: number
  title: string
  original_title: string | null
  year: number | null
  poster: string | null
  overview: string | null
}

interface MovieDetails {
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
  cast: Person[]
  crew: Person[]
  trailer: { key: string; name: string } | null
  providers: { link: string | null; flatrate: Provider[]; rent: Provider[]; buy: Provider[] } | null
  recommendations: Similar[]
  tmdb_rating: number | null
  tmdb_votes: number | null
  fetched_at: string
}

// ---------- utilidades ----------

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const yearOf = (d?: string | null) => {
  const y = d ? Number(String(d).slice(0, 4)) : NaN
  return Number.isFinite(y) && y > 0 ? y : null
}

const isFresh = (iso: unknown) =>
  typeof iso === 'string' && Date.now() - new Date(iso).getTime() < CACHE_DAYS * 86400 * 1000

const CREW_JOBS: Record<string, string> = {
  Director: 'Direção',
  Screenplay: 'Roteiro',
  Writer: 'Roteiro',
  Novel: 'Livro original',
  'Director of Photography': 'Fotografia',
  'Original Music Composer': 'Trilha sonora',
  Editor: 'Montagem',
  Producer: 'Produção',
}
const CREW_ORDER = Object.keys(CREW_JOBS)

// ---------- TMDB ----------

// deno-lint-ignore no-explicit-any
type Json = any

async function fetchTmdb(tmdbId: string): Promise<MovieDetails> {
  const token = Deno.env.get('TMDB_TOKEN')
  if (!token) throw new Error('missingKey:TMDB_TOKEN')

  const url =
    `https://api.themoviedb.org/3/movie/${encodeURIComponent(tmdbId)}` +
    `?append_to_response=credits,videos,watch/providers,release_dates,recommendations` +
    `&language=pt-BR&include_video_language=pt,en,null`

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 9000)
  let m: Json
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
    if (res.status === 404) throw new Error('Filme não encontrado no TMDB')
    if (!res.ok) throw new Error(`TMDB respondeu ${res.status}`)
    m = await res.json()
  } finally {
    clearTimeout(t)
  }

  // Classificação indicativa no Brasil (a primeira que tiver valor)
  const br = (m.release_dates?.results ?? []).find((r: Json) => r.iso_3166_1 === 'BR')
  const cert =
    (br?.release_dates ?? [])
      .map((d: Json) => String(d.certification ?? '').trim())
      .find((c: string) => c.length > 0) ?? null

  // Trailer: prefere oficial, dublado/legendado em português, depois inglês
  const videos: Json[] = (m.videos?.results ?? []).filter((v: Json) => v.site === 'YouTube' && v.key)
  const score = (v: Json) =>
    (v.type === 'Trailer' ? 4 : v.type === 'Teaser' ? 2 : 0) +
    (v.official ? 2 : 0) +
    (v.iso_639_1 === 'pt' ? 3 : v.iso_639_1 === 'en' ? 1 : 0)
  const bestVideo = [...videos].sort((a, b) => score(b) - score(a))[0]

  const directors = (m.credits?.crew ?? []).filter((c: Json) => c.job === 'Director').map((c: Json) => c.name)

  // Equipe: um nome por pessoa+função, nas funções que interessam, na ordem acima
  const seen = new Set<string>()
  const crew: Person[] = (m.credits?.crew ?? [])
    .filter((c: Json) => CREW_JOBS[c.job])
    .sort((a: Json, b: Json) => CREW_ORDER.indexOf(a.job) - CREW_ORDER.indexOf(b.job))
    .filter((c: Json) => {
      const k = `${c.id}:${CREW_JOBS[c.job]}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .slice(0, 12)
    .map((c: Json) => ({ id: c.id, name: c.name, role: CREW_JOBS[c.job], photo: c.profile_path ?? null }))

  const cast: Person[] = (m.credits?.cast ?? [])
    .slice(0, 20)
    .map((c: Json) => ({ id: c.id, name: c.name, role: c.character ?? '', photo: c.profile_path ?? null }))

  const wp = m['watch/providers']?.results?.BR
  const prov = (list: Json[] | undefined): Provider[] =>
    (list ?? [])
      .sort((a: Json, b: Json) => (a.display_priority ?? 99) - (b.display_priority ?? 99))
      .map((p: Json) => ({ id: p.provider_id, name: p.provider_name, logo: p.logo_path ?? null }))

  const recommendations: Similar[] = (m.recommendations?.results ?? [])
    .filter((r: Json) => r.poster_path)
    .slice(0, 12)
    .map((r: Json) => ({
      id: r.id,
      title: r.title,
      original_title: r.original_title ?? null,
      year: yearOf(r.release_date),
      poster: r.poster_path,
      overview: r.overview || null,
    }))

  return {
    tmdb_id: m.id,
    title: m.title,
    original_title: m.original_title && m.original_title !== m.title ? m.original_title : null,
    tagline: m.tagline || null,
    overview: m.overview || null,
    year: yearOf(m.release_date),
    release_date: m.release_date || null,
    runtime: m.runtime || null,
    certification_br: cert,
    genres: (m.genres ?? []).map((g: Json) => g.name),
    poster: m.poster_path ?? null,
    backdrop: m.backdrop_path ?? null,
    directors,
    cast,
    crew,
    trailer: bestVideo ? { key: bestVideo.key, name: bestVideo.name } : null,
    providers: wp
      ? { link: wp.link ?? null, flatrate: prov(wp.flatrate), rent: prov(wp.rent), buy: prov(wp.buy) }
      : null,
    recommendations,
    tmdb_rating: typeof m.vote_average === 'number' ? Math.round(m.vote_average * 10) / 10 : null,
    tmdb_votes: typeof m.vote_count === 'number' ? m.vote_count : null,
    fetched_at: new Date().toISOString(),
  }
}

// ---------- handler ----------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) return json({ error: 'Função sem SUPABASE_URL/SUPABASE_ANON_KEY' }, 500)

  // Cliente que age como o usuário que chamou (o RLS vale normalmente)
  const db = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const { data: auth, error: authErr } = await db.auth.getUser(token)
  if (authErr || !auth.user) return json({ error: 'Entre na sua conta de novo' }, 401)

  let itemId: string
  let force = false
  try {
    const body = await req.json()
    itemId = String(body.item_id ?? '')
    force = body.refresh === true
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) return json({ error: 'item_id inválido' }, 400)

  const { data: item, error: itemErr } = await db
    .from('items')
    .select('id, source, external_id, metadata')
    .eq('id', itemId)
    .maybeSingle()
  if (itemErr) return json({ error: itemErr.message }, 500)
  if (!item) return json({ error: 'Item não encontrado' }, 404)
  if (item.source !== 'tmdb-movie' || !item.external_id) return json({ error: 'Esse item não é um filme do TMDB' }, 400)

  // 1. cache no banco
  const meta = (item.metadata ?? {}) as Record<string, unknown>
  if (!force && meta.tmdb && isFresh(meta.fetched_at)) {
    return json({ details: meta.tmdb, cached: 'db' })
  }

  // 2. cache em memória
  const hit = mem.get(item.external_id)
  if (!force && hit && Date.now() - hit.at < MEM_MS) {
    return json({ details: hit.data, cached: 'memory' })
  }

  // 3. TMDB
  let details: MovieDetails
  try {
    details = await fetchTmdb(item.external_id)
  } catch (e) {
    const msg = (e as Error).message
    if (msg.startsWith('missingKey:')) return json({ missingKey: msg.split(':')[1] })
    // TMDB fora do ar: devolve o cache antigo, se houver
    if (meta.tmdb) return json({ details: meta.tmdb, cached: 'stale' })
    return json({ error: msg }, 502)
  }

  mem.set(item.external_id, { at: Date.now(), data: details })
  if (mem.size > 300) mem.delete(mem.keys().next().value!)

  // 4. guarda no banco (melhor esforço: se falhar, o usuário recebe os dados mesmo assim)
  let saved = false
  const rpc = await db.rpc('cache_movie_details', { p_item: item.id, p_details: details })
  if (!rpc.error) saved = true
  else {
    const upd = await db
      .from('items')
      .update({ metadata: { ...meta, tmdb: details, fetched_at: details.fetched_at } })
      .eq('id', item.id)
      .select('id')
    saved = !upd.error && (upd.data?.length ?? 0) > 0
  }

  return json({ details, cached: false, saved })
})
