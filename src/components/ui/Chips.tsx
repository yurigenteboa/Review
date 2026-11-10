import { TOP_CATEGORIES, type CategoryId } from '../../lib/categories'

import { t } from '../../lib/i18n'
type Value = CategoryId | 'all'

interface CategoryChipsProps {
  value: Value
  onChange: (v: Value) => void
  /** Mostra o chip "Tudo" no começo */
  withAll?: boolean
}

/** Fileira rolável de chips de categoria. */
export function CategoryChips({ value, onChange, withAll = true }: CategoryChipsProps) {
  const options: { id: Value; label: string }[] = [
    ...(withAll ? [{ id: 'all' as const, label: t('Tudo') }] : []),
    ...TOP_CATEGORIES,
  ]
  return (
    <div className="chips no-scrollbar" role="group" aria-label={t('Filtrar por categoria')}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className="chip tap"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
