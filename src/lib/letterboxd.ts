// Importar do Letterboxd: lê o .zip do export (ou os CSVs soltos) e monta a lista
// do que entra no diário e no "quero ver". Funções puras, menos a leitura de arquivo.
//
// Arquivos usados do export (Configurações → Importar e exportar → Exportar dados):
//   diary.csv        Date, Name, Year, Letterboxd URI, Rating, Rewatch, Tags, Watched Date
//   reviews.csv      Date, Name, Year, Letterboxd URI, Rating, Rewatch, Review, Tags, Watched Date
//   ratings.csv      Date, Name, Year, Letterboxd URI, Rating          (filmes com nota)
//   watched.csv      Date, Name, Year, Letterboxd URI                  (filmes vistos)
//   likes/films.csv  Date, Name, Year, Letterboxd URI                  (♥)
//   watchlist.csv    Date, Name, Year, Letterboxd URI
import { unzipSync, strFromU8 } from 'fflate'
import type { CatalogResult } from './queries'

export interface LbFilm {
  name: string
  year: number | null
}

export interface LbEntry extends LbFilm {
  /** dia em que viu (vira a data do diário) */
  watched: string
  /** dia em que registrou no Letterboxd (vira a hora do registro, para não lotar o feed) */
  logged: string
  rating: number | null
  rewatch: boolean
  review: string | null
  loved: boolean
  /** veio de ratings/watched, sem data de quando viu (usa a data do registro) */
  undated: boolean
}

export interface LbExport {
  entries: LbEntry[]
  watchlist: (LbFilm & { added: string })[]
  /** arquivos reconhecidos, para mostrar na tela */
  found: string[]
}

// ---------- CSV ----------

/** CSV com aspas, vírgulas e quebras de linha dentro dos campos (RFC 4180). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const s = text.replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(field)
      if (row.some((f) => f !== '')) rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  row.push(field)
  if (row.some((f) => f !== '')) rows.push(row)
  return rows
}

export function csvObjects(text: string): Record<string, string>[] {
  const [head, ...rows] = parseCsv(text)
  if (!head) return []
  const keys = head.map((h) => h.trim())
  return rows.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])))
}

// ---------- Normalização ----------

export const normTitle = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export const filmKey = (f: LbFilm) => `${normTitle(f.name)}|${f.year ?? ''}`

const toYear = (s: string | undefined) => {
  const n = Number(s)
  return Number.isInteger(n) && n > 1870 && n < 2200 ? n : null
}
const toDate = (s: string | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null)
const toRating = (s: string | undefined) => {
  const n = Number(s)
  return s && n >= 0.5 && n <= 5 ? Math.round(n * 2) / 2 : null
}

/** O texto das reviews do Letterboxd vem com um pouco de HTML (<br>, <i>…). */
export function cleanReview(s: string | undefined): string | null {
  if (!s) return null
  const t = s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
  return t || null
}

// ---------- Montar a importação ----------

/**
 * Junta os CSVs do export numa lista de entradas do diário.
 * - diary.csv é a base (uma linha por vez que viu);
 * - reviews.csv acrescenta o texto (casando pela URI da entrada; sem ela, por filme + data);
 * - ratings/watched entram só para filmes que NÃO estão no diário, se includeUndated;
 * - likes/films.csv marca ♥ na entrada mais recente do filme.
 */
export function buildExport(files: Record<string, string>, includeUndated: boolean): LbExport {
  const get = (name: string) => {
    const key = Object.keys(files).find((k) => k.toLowerCase().replace(/\\/g, '/').endsWith(name))
    return key ? csvObjects(files[key]) : []
  }
  const found = ['diary.csv', 'reviews.csv', 'ratings.csv', 'watched.csv', 'likes/films.csv', 'watchlist.csv'].filter((n) =>
    Object.keys(files).some((k) => k.toLowerCase().replace(/\\/g, '/').endsWith(n)),
  )

  const diary = get('diary.csv')
  const reviews = get('reviews.csv')
  const ratings = get('ratings.csv')
  const watched = get('watched.csv')
  const likes = get('likes/films.csv')
  const watchlistRows = get('watchlist.csv')

  const entries: LbEntry[] = []
  const byUri = new Map<string, LbEntry>()
  const byFilmDate = new Map<string, LbEntry>()

  for (const r of diary) {
    if (!r.Name) continue
    const logged = toDate(r.Date) ?? toDate(r['Watched Date'])
    const watchedDay = toDate(r['Watched Date']) ?? logged
    if (!watchedDay || !logged) continue
    const e: LbEntry = {
      name: r.Name,
      year: toYear(r.Year),
      watched: watchedDay,
      logged,
      rating: toRating(r.Rating),
      rewatch: /^yes$/i.test(r.Rewatch ?? ''),
      review: null,
      loved: false,
      undated: false,
    }
    entries.push(e)
    if (r['Letterboxd URI']) byUri.set(r['Letterboxd URI'], e)
    byFilmDate.set(`${filmKey(e)}|${e.watched}`, e)
  }

  for (const r of reviews) {
    if (!r.Name) continue
    const text = cleanReview(r.Review)
    const watchedDay = toDate(r['Watched Date']) ?? toDate(r.Date)
    const target = (r['Letterboxd URI'] && byUri.get(r['Letterboxd URI'])) || (watchedDay ? byFilmDate.get(`${filmKey({ name: r.Name, year: toYear(r.Year) })}|${watchedDay}`) : undefined)
    if (target) {
      target.review = text
      if (target.rating == null) target.rating = toRating(r.Rating)
    } else if (watchedDay) {
      const e: LbEntry = {
        name: r.Name,
        year: toYear(r.Year),
        watched: watchedDay,
        logged: toDate(r.Date) ?? watchedDay,
        rating: toRating(r.Rating),
        rewatch: /^yes$/i.test(r.Rewatch ?? ''),
        review: text,
        loved: false,
        undated: false,
      }
      entries.push(e)
      byFilmDate.set(`${filmKey(e)}|${e.watched}`, e)
    }
  }

  if (includeUndated) {
    const inDiary = new Set(entries.map(filmKey))
    const ratingByFilm = new Map(ratings.map((r) => [filmKey({ name: r.Name, year: toYear(r.Year) }), r]))
    const extra = new Map<string, Record<string, string>>()
    for (const r of [...ratings, ...watched]) {
      if (!r.Name) continue
      const k = filmKey({ name: r.Name, year: toYear(r.Year) })
      if (!inDiary.has(k) && !extra.has(k)) extra.set(k, r)
    }
    for (const [k, r] of extra) {
      const day = toDate(r.Date)
      if (!day) continue
      entries.push({
        name: r.Name,
        year: toYear(r.Year),
        watched: day,
        logged: day,
        rating: toRating(ratingByFilm.get(k)?.Rating),
        rewatch: false,
        review: null,
        loved: false,
        undated: true,
      })
    }
  }

  // ♥: na entrada mais recente de cada filme curtido
  const liked = new Set(likes.filter((r) => r.Name).map((r) => filmKey({ name: r.Name, year: toYear(r.Year) })))
  const latest = new Map<string, LbEntry>()
  for (const e of entries) {
    const k = filmKey(e)
    const cur = latest.get(k)
    if (!cur || e.watched > cur.watched) latest.set(k, e)
  }
  for (const [k, e] of latest) if (liked.has(k)) e.loved = true

  const watchlist = watchlistRows
    .filter((r) => r.Name)
    .map((r) => ({ name: r.Name, year: toYear(r.Year), added: toDate(r.Date) ?? '' }))

  entries.sort((a, b) => a.watched.localeCompare(b.watched))
  return { entries, watchlist, found }
}

