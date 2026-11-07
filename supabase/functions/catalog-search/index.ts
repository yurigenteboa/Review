// =====================================================================
// Review · Edge Function "catalog-search"
// Recebe { category, q, lat?, lng? } e devolve resultados de fontes externas
// num formato único. As chaves (TMDB, Twitch/IGDB) ficam nos Secrets do
// Supabase e nunca chegam ao navegador.
//
// Fontes:
//   album    -> MusicBrainz + Cover Art Archive        (sem chave)
//   filme    -> TMDB /search/movie                     (TMDB_TOKEN)
//   serie    -> TMDB /search/tv                        (TMDB_TOKEN)
//   jogo     -> IGDB                                   (TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET)
//   livro    -> Open Library                           (sem chave)
//   bar         -> OpenStreetMap: Nominatim + Overpass (sem chave)
//   restaurante -> OpenStreetMap: Nominatim + Overpass (sem chave)
//   cafe        -> OpenStreetMap: Nominatim + Overpass (sem chave)
//   banheiro -> OpenStreetMap: Overpass + Nominatim    (sem chave)
//   cidade   -> IBGE (Brasil) + Nominatim (mundo)      (sem chave)
// Login: "Verify JWT with legacy secret" fica DESLIGADO no painel (o projeto assina com ECC);
// a função confere o token sozinha pelas chaves públicas (JWKS).
// =====================================================================

import { createRemoteJWKSet, jwtVerify } from 'npm:jose@6.1.0'

type Category = 'album' | 'filme' | 'serie' | 'jogo' | 'livro' | 'bar' | 'restaurante' | 'cafe' | 'banheiro' | 'cidade'

interface Result {
  source: string
  external_id: string
  category: Category
  title: string
  subtitle: string | null
  image_url: string | null
  year: number | null
  lat: number | null
  lng: number | null
  metadata: Record<string, unknown>
}

interface Query {
  category: Category
  q: string
  lat?: number
  lng?: number
}

const UA = 'MMISC/1.0 (app de reviews; https://www.mmisc.com.br)'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))

async function isLoggedIn(req: Request): Promise<boolean> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return false
  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: `${SUPABASE_URL}/auth/v1` })
    return payload.role === 'authenticated'
  } catch {
    return false
  }
}

class MissingKey extends Error {
  constructor(public key: string) {
    super(`Chave ${key} não configurada`)
  }
}

// ---------- utilidades ----------

async function getJSON(url: string, init: RequestInit = {}, timeoutMs = 8000): Promise<any> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers ?? {}) },
    })
    if (!res.ok) throw new Error(`${new URL(url).host} respondeu ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

const yearOf = (d?: string | null) => {
  const y = d ? Number(String(d).slice(0, 4)) : NaN
  return Number.isFinite(y) && y > 0 ? y : null
}

const strip = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const lucene = (s: string) => s.replace(/([+\-!(){}[\]^"~*?:\\/]|&&|\|\|)/g, '\\$1')

function distanceM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(h)))
}

const fmtDist = (m: number) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`)

// cache simples em memória (vale enquanto a instância da função estiver viva)
const cache = new Map<string, { at: number; data: Result[] }>()
const CACHE_MS = 10 * 60 * 1000

// ---------- Álbuns: MusicBrainz ----------

async function searchAlbums(q: string): Promise<Result[]> {
  const query = `(releasegroup:(${lucene(q)}) OR artist:(${lucene(q)})) AND (primarytype:album OR primarytype:ep)`
  const data = await getJSON(
    `https://musicbrainz.org/ws/2/release-group/?fmt=json&limit=12&query=${encodeURIComponent(query)}`,
  )
  return (data['release-groups'] ?? [])
    .filter((g: any) => (g.score ?? 0) >= 50)
    .map((g: any) => {
      const artist = (g['artist-credit'] ?? []).map((a: any) => `${a.name}${a.joinphrase ?? ''}`).join('').trim()
      const year = yearOf(g['first-release-date'])
      return {
        source: 'musicbrainz',
        external_id: g.id,
        category: 'album' as const,
        title: g.title,
        subtitle: [artist, year].filter(Boolean).join(' · ') || null,
        image_url: `https://coverartarchive.org/release-group/${g.id}/front-250`,
        year,
        lat: null,
        lng: null,
        metadata: { artist, type: g['primary-type'] ?? null },
      }
    })
}

