import { useMemo, useState } from 'react'
import { CATEGORY_PLURAL } from '../../lib/profileStats'
import { formatRating, type CategoryId } from '../../lib/categories'
import { haptic } from '../../lib/haptics'
import type { PlaceRank } from '../../lib/queries'

import { t } from '../../lib/i18n'
export type Bucket = 1 | 2 | 3
export interface CompareResult {
  bucket: Bucket
  pos: number
  rating: number
  /** posição entre TODOS os seus lugares da categoria (1 = o melhor) */
  place: number
  total: number
}

const BUCKETS: { id: Bucket; label: string; emoji: string }[] = [
  { id: 3, label: t('Gostei'), emoji: '😍' },
  { id: 2, label: t('Ok'), emoji: '🙂' },
  { id: 1, label: t('Não gostei'), emoji: '😕' },
]
/** Faixa de nota de cada grupo (na escala de 0,5 a 5 que o resto do app usa). */
const RANGE: Record<Bucket, [number, number]> = { 3: [4, 5], 2: [2.5, 3.5], 1: [0.5, 2] }

/**
 * Nota pela posição, para k de 0 (pior do grupo) a n (melhor), com n já ranqueados no grupo.
 * f = (k+1)/(n+2) deixa o primeiro de um grupo no meio da faixa (gostei -> 4,5) e abre espaço
 * para os próximos acima e abaixo. Arredonda para meia estrela, que é o que o banco aceita.
 */
export function ratingFor(bucket: Bucket, k: number, n: number): number {
  const [lo, hi] = RANGE[bucket]
  const raw = lo + (hi - lo) * ((k + 1) / (n + 2))
  return Math.min(hi, Math.max(lo, Math.round(raw * 2) / 2))
}

/** Posição numérica entre os vizinhos (maior = melhor), sem renumerar ninguém. */
export function posBetween(worse: number | undefined, better: number | undefined): number {
  if (worse != null && better != null) return (worse + better) / 2
  if (worse != null) return worse + 1
  if (better != null) return better - 1
  return 0
}

/**
 * Fase 2 · nota por comparação (estilo Beli) para bar, restaurante e café.
 * 1) Gostei / Ok / Não gostei.  2) "Melhor ou pior que X?" por busca binária entre os seus
 * lugares do mesmo grupo: com 15 lugares, no máximo 4 perguntas.  A nota sai da posição.
 */
export function CompareRating({
  category,
  itemId,
  ranks,
  value,
  onChange,
}: {
  category: CategoryId
  /** o próprio lugar (se já ranqueado antes, sai da lista para ser comparado de novo) */
  itemId?: string
  ranks: PlaceRank[]
  value: CompareResult | null
  onChange: (v: CompareResult | null) => void
}) {
  const others = useMemo(() => ranks.filter((r) => r.item_id !== itemId), [ranks, itemId])
  const [bucket, setBucket] = useState<Bucket | null>(value?.bucket ?? null)
  const [range, setRange] = useState<{ lo: number; hi: number } | null>(null)

  // lista do grupo do pior para o melhor
  const group = useMemo(
    () => (bucket ? others.filter((r) => r.bucket === bucket).sort((a, b) => a.pos - b.pos) : []),
    [others, bucket],
  )

  const finish = (b: Bucket, list: PlaceRank[], k: number) => {
    const pos = posBetween(list[k - 1]?.pos, list[k]?.pos)
    const better = others.filter((r) => r.bucket > b).length + (list.length - k)
    onChange({ bucket: b, pos, rating: ratingFor(b, k, list.length), place: better + 1, total: others.length + 1 })
    setRange(null)
    haptic('success')
  }

  const choose = (b: Bucket) => {
    haptic()
    setBucket(b)
    const list = others.filter((r) => r.bucket === b).sort((a, c) => a.pos - c.pos)
    if (list.length === 0) finish(b, list, 0)
    else {
      onChange(null)
      setRange({ lo: 0, hi: list.length })
    }
  }

  const answer = (better: boolean | 'empate') => {
    if (!range || !bucket) return
    haptic()
    const mid = Math.floor((range.lo + range.hi) / 2)
    const next = better === 'empate' ? { lo: mid + 1, hi: mid + 1 } : better ? { lo: mid + 1, hi: range.hi } : { lo: range.lo, hi: mid }
    if (next.lo >= next.hi) finish(bucket, group, next.lo)
    else setRange(next)
  }

  const restart = () => {
    setBucket(null)
    setRange(null)
    onChange(null)
  }

  const mid = range ? Math.floor((range.lo + range.hi) / 2) : -1
  const against = range ? group[mid] : null
  const plural = CATEGORY_PLURAL[category]

  return (
    <section className="compare" aria-label={t('Nota por comparação')}>
      {!range && !value && (
        <>
          <span className="compare__q">{t('Como foi?')}</span>
          <div className="compare__buckets" role="group" aria-label={t('Como foi')}>
            {BUCKETS.map((b) => (
              <button key={b.id} type="button" className="compare__bucket tap" aria-pressed={bucket === b.id} onClick={() => choose(b.id)}>
                <span aria-hidden="true">{b.emoji}</span>
                {b.label}
              </button>
            ))}
          </div>
        </>
      )}

      {range && against && (
        <div className="compare__vs" role="group" aria-live="polite">
          <span className="compare__q">{t('Melhor ou pior que…')}</span>
          <strong className="compare__other">{against.title}</strong>
          <div className="compare__answers">
            <button type="button" className="btn btn--primary tap" onClick={() => answer(true)}>
              {t('Melhor')}
            </button>
            <button type="button" className="btn btn--plain tap" onClick={() => answer(false)}>
              {t('Pior')}
            </button>
          </div>
          <button type="button" className="link-btn" onClick={() => answer('empate')}>
            {t('Parecido')}
          </button>
        </div>
      )}

      {value && (
        <div className="compare__done" role="status">
          <span className="compare__score">{formatRating(value.rating)}</span>
          <span className="compare__place">
            {value.total === 1 ? t('O primeiro no seu ranking de {plural}', { plural }) : t('{place}º de {total} no seu ranking de {plural}', { place: value.place, total: value.total, plural })}
          </span>
          <button type="button" className="link-btn" onClick={restart}>
            {t('Refazer')}
          </button>
        </div>
      )}
    </section>
  )
}
