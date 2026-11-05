const STAR = 'M12 2.5l2.9 6.2 6.6.7-4.9 4.5 1.4 6.6L12 17.2l-6 3.3 1.4-6.6-4.9-4.5 6.6-.7z'

export function ratingWord(r: number): string {
  if (!r) return 'Toque para dar nota'
  const n = r.toFixed(1).replace('.', ',')
  if (r <= 1) return `${n} · Péssimo`
  if (r <= 2) return `${n} · Ruim`
  if (r <= 3) return `${n} · Ok`
  if (r <= 4) return `${n} · Muito bom`
  if (r < 5) return `${n} · Excelente`
  return '5,0 · Obra-prima'
}

/** Nota de 0,5 a 5. Tocar de novo na mesma estrela vira meia estrela. */
export function RatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div role="radiogroup" aria-label="Nota" style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = value >= i ? 100 : value >= i - 0.5 ? 50 : 0
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={value === i || value === i - 0.5}
              aria-label={`${i} ${i === 1 ? 'estrela' : 'estrelas'}`}
              className="tap"
              onClick={() => onChange(value === i ? i - 0.5 : i)}
              style={{ position: 'relative', width: 52, height: 52, padding: 0, border: 'none', background: 'none' }}
            >
              <svg width="44" height="44" viewBox="0 0 24 24" aria-hidden="true" style={{ position: 'absolute', left: 4, top: 4 }}>
                <path d={STAR} fill="var(--star-empty)" />
              </svg>
              <span style={{ position: 'absolute', left: 4, top: 4, height: 44, width: `${(fill / 100) * 44}px`, overflow: 'hidden' }}>
                <svg width="44" height="44" viewBox="0 0 24 24" aria-hidden="true">
                  <path d={STAR} fill="var(--star)" />
                </svg>
              </span>
            </button>
          )
        })}
      </div>
      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)' }}>{ratingWord(value)}</span>
      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Toque de novo na mesma estrela para meia estrela</span>
    </div>
  )
}

/** Critério de 1 a 5 em bolinhas. Tocar no valor atual zera. */
export function CriterionInput({
  label,
  value,
  color,
  onChange,
}: {
  label: string
  value: number
  color: string
  onChange: (v: number) => void
}) {
  return (
    <div className="group__row" style={{ justifyContent: 'space-between' }}>
      <span>{label}</span>
      <div style={{ display: 'flex', gap: 2 }} role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            aria-label={`${label}: ${v} de 5`}
            onClick={() => onChange(value === v ? 0 : v)}
            style={{ width: 32, height: 40, padding: 0, border: 'none', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <span style={{ width: 20, height: 20, borderRadius: 10, background: value >= v ? color : 'var(--fill)' }} />
          </button>
        ))}
      </div>
    </div>
  )
}
