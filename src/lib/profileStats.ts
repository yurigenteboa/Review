// Números e rótulos do perfil, calculados no aparelho a partir do diário que a pessoa
// pode ver (o banco já filtrou por RLS). Funções puras: fáceis de testar.
import { CATEGORIES, type CategoryId } from './categories'
import type { Review, TasteRow } from './types'

export const CATEGORY_PLURAL: Record<CategoryId, string> = {
  album: 'álbuns',
  filme: 'filmes',
  serie: 'séries',
  jogo: 'jogos',
  livro: 'livros',
  bar: 'bares',
  banheiro: 'banheiros',
  cidade: 'cidades',
}

export type CategoryFilter = CategoryId | 'all'

export const byCategory = (list: Review[], cat: CategoryFilter) =>
  cat === 'all' ? list : list.filter((r) => r.item.category === cat)

/** Mais recente primeiro (data em que viveu, depois hora do registro). */
const newestFirst = (a: Review, b: Review) =>
  a.experienced_at === b.experienced_at ? b.created_at.localeCompare(a.created_at) : b.experienced_at.localeCompare(a.experienced_at)

/** Uma linha por item: a entrada mais recente do diário (a nota que vale hoje). */
export function latestPerItem(list: Review[]): Review[] {
  const seen = new Map<string, Review>()
  for (const r of [...list].sort(newestFirst)) if (!seen.has(r.item.id)) seen.set(r.item.id, r)
  return [...seen.values()]
}

/** Categorias com pelo menos uma entrada, na ordem oficial. */
export function categoriesWithEntries(list: Review[]): CategoryId[] {
  const has = new Set(list.map((r) => r.item.category))
  return CATEGORIES.map((c) => c.id).filter((id) => has.has(id))
}

const rated = (list: Review[]) => list.filter((r): r is Review & { rating: number } => r.rating != null)
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)

export function summary(list: Review[], year: string) {
  const latest = latestPerItem(list)
  const notes = rated(latest).map((r) => r.rating)
  return {
    entriesThisYear: list.filter((r) => r.experienced_at.startsWith(year)).length,
    items: latest.length,
    average: mean(notes),
    ratedCount: notes.length,
  }
}

/** Quantas notas em cada degrau de 0,5 a 5 (10 posições), usando a nota mais recente de cada item. */
export function ratingHistogram(list: Review[]): number[] {
  const bins = Array.from({ length: 10 }, () => 0)
  for (const r of rated(latestPerItem(list))) {
    const i = Math.round(r.rating * 2) - 1
    if (i >= 0 && i < 10) bins[i]++
  }
  return bins
}

/** "2026-11-06" no fuso do aparelho. */
export function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export interface HeatCell {
  day: string
  count: number
  /** depois de hoje (fica invisível) */
  future: boolean
}

/**
 * Mapa de calor estilo GitHub: 53 colunas (semanas, de domingo a sábado),
 * terminando na semana de hoje.
 */
