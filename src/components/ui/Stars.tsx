const STAR = 'M12 2.5l2.9 6.2 6.6.7-4.9 4.5 1.4 6.6L12 17.2l-6 3.3 1.4-6.6-4.9-4.5 6.6-.7z'

interface StarsProps {
  /** Nota de 0 a 5, aceita meia estrela (4.5) */
  value: number
  size?: number
}

/** Exibe a nota com estrelas cheias, meias e vazias. */
export function Stars({ value, size = 14 }: StarsProps) {
  return (
    <span className="stars" role="img" aria-label={`${value.toString().replace('.', ',')} de 5 estrelas`}>
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
  )
}
