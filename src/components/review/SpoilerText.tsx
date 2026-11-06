import { useState } from 'react'

/**
 * Texto de review com proteção de spoiler.
 * - Trechos entre ||barras duplas|| aparecem borrados até o toque.
 * - Se `whole` for true (marcação "Contém spoiler", que chega na F2), o texto inteiro fica borrado.
 */
export function SpoilerText({ text, whole = false, className }: { text: string; whole?: boolean; className?: string }) {
  if (whole) {
    return (
      <p className={className}>
        <Hidden>{text}</Hidden>
      </p>
    )
  }
  const parts = text.split(/\|\|([\s\S]+?)\|\|/g)
  if (parts.length === 1) return <p className={className}>{text}</p>
  return (
    <p className={className}>
      {/* índices ímpares são os trechos que estavam entre || || */}
      {parts.map((part, i) => (i % 2 === 1 ? <Hidden key={i}>{part}</Hidden> : <span key={i}>{part}</span>))}
    </p>
  )
}

function Hidden({ children }: { children: string }) {
  const [shown, setShown] = useState(false)
  if (shown) return <span className="spoiler spoiler--shown">{children}</span>
  return (
    <button type="button" className="spoiler" onClick={() => setShown(true)} aria-label="Spoiler escondido. Toque para mostrar">
      <span aria-hidden="true">{children}</span>
    </button>
  )
}