export function heatmapWeeks(list: Review[], today = new Date()): HeatCell[][] {
  const counts = new Map<string, number>()
  for (const r of list) counts.set(r.experienced_at, (counts.get(r.experienced_at) ?? 0) + 1)
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const start = new Date(end)
  start.setDate(end.getDate() - end.getDay() - 52 * 7) // domingo, 52 semanas antes da semana atual
  const todayKey = isoDay(end)
  const weeks: HeatCell[][] = []
  const d = new Date(start)
  for (let w = 0; w < 53; w++) {
    const week: HeatCell[] = []
    for (let i = 0; i < 7; i++) {
      const day = isoDay(d)
      week.push({ day, count: counts.get(day) ?? 0, future: day > todayKey })
      d.setDate(d.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

/** Intensidade 0 a 4 para a cor da célula. */
export const heatLevel = (n: number) => (n <= 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4)

/** Itens com as notas mais altas (empate: ♥ primeiro, depois o mais recente). */
export function topRated(list: Review[], n = 4): Review[] {
  return rated(latestPerItem(list))
    .sort((a, b) => b.rating - a.rating || Number(b.loved) - Number(a.loved) || newestFirst(a, b))
    .slice(0, n)
}

/** Capas para o mosaico do topo: ♥ e notas altas primeiro, sem repetir. */
export function coverImages(list: Review[], n = 6): string[] {
  const latest = latestPerItem(list).filter((r) => r.item.image_url)
  const ordered = [
    ...latest.filter((r) => r.loved),
    ...latest.filter((r) => !r.loved).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)),
  ]
  return [...new Set(ordered.map((r) => r.item.image_url as string))].slice(0, n)
}

// ---------- Rótulos de gosto ----------

const DECADE_CATS: CategoryId[] = ['album', 'filme', 'serie', 'livro', 'jogo']

function decadeLabel(decade: number): string {
  if (decade >= 2000) return `anos ${decade}`
  return `anos ${String(decade).slice(2)}`
}

/**
 * Até 3 rótulos curtos tirados do próprio diário. Só aparecem com dados suficientes,
 * para não virar horóscopo: cada regra tem um mínimo de entradas.
 */
export function tasteLabels(list: Review[], now = new Date()): string[] {
  const latest = latestPerItem(list)
  const withRating = rated(latest)
  const overall = mean(withRating.map((r) => r.rating)) ?? 0
  const out: { text: string; weight: number }[] = []

  // Exigente / generoso por categoria (mínimo 5 notas na categoria)
  let strict: { text: string; weight: number } | null = null
  let kind: { text: string; weight: number } | null = null
  for (const c of CATEGORIES) {
    const notes = withRating.filter((r) => r.item.category === c.id).map((r) => r.rating)
    if (notes.length < 5) continue
    const a = mean(notes) ?? 0
    if (a <= 3 && (!strict || overall - a > strict.weight)) strict = { text: `Exigente com ${CATEGORY_PLURAL[c.id]}`, weight: overall - a + 1 }
    if (a >= 4.2 && (!kind || a - 4 > kind.weight)) kind = { text: `Generoso com ${CATEGORY_PLURAL[c.id]}`, weight: a - 4 + 1 }
  }
  if (strict) out.push(strict)
  if (kind) out.push(kind)

  // Categoria dominante (mínimo 10 entradas, metade numa categoria só)
  if (list.length >= 10) {
    const counts = new Map<CategoryId, number>()
    for (const r of list) counts.set(r.item.category, (counts.get(r.item.category) ?? 0) + 1)
    const [top, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
    if (n / list.length >= 0.5 && counts.size > 1) out.push({ text: `Movido a ${CATEGORY_PLURAL[top]}`, weight: 0.9 })
  }

  // Década preferida (mínimo 8 itens com ano; 35% numa década que não seja a atual)
  const years = latest.filter((r) => DECADE_CATS.includes(r.item.category) && r.item.year).map((r) => r.item.year as number)
  if (years.length >= 8) {
    const dec = new Map<number, number>()
    for (const y of years) dec.set(Math.floor(y / 10) * 10, (dec.get(Math.floor(y / 10) * 10) ?? 0) + 1)
    const [d, n] = [...dec.entries()].sort((a, b) => b[1] - a[1])[0]
    const current = Math.floor(now.getFullYear() / 10) * 10
    if (d < current && n / years.length >= 0.35) out.push({ text: `Fã dos ${decadeLabel(d)}`, weight: 0.8 })
  }

  // Hábitos
  if (list.filter((r) => r.rewatch).length >= 5) out.push({ text: 'Revê sem culpa', weight: 0.5 })
  if (latest.length >= 10 && latest.filter((r) => r.loved).length / latest.length >= 0.3) out.push({ text: 'Coração mole', weight: 0.4 })
  if (list.filter((r) => (r.body?.length ?? 0) >= 200).length >= 5) out.push({ text: 'Escreve textão', weight: 0.6 })

  return out.sort((a, b) => b.weight - a.weight).slice(0, 3).map((l) => l.text)
}

// ---------- Compatibilidade ----------

/** 100% = mesmas notas; 0% = 4,5 pontos de diferença em média (mesma conta do taste_match). */
export function compatScore(rows: TasteRow[]): number | null {
  if (!rows.length) return null
  const diff = rows.reduce((s, r) => s + Math.abs(r.my_rating - r.their_rating), 0) / rows.length
  return Math.round(100 - (diff / 4.5) * 100)
}

/** O que os dois amam (os dois deram 4,5+) e onde mais discordam (1,5+ de diferença). */
export function compatHighlights(rows: TasteRow[]) {
  const bothLove = rows
    .filter((r) => r.my_rating >= 4.5 && r.their_rating >= 4.5)
    .sort((a, b) => b.my_rating + b.their_rating - (a.my_rating + a.their_rating))
  const clashes = rows
    .filter((r) => Math.abs(r.my_rating - r.their_rating) >= 1.5)
    .sort((a, b) => Math.abs(b.my_rating - b.their_rating) - Math.abs(a.my_rating - a.their_rating))
  return { bothLove, clashes }
}
