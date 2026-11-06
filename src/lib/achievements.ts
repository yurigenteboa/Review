// Conquistas do perfil, com moderação: poucas, calculadas do diário (sem tabela nova),
// sem notificação e sem contador de sequência. Quem vê o perfil só vê as conquistadas;
// o dono também vê o progresso das que faltam.
import { CATEGORIES, catColor, type CategoryId } from './categories'
import { latestPerItem } from './profileStats'
import type { Review } from './types'

export interface Achievement {
  id: string
  title: string
  /** o que precisa para conquistar */
  goal: string
  /** cor do selo (token de categoria ou de destaque) */
  color: string
  /** símbolo curto no selo */
  mark: string
  progress: number
  target: number
  unlocked: boolean
}

const itemsIn = (list: Review[], cat: CategoryId) => latestPerItem(list.filter((r) => r.item.category === cat)).length

/** Meses com registro no ano em que a pessoa mais teve meses ativos. */
function bestYearMonths(list: Review[]): { year: number | null; months: number } {
  const byYear = new Map<number, Set<number>>()
  for (const r of list) {
    const y = Number(r.experienced_at.slice(0, 4))
    const m = Number(r.experienced_at.slice(5, 7))
    if (!byYear.has(y)) byYear.set(y, new Set())
    byYear.get(y)!.add(m)
  }
  let best: { year: number | null; months: number } = { year: null, months: 0 }
  for (const [y, set] of byYear) if (set.size > best.months) best = { year: y, months: set.size }
  return best
}

export function computeAchievements(list: Review[]): Achievement[] {
  const cats = new Set(list.map((r) => r.item.category)).size
  const longTexts = list.filter((r) => (r.body?.trim().length ?? 0) >= 140).length
  const months = bestYearMonths(list).months

  const defs: Omit<Achievement, 'unlocked'>[] = [
    { id: 'ecletico', title: 'Eclético', goal: `Avaliar nas ${CATEGORIES.length} categorias`, color: 'var(--accent)', mark: '✦', progress: cats, target: CATEGORIES.length },
    { id: 'cinefilo', title: 'Cinéfilo', goal: '50 filmes no diário', color: catColor('filme'), mark: '50', progress: itemsIn(list, 'filme'), target: 50 },
    { id: 'ouvinte', title: 'Ouvido atento', goal: '50 álbuns no diário', color: catColor('album'), mark: '50', progress: itemsIn(list, 'album'), target: 50 },
    { id: 'bares', title: 'De bar em bar', goal: '10 bares avaliados', color: catColor('bar'), mark: '10', progress: itemsIn(list, 'bar'), target: 10 },
    { id: 'banheiros', title: 'Banheirólogo', goal: '10 banheiros avaliados', color: catColor('banheiro'), mark: '10', progress: itemsIn(list, 'banheiro'), target: 10 },
    { id: 'cidades', title: 'Viajante', goal: '5 cidades avaliadas', color: catColor('cidade'), mark: '5', progress: itemsIn(list, 'cidade'), target: 5 },
    { id: 'critico', title: 'Crítico', goal: '10 reviews com texto de verdade (140+ caracteres)', color: catColor('livro'), mark: '✎', progress: longTexts, target: 10 },
    { id: 'ano', title: 'Ano inteiro', goal: 'Registrar algo em todos os 12 meses de um mesmo ano', color: catColor('jogo'), mark: '12', progress: months, target: 12 },
  ]
  return defs.map((d) => ({ ...d, progress: Math.min(d.progress, d.target), unlocked: d.progress >= d.target }))
}
