import type { SVGProps } from 'react'
import { WORDMARK_PATH, WORDMARK_VIEWBOX } from '../../lib/brand'

/**
 * Marca MMisc no código. Os arquivos-fonte ficam em public/brand/ (ver docs/MARCA.md).
 *
 * - Letreiro "MMisc" (só o nome, uma cor): usa a cor do texto em volta (currentColor),
 *   então funciona no claro e no escuro. Também é desenhado no canvas da retrospectiva.
 * - Símbolo (cartas em leque): /favicon.svg, para espaços pequenos (barra lateral compacta).
 * - Logo completo: /icons/icon-*.png (sempre sobre preto).
 */
interface WordmarkProps extends Omit<SVGProps<SVGSVGElement>, 'viewBox'> {
  /** texto para leitor de tela; vazio = decorativo (quando já há outro rótulo) */
  label?: string
}

export function Wordmark({ label = 'MMisc', ...rest }: WordmarkProps) {
  const { x, y, w, h } = WORDMARK_VIEWBOX
  return (
    <svg
      viewBox={`${x} ${y} ${w} ${h}`}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...rest}
    >
      <path fill="currentColor" d={WORDMARK_PATH} />
    </svg>
  )
}
