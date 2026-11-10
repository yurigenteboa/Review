import { useState } from 'react'
import { Cover } from '../review/ReviewCard'
import { Sheet } from '../ui/Sheet'
import type { CategoryId } from '../../lib/categories'
import { useDebounced } from '../../lib/hooks'
import { useSearchItems } from '../../lib/queries'
import type { Item } from '../../lib/types'

import { t } from '../../lib/i18n'
/**
 * Escolher um item: primeiro o que está no seu diário (da categoria), e uma busca
 * no que já existe no MMisc. Usado por favoritos e "agora".
 */
export function ItemPicker({
  open,
  onClose,
  title,
  category,
  diary,
  onPick,
  busy,
}: {
  open: boolean
  onClose: () => void
  title: string
  category: CategoryId
  diary: Item[]
  onPick: (item: Item) => void
  busy?: boolean
}) {
  const [term, setTerm] = useState('')
  const q = useDebounced(term.trim(), 300)
  const search = useSearchItems(q.length >= 2 ? q : '', category)
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const mine = diary.filter((i) => !q || norm(i.title).includes(norm(q)))
  const others = q.length >= 2 ? (search.data ?? []).filter((i) => !diary.some((d) => d.id === i.id)) : []

  const row = (i: Item) => (
    <button key={i.id} type="button" className="group__row tap picker__row" disabled={busy} onClick={() => onPick(i)}>
      <Cover item={i} size={44} radius={8} />
      <span className="picker__text">
        <strong>{i.title}</strong>
        {(i.subtitle || i.year) && <span>{i.subtitle ?? i.year}</span>}
      </span>
    </button>
  )

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="picker">
        <label className="search-field">
          <span className="visually-hidden">{t('Buscar')}</span>
          <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('Buscar pelo nome')} autoFocus />
        </label>
        {mine.length > 0 && (
          <>
            <h3 className="picker__heading">{t('Do seu diário')}</h3>
            <div className="group">{mine.slice(0, 40).map(row)}</div>
          </>
        )}
        {others.length > 0 && (
          <>
            <h3 className="picker__heading">{t('No MMisc')}</h3>
            <div className="group">{others.map(row)}</div>
          </>
        )}
        {!mine.length && !others.length && (
          <p className="empty-note">{q.length >= 2 ? t('Nada encontrado. Registre o item pelo + para ele aparecer aqui.') : t('Nada no seu diário nesta categoria ainda.')}</p>
        )}
      </div>
    </Sheet>
  )
}
