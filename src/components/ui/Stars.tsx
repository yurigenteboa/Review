import { t } from '../../lib/i18n'
import { useAppearance } from '../../lib/appearance'
import { formatRating } from '../../lib/categories'

const STAR = 'M12 2.5l2.9 6.2 6.6.7-4.9 4.5 1.4 6.6L12 17.2l-6 3.3 1.4-6.6-4.9-4.5 6.6-.7z'

interface StarsProps {
  /** Nota de 0 a 5, aceita meia estrela (4.5) */
  value: number
  size?: number
  /** Quem chama já mostra a nota em número ao lado (aí o número não se repete). */
  withNumber?: boolean
}

/**
 * Exibe a nota no formato escolhido em Aparência:
 * - estrelas (padrão): estrelas cheias, meias e vazias;
 * - número: "★ 4,5" (ou nada, se o número já aparece ao lado);
 * - os dois: estrelas + número (o número só se ainda não estiver ao lado).
 */
export function Stars({ value, size = 14, withNumber = false }: StarsProps) {
  const { nota } = useAppearance()
  const label = t('{nota} de 5 estrelas', { nota: formatRating(value) })
  if (nota === 'numero') {
    if (withNumber) return null
    return (
      <span className="stars-num" role="img" aria-label={label} style={{ fontSize: `${size / 16}rem` }}>
        <span aria-hidden="true">
          <span className="stars-num__star">★</span> {formatRating(value)}
        </span>
      </span>
    )
  }
  return (
    <span className="stars-wrap">
      <span className="stars" role="img" aria-label={label}>
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = value >= i ? 100 : value >= i - 0.5 ? 50 : 0
          return (
            <span key={i} className="star" style={{ width: size, height: size }}>
              <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
                <path d={STAR} fill="var(--star-empty)" />
              </svg>
              <span className="star__fill" style={{ width: `${fill}%` }}>
                <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
                  <path d={STAR} fill="var(--star)" />
                </svg>
              </span>
            </span>
          )
        })}
      </span>
      {nota === 'ambos' && !withNumber && (
        <span className="stars-num" aria-hidden="true" style={{ fontSize: `${size / 16}rem` }}>
          {formatRating(value)}
        </span>
      )}
    </span>
  )
}
