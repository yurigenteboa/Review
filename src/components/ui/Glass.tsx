import type { ElementType, HTMLAttributes, ReactNode, Ref } from 'react'

type Variant = 'card' | 'bar' | 'pill' | 'sheet'

interface GlassProps extends HTMLAttributes<HTMLElement> {
  variant?: Variant
  as?: ElementType
  children?: ReactNode
  /** React 19: ref passa como prop comum (usado pela Sheet para prender o foco) */
  ref?: Ref<HTMLElement>
}

/**
 * Superfície de vidro. Use só no que flutua sobre o conteúdo
 * (barra de abas, cabeçalhos, sheets, cartões sobre imagem).
 */
export function Glass({ variant = 'card', as: Tag = 'div', className = '', children, ...rest }: GlassProps) {
  return (
    <Tag className={`glass glass--${variant} ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  )
}