// ---------- Filmes e séries: TMDB ----------

async function searchTmdb(q: string, kind: 'movie' | 'tv'): Promise<Result[]> {
  const token = Deno.env.get('TMDB_TOKEN')
  if (!token) throw new MissingKey('TMDB_TOKEN')
  const data = await getJSON(
    `https://api.themoviedb.org/3/search/${kind}?language=pt-BR&include_adult=false&query=${encodeURIComponent(q)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  return (data.results ?? []).slice(0, 12).map((m: any) => {
    const title = kind === 'movie' ? m.title : m.name
    const original = kind === 'movie' ? m.original_title : m.original_name
    const year = yearOf(kind === 'movie' ? m.release_date : m.first_air_date)
    return {
      source: kind === 'movie' ? 'tmdb-movie' : 'tmdb-tv',
      external_id: String(m.id),
      category: kind === 'movie' ? ('filme' as const) : ('serie' as const),
      title,
      subtitle: [year, original && original !== title ? original : null].filter(Boolean).join(' · ') || null,
      image_url: m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : null,
      year,
      lat: null,
      lng: null,
      metadata: { overview: m.overview ?? null, original_title: original ?? null },
    }
  })
}

// ---------- Jogos: IGDB (via Twitch) ----------

let igdbToken: { value: string; exp: number } | null = null

async function getIgdbToken(id: string, secret: string) {
  if (igdbToken && igdbToken.exp > Date.now() + 60_000) return igdbToken.value
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${id}&client_secret=${secret}&grant_type=client_credentials`,
    { method: 'POST' },
  )
  if (!res.ok) throw new Error(`Twitch recusou as credenciais (${res.status})`)
  const j = await res.json()
  igdbToken = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 }
  return igdbToken.value
}