/** Filmes únicos (do diário e do quero ver) para procurar no TMDB uma vez só. */
export function uniqueFilms(exp: LbExport): LbFilm[] {
  const map = new Map<string, LbFilm>()
  for (const f of [...exp.entries, ...exp.watchlist]) if (!map.has(filmKey(f))) map.set(filmKey(f), { name: f.name, year: f.year })
  return [...map.values()]
}

// ---------- Casar com o TMDB ----------

export type MatchStatus = 'certo' | 'duvidoso' | 'nao_achado'

export interface FilmMatch {
  film: LbFilm
  status: MatchStatus
  /** o escolhido (automático ou pela pessoa); null = não importar */
  chosen: CatalogResult | null
  /** opções para a pessoa escolher quando há dúvida */
  options: CatalogResult[]
}

/** Título original vem no subtítulo do catálogo ("1972 · Título original"). */
const originalOf = (r: CatalogResult) => r.subtitle?.split(' · ').slice(1).join(' · ') ?? ''

/**
 * Regra: o TMDB devolve o título em português; o Letterboxd usa o original/inglês.
 * Por isso o ano manda: um resultado do mesmo ano = certo; vários do mesmo ano,
 * desempata pelo título (original ou traduzido); ano ±1 ou nenhum ano batendo = dúvida.
 */
export function pickMatch(film: LbFilm, results: CatalogResult[]): FilmMatch {
  const movies = results.filter((r) => r.source === 'tmdb-movie')
  if (!movies.length) return { film, status: 'nao_achado', chosen: null, options: [] }
  const name = normTitle(film.name)
  const titleHit = (r: CatalogResult) => normTitle(r.title) === name || normTitle(originalOf(r)) === name
  if (film.year != null) {
    const sameYear = movies.filter((r) => r.year === film.year)
    const byTitle = sameYear.filter(titleHit)
    if (byTitle.length === 1) return { film, status: 'certo', chosen: byTitle[0], options: movies.slice(0, 5) }
    // Só o ano bate (comum: TMDB em português, Letterboxd em inglês). Vale como certo
    // apenas se nenhum OUTRO resultado tiver o título igual; senão, é dúvida.
    const titleElsewhere = movies.some((r) => r.year !== film.year && titleHit(r))
    if (sameYear.length === 1 && !titleElsewhere) return { film, status: 'certo', chosen: sameYear[0], options: movies.slice(0, 5) }
    const near = movies.filter((r) => r.year != null && Math.abs(r.year - film.year!) <= 1)
    const best = byTitle[0] ?? near.find(titleHit) ?? sameYear[0] ?? near[0] ?? null
    return { film, status: 'duvidoso', chosen: best, options: movies.slice(0, 5) }
  }
  const byTitle = movies.filter(titleHit)
  return byTitle.length === 1
    ? { film, status: 'certo', chosen: byTitle[0], options: movies.slice(0, 5) }
    : { film, status: 'duvidoso', chosen: byTitle[0] ?? null, options: movies.slice(0, 5) }
}

// ---------- Leitura dos arquivos ----------

/** Aceita o .zip do export ou CSVs soltos. Devolve { caminho: texto }. */
export async function readLetterboxdFiles(files: File[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) {
      const unzipped = unzipSync(new Uint8Array(await f.arrayBuffer()), {
        filter: (file) => /\.csv$/i.test(file.name) && file.originalSize < 50_000_000,
      })
      for (const [name, bytes] of Object.entries(unzipped)) out[name] = strFromU8(bytes)
    } else if (/\.csv$/i.test(f.name)) {
      // CSV solto: likes/films.csv perde a pasta; o nome "films.csv" só vale como curtidas
      const name = f.name.toLowerCase() === 'films.csv' ? 'likes/films.csv' : f.name
      out[name] = await f.text()
    }
  }
  return out
}
