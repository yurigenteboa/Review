import { TOP_CATEGORIES, type CategoryId } from '../../lib/categories'

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
    ...(withAll ? [{ id: 'all' as const, label: 'Tudo' }] : []),
    ...TOP_CATEGORIES,
  ]
  return (
    <div className="chips no-scrollbar" role="group" aria-label="Filtrar por categoria">
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
