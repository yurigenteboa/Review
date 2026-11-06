import { useRef } from 'react'
import { haptic } from '../../lib/haptics'

const STAR = 'M12 2.5l2.9 6.2 6.6.7-4.9 4.5 1.4 6.6L12 17.2l-6 3.3 1.4-6.6-4.9-4.5 6.6-.7z'

export function ratingWord(r: number): string {
  if (!r) return 'Toque ou arraste para dar nota'
  const n = r.toFixed(1).replace('.', ',')
  if (r <= 1) return `${n} · Péssimo`
  if (r <= 2) return `${n} · Ruim`
  if (r <= 3) return `${n} · Ok`
  if (r <= 4) return `${n} · Muito bom`
  if (r < 5) return `${n} · Excelente`
  return '5,0 · Obra-prima'
}

/**
 * Nota de 0,5 a 5 (M2: arrastar).
 * - Toque ou arraste o dedo/mouse pela fileira: a nota segue o dedo, de meia em meia estrela
 *   (metade esquerda de uma estrela = meia). Vibra levinho a cada mudança.
 * - Tocar de novo na mesma estrela inteira ainda vira meia (o jeito antigo continua valendo).
 * - Teclado: setas mudam de 0,5 em 0,5.
 * `touch-action: pan-y` deixa a página rolar na vertical e entrega o arraste lateral para cá.
 */
export function RatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const row = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; startValue: number; moved: boolean; startX: number } | null>(null)
  const last = useRef(value)
  last.current = value

  const valueAt = (clientX: number) => {
    const el = row.current
    if (!el) return value
    const r = el.getBoundingClientRect()
    const x = Math.min(Math.max(clientX - r.left, 0), r.width - 0.01)
    return Math.max(0.5, Math.ceil((x / r.width) * 10) / 2)
  }
  const set = (v: number) => {
    if (v === last.current) return
    last.current = v
    haptic()
    onChange(v)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div
        ref={row}
        role="slider"
        tabIndex={0}
        aria-label="Nota"
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={value}
        aria-valuetext={value ? ratingWord(value) : 'Sem nota'}
        className="rating-input"
        onPointerDown={(e) => {
          if (e.button !== 0) return
          e.currentTarget.setPointerCapture(e.pointerId)
          drag.current = { id: e.pointerId, startValue: value, moved: false, startX: e.clientX }
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d || d.id !== e.pointerId) return
          if (!d.moved && Math.abs(e.clientX - d.startX) < 6) return
          d.moved = true
          set(valueAt(e.clientX))
        }}
        onPointerUp={(e) => {
          const d = drag.current
          drag.current = null
          if (!d || d.moved) return
          // toque simples: estrela inteira; tocar de novo na mesma vira meia
          const whole = Math.ceil(valueAt(e.clientX))
          set(d.startValue === whole ? whole - 0.5 : whole)
        }}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') set(Math.min(5, (value || 0) + 0.5))
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') set(Math.max(0.5, (value || 1) - 0.5))
          else return
          e.preventDefault()
        }}
      >
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = value >= i ? 100 : value >= i - 0.5 ? 50 : 0
          return (
            <span key={i} className="rating-input__star" aria-hidden="true">
              <svg width="44" height="44" viewBox="0 0 24 24" style={{ position: 'absolute', left: 4, top: 4 }}>
                <path d={STAR} fill="var(--star-empty)" />
              </svg>
              <span style={{ position: 'absolute', left: 4, top: 4, height: 44, width: `${(fill / 100) * 44}px`, overflow: 'hidden' }}>
                <svg width="44" height="44" viewBox="0 0 24 24">
                  <path d={STAR} fill="var(--star)" />
                </svg>
              </span>
            </span>
          )
        })}
      </div>
      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)' }}>{ratingWord(value)}</span>
      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Toque ou arraste nas estrelas · toque de novo para meia</span>
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