async function searchGames(q: string): Promise<Result[]> {
  const id = Deno.env.get('TWITCH_CLIENT_ID')
  const secret = Deno.env.get('TWITCH_CLIENT_SECRET')
  if (!id || !secret) throw new MissingKey('TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET')
  const token = await getIgdbToken(id, secret)
  const body =
    `search "${q.replace(/["\\]/g, '')}"; ` +
    'fields name,first_release_date,cover.image_id,involved_companies.developer,involved_companies.company.name; ' +
    'where version_parent = null; limit 12;'
  const data = await getJSON('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: { 'Client-ID': id, Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
    body,
  })
  return (data ?? []).map((g: any) => {
    const year = g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : null
    const dev = (g.involved_companies ?? []).find((c: any) => c.developer)?.company?.name ?? null
    return {
      source: 'igdb',
      external_id: String(g.id),
      category: 'jogo' as const,
      title: g.name,
      subtitle: [dev, year].filter(Boolean).join(' · ') || null,
      image_url: g.cover?.image_id ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg` : null,
      year,
      lat: null,
      lng: null,
      metadata: { developer: dev },
    }
  })
}

// ---------- Livros: Open Library ----------

async function searchBooks(q: string): Promise<Result[]> {
  const data = await getJSON(
    `https://openlibrary.org/search.json?limit=12&fields=key,title,author_name,first_publish_year,cover_i&q=${encodeURIComponent(q)}`,
  )
  return (data.docs ?? []).map((b: any) => {
    const author = (b.author_name ?? []).slice(0, 2).join(', ')
    const year = b.first_publish_year ?? null
    return {
      source: 'openlibrary',
      external_id: b.key,
      category: 'livro' as const,
      title: b.title,
      subtitle: [author, year].filter(Boolean).join(' · ') || null,
      image_url: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg` : null,
      year,
      lat: null,
      lng: null,
      metadata: { author },
    }
  })
}

// ---------- Lugares: OpenStreetMap ----------

// Fase 2: cada categoria de lugar procura só os seus tipos do OSM (antes, "bar" trazia restaurante e café juntos)
type PlaceCategory = 'bar' | 'restaurante' | 'cafe'
const PLACE_TYPES: Record<PlaceCategory, string[]> = {
  bar: ['bar', 'pub', 'biergarten', 'nightclub'],
  restaurante: ['restaurant', 'fast_food', 'food_court'],
  cafe: ['cafe', 'ice_cream'],
}

/** sem localização, a busca de lugares puxa para São Paulo (onde o app começa) */
const SP_CENTER: [number, number] = [-23.55, -46.64]
const ALL_PLACE_TYPES = [...PLACE_TYPES.bar, ...PLACE_TYPES.restaurante, ...PLACE_TYPES.cafe]
/** lojas que no Brasil funcionam como bar/café (padaria, empório de bebidas) */
const PLACE_SHOPS = ['bakery', 'pastry', 'coffee', 'beverages', 'alcohol', 'confectionery']

/** Photon (Komoot): busca do OSM que tolera erro de digitação ("jhonys" acha "Johnny's"). */
async function photon(q: string, lat?: number, lng?: number): Promise<any[]> {
  const [bLat, bLng] = lat != null && lng != null ? [lat, lng] : SP_CENTER
  const near = `&lat=${bLat}&lon=${bLng}&location_bias_scale=0.4`
  const data = await getJSON(`https://photon.komoot.io/api/?limit=20${near}&q=${encodeURIComponent(q)}`)
  return data.features ?? []
}

function placeArea(addr: Record<string, string> = {}) {
  const hood = addr.suburb ?? addr.neighbourhood ?? addr.quarter ?? addr.city_district ?? null
  const city = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? null
  return [hood, city].filter(Boolean).join(', ') || null
}

async function nominatim(q: string, lat?: number, lng?: number, extra = ''): Promise<any[]> {
  const near = lat != null && lng != null ? `&viewbox=${lng - 0.3},${lat + 0.3},${lng + 0.3},${lat - 0.3}` : ''
  return await getJSON(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=15&accept-language=pt-BR${near}${extra}&q=${encodeURIComponent(q)}`,
  )
}

async function overpass(query: string): Promise<any[]> {
  const data = await getJSON('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  }, 12000)
  return data.elements ?? []
}

async function searchPlaces(kind: PlaceCategory, q: string, lat?: number, lng?: number): Promise<Result[]> {
  // No Brasil muito lugar é "bar e restaurante" e no OSM fica marcado só como um dos dois
  // (ex.: Jhonys, em Santa Cecília, é restaurant + bakery). Com texto, aceita qualquer lugar de
  // comer/beber e põe primeiro os do tipo pedido. Sem texto (só "perto de você"), só o tipo pedido.
  const own = PLACE_TYPES[kind]
  const types = q ? ALL_PLACE_TYPES : own
  const re = `^(${types.join('|')})$`
  const hasLoc = lat != null && lng != null
  // compara sem acento, espaço ou apóstrofo ("Johnny's" = "johnnys")
  const norm = (t: string) => strip(t).replace(/[^a-z0-9]/g, '')
  const term = norm(q)
  const out: Result[] = []
  const seen = new Set<string>()
  const add = (r: Result) => {
    if (!r.title || seen.has(r.external_id)) return
    // o mesmo lugar marcado duas vezes no OSM (ex.: restaurante + padaria): mesmo nome a < 300 m
    if (out.some((o) => norm(o.title) === norm(r.title) && distanceM(o.lat!, o.lng!, r.lat!, r.lng!) < 300)) return
    seen.add(r.external_id)
    out.push(r)
  }
  const place = (id: string, title: string, subtitle: string | null, pLat: number, pLng: number, amenity: string): Result => {
    const d = hasLoc ? distanceM(lat!, lng!, pLat, pLng) : null
    return {
      source: 'osm',
      external_id: id,
      category: kind,
      title,
      subtitle: [d != null && d < 50000 ? fmtDist(d) : null, subtitle].filter(Boolean).join(' · ') || null,
      image_url: null,
      year: null,
      lat: pLat,
      lng: pLng,
      metadata: { amenity, ...(d != null ? { distance_m: d } : {}) },
    }
  }

  // As três fontes rodam juntas; se uma cair (o Nominatim limita IPs de nuvem), as outras seguem.
  const [near, nom, pho] = await Promise.allSettled([
    hasLoc
      ? overpass(
          `[out:json][timeout:10];(node["amenity"~"${re}"]["name"](around:1500,${lat},${lng});` +
            `way["amenity"~"${re}"]["name"](around:1500,${lat},${lng}););out center 80;`,
        )
      : Promise.resolve([]),
    q ? nominatim(q, lat, lng) : Promise.resolve([]),
    q ? photon(q, lat, lng) : Promise.resolve([]),
  ])
  const failed = [near, nom, pho].filter((p) => p.status === 'rejected').length
  if (failed === 3 || (failed === 2 && !hasLoc && q)) throw new Error('fontes de lugares fora do ar')

  if (near.status === 'fulfilled') {
    for (const e of near.value) {
      const name: string = e.tags?.name ?? ''
      if (term && !norm(name).includes(term)) continue
      add(place(`${e.type}/${e.id}`, name, e.tags?.['addr:street'] ?? null, e.lat ?? e.center?.lat, e.lon ?? e.center?.lon, e.tags?.amenity))
    }
  }
  if (nom.status === 'fulfilled') {
    for (const r of nom.value) {
      const ok = (r.category === 'amenity' && types.includes(r.type)) || (q && r.category === 'shop' && PLACE_SHOPS.includes(r.type))
      if (!ok) continue
      add(place(`${r.osm_type}/${r.osm_id}`, r.name || r.display_name.split(',')[0], placeArea(r.address), Number(r.lat), Number(r.lon), r.type))
    }
  }
  if (pho.status === 'fulfilled') {
    const OSM_TYPE: Record<string, string> = { N: 'node', W: 'way', R: 'relation' }
    for (const f of pho.value) {
      const p = f.properties ?? {}
      const ok = (p.osm_key === 'amenity' && types.includes(p.osm_value)) || (p.osm_key === 'shop' && PLACE_SHOPS.includes(p.osm_value))
      if (!ok || !OSM_TYPE[p.osm_type]) continue
      const area = [p.district ?? p.locality, p.city].filter(Boolean).join(', ') || null
      const [pLng, pLat] = f.geometry?.coordinates ?? []
      add(place(`${OSM_TYPE[p.osm_type]}/${p.osm_id}`, p.name, area, pLat, pLng, p.osm_value))
    }
  }

  // ordem: nome que contém o texto > tipo pedido > mais perto (de você ou, sem localização, do centro de SP)
  const [refLat, refLng] = hasLoc ? [lat!, lng!] : SP_CENTER
  const score = (r: Result) => {
    const text = !term || norm(r.title).includes(term) ? 0 : 1
    const type = own.includes(String(r.metadata.amenity)) ? 0 : 1
    return text * 10 + type
  }
  const far = (r: Result) => (r.lat != null && r.lng != null ? distanceM(refLat, refLng, r.lat, r.lng) : 1e9)
  out.sort((a, b) => score(a) - score(b) || far(a) - far(b))
  return out.slice(0, 20)
}

async function searchToilets(q: string, lat?: number, lng?: number): Promise<Result[]> {
  const out: Result[] = []
  if (lat != null && lng != null) {
    const els = await overpass(
      `[out:json][timeout:10];(node["amenity"="toilets"](around:1500,${lat},${lng});way["amenity"="toilets"](around:1500,${lat},${lng}););out center 40;`,
    ).catch(() => [])
    for (const e of els) {
      const eLat = e.lat ?? e.center?.lat
      const eLng = e.lon ?? e.center?.lon
      const d = distanceM(lat, lng, eLat, eLng)
      const t = e.tags ?? {}
      const name = t.name ? `Banheiro · ${t.name}` : t.operator ? `Banheiro · ${t.operator}` : 'Banheiro público'
      const info = [fmtDist(d), t.fee === 'no' ? 'grátis' : t.fee === 'yes' ? 'pago' : null, t.wheelchair === 'yes' ? 'acessível' : null]
      out.push({
        source: 'osm',
        external_id: `${e.type}/${e.id}`,
        category: 'banheiro',
        title: name,
        subtitle: info.filter(Boolean).join(' · '),
        image_url: null,
        year: null,
        lat: eLat,
        lng: eLng,
        metadata: { fee: t.fee ?? null, wheelchair: t.wheelchair ?? null, distance_m: d },
      })
    }
    out.sort((a, b) => (a.metadata.distance_m as number) - (b.metadata.distance_m as number))
    const term = strip(q)
    if (term) return out.filter((o) => strip(o.title).includes(term)).concat(await toiletPlaces(q, lat, lng)).slice(0, 20)
  }
  if (q) out.push(...(await toiletPlaces(q, lat, lng)))
  return out.slice(0, 20)
}

// "banheiro do Shopping X": qualquer lugar com nome vira candidato a banheiro
async function toiletPlaces(q: string, lat?: number, lng?: number): Promise<Result[]> {
  const rows = await nominatim(q, lat, lng)
  return rows
    .filter((r: any) => r.name)
    .slice(0, 8)
    .map((r: any) => ({
      source: 'osm',
      external_id: `${r.osm_type}/${r.osm_id}`,
      category: 'banheiro' as const,
      title: `Banheiro · ${r.name}`,
      subtitle: placeArea(r.address),
      image_url: null,
      year: null,
      lat: Number(r.lat),
      lng: Number(r.lon),
      metadata: { place_type: `${r.category}/${r.type}` },
    }))
}

// ---------- Cidades: IBGE + Nominatim ----------

let ibge: { id: number; nome: string; uf: string; key: string }[] | null = null

async function loadIbge() {
  if (ibge) return ibge
  const rows = await getJSON('https://servicodados.ibge.gov.br/api/v1/localidades/municipios', {}, 15000)
  ibge = rows.map((m: any) => {
    const uf =
      m.microrregiao?.mesorregiao?.UF?.sigla ?? m['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla ?? ''
    return { id: m.id, nome: m.nome, uf, key: strip(m.nome) }
  })
  return ibge!
}

async function searchCities(q: string): Promise<Result[]> {
  const term = strip(q)
  const out: Result[] = []
  const list = await loadIbge().catch(() => [])
  const starts = list.filter((c) => c.key.startsWith(term))
  const contains = list.filter((c) => !c.key.startsWith(term) && c.key.includes(term))
  for (const c of [...starts, ...contains].slice(0, 8)) {
    out.push({
      source: 'ibge',
      external_id: String(c.id),
      category: 'cidade',
      title: c.nome,
      subtitle: `${c.uf} · Brasil`,
      image_url: null,
      year: null,
      lat: null,
      lng: null,
      metadata: { uf: c.uf },
    })
  }
  // fora do Brasil
  const rows = await nominatim(q, undefined, undefined, '&featureType=city').catch(() => [])
  for (const r of rows) {
    const cc = r.address?.country_code
    if (cc === 'br') continue
    out.push({
      source: 'osm',
      external_id: `${r.osm_type}/${r.osm_id}`,
      category: 'cidade',
      title: r.name || r.display_name.split(',')[0],
      subtitle: [r.address?.state, r.address?.country].filter(Boolean).join(' · ') || null,
      image_url: null,
      year: null,
      lat: Number(r.lat),
      lng: Number(r.lon),
      metadata: { country_code: cc ?? null },
    })
    if (out.length >= 14) break
  }
  return out
}

// ---------- roteador ----------

async function run({ category, q, lat, lng }: Query): Promise<Result[]> {
  switch (category) {
    case 'album':
      return searchAlbums(q)
    case 'filme':
      return searchTmdb(q, 'movie')
    case 'serie':
      return searchTmdb(q, 'tv')
    case 'jogo':
      return searchGames(q)
    case 'livro':
      return searchBooks(q)
    case 'bar':
    case 'restaurante':
    case 'cafe':
      return searchPlaces(category, q, lat, lng)
    case 'banheiro':
      return searchToilets(q, lat, lng)
    case 'cidade':
      return searchCities(q)
    default:
      return []
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)
  if (!(await isLoggedIn(req))) return json({ error: 'Entre na sua conta para buscar.' }, 401)

  let input: Query
  try {
    input = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  const q = String(input.q ?? '').trim().slice(0, 100)
  const lat = typeof input.lat === 'number' ? Math.round(input.lat * 1000) / 1000 : undefined
  const lng = typeof input.lng === 'number' ? Math.round(input.lng * 1000) / 1000 : undefined
  const category = input.category
  const needsText = !(['bar', 'restaurante', 'cafe', 'banheiro'] as string[]).includes(category) || lat == null
  if (needsText && q.length < 2) return json({ results: [] })

  const key = JSON.stringify([category, strip(q), lat, lng])
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return json({ results: hit.data, cached: true })

  try {
    const results = (await run({ category, q, lat, lng })).filter((r) => r.title)
    cache.set(key, { at: Date.now(), data: results })
    if (cache.size > 500) cache.delete(cache.keys().next().value!)
    return json({ results })
  } catch (e) {
    if (e instanceof MissingKey) return json({ results: [], missingKey: e.key })
    return json({ results: [], error: (e as Error).message })
  }
})
