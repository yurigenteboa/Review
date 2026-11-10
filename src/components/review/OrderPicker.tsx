import { useMemo, useState } from 'react'
import { catColor, formatRating, type Category, type CategoryId } from '../../lib/categories'
import { haptic } from '../../lib/haptics'
import { useChildItems, type OrderInput } from '../../lib/queries'

import { t } from '../../lib/i18n'
const STAR = 'M12 2.5l2.9 6.2 6.6.7-4.9 4.5 1.4 6.6L12 17.2l-6 3.3 1.4-6.6-4.9-4.5 6.6-.7z'
const MAX_ORDERS = 12

/**
 * Fase 1 · "O que você pediu?" no registro de um lugar.
 * Cada pedido vira uma entrada filha da noite (drink, prato, banheiro), com nota rápida.
 * Mostra primeiro o que já mora no lugar (um toque adiciona); o resto é digitar o nome.
 * O banco reaproveita o item se o nome já existir no lugar (ensure_child_item), então
 * "negroni" e "Negroni" viram a mesma coisa.
 */
export function OrderPicker({
  parentId,
  kinds,
  value,
  onChange,
}: {
  /** lugar já cadastrado; vazio = lugar novo, sem sugestões */
  parentId?: string
  /** o que pode morar no lugar (bar: drink, prato, banheiro) */
  kinds: Category[]
  value: OrderInput[]
  onChange: (next: OrderInput[]) => void
}) {
  const existing = useChildItems(parentId)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<CategoryId>(kinds[0].id)

  const taken = useMemo(() => new Set(value.map((o) => `${o.category}:${o.title.trim().toLowerCase()}`)), [value])
  const term = name.trim().toLowerCase()
  const suggestions = (existing.data ?? [])
    .filter((c) => !taken.has(`${c.category}:${c.title.trim().toLowerCase()}`))
    .filter((c) => !term || c.title.toLowerCase().includes(term))
    .slice(0, term ? 6 : 8)
  const full = value.length >= MAX_ORDERS

  const add = (o: OrderInput) => {
    if (full || taken.has(`${o.category}:${o.title.trim().toLowerCase()}`)) return
    haptic()
    onChange([...value, o])
    setName('')
  }
  const addTyped = () => {
    const t = name.trim()
    if (!t) return
    // digitou o nome de algo que já mora no lugar: usa esse item
    const same = (existing.data ?? []).find((c) => c.category === kind && c.title.trim().toLowerCase() === t.toLowerCase())
    add(same ? { itemId: same.id, title: same.title, category: same.category, rating: null } : { title: t, category: kind, rating: null })
  }
  const setRating = (i: number, rating: number | null) => onChange(value.map((o, j) => (j === i ? { ...o, rating } : o)))
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i))

  return (
    <section className="orders" aria-label={t('O que você pediu')}>
      <span className="field-label">{t('O que você pediu?')}</span>

      {value.length > 0 && (
        <ul className="group orders__list">
          {value.map((o, i) => (
            <li key={`${o.category}:${o.title}`} className="group__row orders__row">
              <span className="orders__dot" style={{ background: catColor(o.category) }} aria-hidden="true" />
              <span className="orders__name">
                <strong>{o.title}</strong>
                <span>{kinds.find((k) => k.id === o.category)?.label}</span>
              </span>
              <MiniRating label={o.title} value={o.rating} onChange={(r) => setRating(i, r)} />
              <button type="button" className="orders__remove tap" aria-label={t('Tirar {title}', { title: o.title })} onClick={() => remove(i)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {!full && (
        <>
          <div className="orders__add">
            <div className="segmented" role="radiogroup" aria-label={t('Tipo')} style={{ gridTemplateColumns: `repeat(${kinds.length}, minmax(0, 1fr))` }}>
              {kinds.map((k) => (
                <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} onClick={() => setKind(k.id)}>
                  {k.label}
                </button>
              ))}
            </div>
            <div className="orders__field">
              <input
                className="field"
                value={name}
                placeholder={kind === 'drink' ? t('Ex.: Negroni') : kind === 'prato' ? t('Ex.: Coxinha') : t('Nome (ex.: Banheiro do térreo)')}
                aria-label={t('Nome: {tipo}', { tipo: kinds.find((k) => k.id === kind)?.label ?? '' })}
                enterKeyHint="done"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTyped()
                  }
                }}
              />
              <button type="button" className="btn btn--plain tap orders__add-btn" disabled={!name.trim()} onClick={addTyped}>
                {t('Adicionar')}
              </button>
            </div>
          </div>

          {suggestions.length > 0 && (
            <div className="chips orders__suggest" role="group" aria-label={term ? t('Parecidos neste lugar') : t('Mais pedidos neste lugar')}>
              {suggestions.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="chip tap"
                  onClick={() => add({ itemId: c.id, title: c.title, category: c.category, rating: null })}
                >
                  + {c.title}
                  {c.rated > 0 && <span className="orders__avg"> {formatRating(c.avg)}</span>}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

/** Nota compacta por pedido: toque = estrela inteira, tocar de novo na mesma = meia, de novo = sem nota. */
function MiniRating({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  const v = value ?? 0
  return (
    <div className="mini-rating" role="radiogroup" aria-label={t('Nota de {label}', { label })}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = v >= i ? 100 : v >= i - 0.5 ? 50 : 0
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={Math.ceil(v) === i}
            aria-label={`${i} ${i === 1 ? 'estrela' : 'estrelas'}`}
            className="mini-rating__star"
            onClick={() => {
              haptic()
              // inteira -> meia -> sem nota
              if (v === i) onChange(i - 0.5)
              else if (v === i - 0.5) onChange(null)
              else onChange(i)
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <path d={STAR} fill="var(--star-empty)" />
            </svg>
            <span className="mini-rating__fill" style={{ width: `${(fill / 100) * 22}px` }} aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24">
                <path d={STAR} fill="var(--star)" />
              </svg>
            </span>
          </button>
        )
      })}
    </div>
  )
}
