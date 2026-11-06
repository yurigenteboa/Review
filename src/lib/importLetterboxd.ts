// Execução da importação do Letterboxd: procurar no TMDB (pela mesma Edge Function
// da busca, catalog-search) e gravar no diário e no "quero ver" do usuário logado.
// Tudo passa pelas regras de acesso normais (RLS): só grava nas suas linhas.
import { filmKey, pickMatch, type FilmMatch, type LbExport, type LbFilm } from './letterboxd'
import { ensureCatalogItem, type CatalogResult } from './queries'
import { supabase } from './supabase'
import type { Visibility } from './types'

/** Procura cada filme no TMDB, 4 de cada vez, avisando o progresso. */
export async function matchFilms(films: LbFilm[], onProgress: (done: number) => void, signal: { cancelled: boolean }): Promise<FilmMatch[]> {
  const out: FilmMatch[] = new Array(films.length)
  let next = 0
  let done = 0
  const worker = async () => {
    while (next < films.length && !signal.cancelled) {
      const i = next++
      const film = films[i]
      let results: CatalogResult[] = []
      for (let attempt = 0; attempt < 2; attempt++) {
        const { data, error } = await supabase.functions.invoke<{ results: CatalogResult[]; missingKey?: string }>('catalog-search', {
          body: { category: 'filme', q: film.name },
        })
        if (!error) {
          if (data?.missingKey) throw new Error('A busca de filmes está sem a chave do TMDB no Supabase.')
          results = data?.results ?? []
          break
        }
        await new Promise((r) => setTimeout(r, 800))
      }
      out[i] = pickMatch(film, results)
      onProgress(++done)
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])
  return out.filter(Boolean)
}

export interface ImportResult {
  diaryAdded: number
  diarySkipped: number
  watchlistAdded: number
  filmsSkipped: number
}

/**
 * Grava: 1) os filmes no catálogo (items), 2) as entradas no diário em lotes de 50,
 * 3) o quero ver. Pula entradas que você já tem (mesmo filme no mesmo dia).
 * A hora do registro (created_at) é a data em que você registrou no Letterboxd,
 * para o feed dos amigos não lotar com filmes antigos.
 */
export async function runImport(
  exp: LbExport,
  matches: FilmMatch[],
  visibility: Visibility,
  includeWatchlist: boolean,
  onProgress: (label: string, done: number, total: number) => void,
): Promise<ImportResult> {
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth.user?.id
  if (!uid) throw new Error('Sessão expirada. Entre de novo.')

  // 1. Catálogo: um item por filme escolhido
  const chosen = matches.filter((m) => m.chosen)
  const itemByFilm = new Map<string, string>()
  const itemByExternal = new Map<string, string>()
  for (let i = 0; i < chosen.length; i++) {
    const m = chosen[i]
    const ext = m.chosen!
    let id = itemByExternal.get(ext.external_id)
    if (!id) {
      id = await ensureCatalogItem(ext, uid)
      itemByExternal.set(ext.external_id, id)
    }
    itemByFilm.set(filmKey(m.film), id)
    onProgress('Cadastrando filmes', i + 1, chosen.length)
  }

  // 2. Diário, sem duplicar o que já existe (mesmo item no mesmo dia)
  const itemIds = [...new Set(itemByFilm.values())]
  const existing = new Set<string>()
  for (let i = 0; i < itemIds.length; i += 200) {
    const { data, error } = await supabase
      .from('reviews')
      .select('item_id, experienced_at')
      .eq('user_id', uid)
      .in('item_id', itemIds.slice(i, i + 200))
    if (error) throw error
    for (const r of data ?? []) existing.add(`${r.item_id}|${String(r.experienced_at).slice(0, 10)}`)
  }

  const rows = exp.entries
    .map((e) => ({ e, itemId: itemByFilm.get(filmKey(e)) }))
    .filter((x): x is { e: (typeof exp.entries)[number]; itemId: string } => Boolean(x.itemId))
  const toInsert = rows.filter(({ e, itemId }) => {
    const k = `${itemId}|${e.watched}`
    if (existing.has(k)) return false
    existing.add(k) // duas linhas iguais no próprio export também não duplicam
    return true
  })

  for (let i = 0; i < toInsert.length; i += 50) {
    const batch = toInsert.slice(i, i + 50).map(({ e, itemId }) => ({
      user_id: uid,
      item_id: itemId,
      rating: e.rating,
      // o banco aceita até 5.000 caracteres por review
      body: e.review && e.review.length > 5000 ? `${e.review.slice(0, 4999)}…` : e.review,
      spoiler: false,
      visibility,
      experienced_at: e.watched,
      created_at: `${e.logged}T12:00:00Z`,
      rewatch: e.rewatch,
      loved: e.loved,
    }))
    const { error } = await supabase.from('reviews').insert(batch)
    if (error) throw error
    onProgress('Gravando o diário', Math.min(i + 50, toInsert.length), toInsert.length)
  }

  // 3. Quero ver (o banco tira do quero ver o que já está no diário)
  let watchlistAdded = 0
  if (includeWatchlist) {
    const inDiary = new Set(rows.map((r) => r.itemId))
    const wl = [...new Set(exp.watchlist.map((w) => itemByFilm.get(filmKey(w))).filter((id): id is string => Boolean(id) && !inDiary.has(id!)))]
    for (let i = 0; i < wl.length; i += 100) {
      const { error } = await supabase
        .from('watchlist')
        .upsert(wl.slice(i, i + 100).map((item_id) => ({ user_id: uid, item_id, visibility })), { onConflict: 'user_id,item_id', ignoreDuplicates: true })
      if (error) throw error
      onProgress('Gravando o quero ver', Math.min(i + 100, wl.length), wl.length)
    }
    watchlistAdded = wl.length
  }

  return {
    diaryAdded: toInsert.length,
    diarySkipped: rows.length - toInsert.length,
    watchlistAdded,
    filmsSkipped: matches.length - chosen.length,
  }
}
