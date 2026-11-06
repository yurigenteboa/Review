// Retrospectiva do ano: números calculados do próprio diário (nada novo no banco).
import { CATEGORIES, type CategoryId } from './categories'
import { latestPerItem } from './profileStats'
import type { Review } from './types'

export const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export interface RetroData {
  year: number
  entries: number
  items: number
  days: number
  average: number | null
  byCategory: { category: CategoryId; entries: number; items: number }[]
  topMonth: { month: number; entries: number } | null
  /** maior sequência de dias seguidos com registro */
  longestStreak: { days: number; start: string; end: string } | null
  rewatches: number
  loved: number
  /** maiores notas do ano (uma por item) */
  best: Review[]
}

const dayNumber = (iso: string) => Math.round(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86_400_000)

export function computeRetro(all: Review[], year: number): RetroData {
  const list = all.filter((r) => r.experienced_at.startsWith(String(year)))
  const latest = latestPerItem(list)
  const rated = latest.filter((r) => r.rating != null)

  const byCategory = CATEGORIES.map((c) => ({
    category: c.id,
    entries: list.filter((r) => r.item.category === c.id).length,
    items: latest.filter((r) => r.item.category === c.id).length,
  }))
    .filter((c) => c.entries > 0)
    .sort((a, b) => b.entries - a.entries)

  const perMonth = Array.from({ length: 12 }, () => 0)
  for (const r of list) perMonth[Number(r.experienced_at.slice(5, 7)) - 1]++
  const maxMonth = Math.max(...perMonth)
  const topMonth = maxMonth > 0 ? { month: perMonth.indexOf(maxMonth), entries: maxMonth } : null

  const days = [...new Set(list.map((r) => r.experienced_at.slice(0, 10)))].sort()
  let longest: RetroData['longestStreak'] = null
  let runStart = 0
  for (let i = 0; i < days.length; i++) {
    if (i > 0 && dayNumber(days[i]) - dayNumber(days[i - 1]) !== 1) runStart = i
    const len = i - runStart + 1
    if (!longest || len > longest.days) longest = { days: len, start: days[runStart], end: days[i] }
  }

  return {
    year,
    entries: list.length,
    items: latest.length,
    days: days.length,
    average: rated.length ? rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length : null,
    byCategory,
    topMonth,
    longestStreak: longest,
    rewatches: list.filter((r) => r.rewatch).length,
    loved: latest.filter((r) => r.loved).length,
    best: [...rated].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || Number(b.loved) - Number(a.loved)).slice(0, 5),
  }
}
