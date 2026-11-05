import type { ReactNode } from 'react'
import { Glass } from './Glass'

interface PageHeaderProps {
  title: string
  subtitle?: string
  /** Botão ou avatar à direita do título */
  trailing?: ReactNode
  /** Conteúdo abaixo do título (chips, campo de busca) */
  children?: ReactNode
}

/** Cabeçalho fixo com título grande e fundo de vidro, como no iOS. */
export function PageHeader({ title, subtitle, trailing, children }: PageHeaderProps) {
  return (
    <Glass as="header" variant="bar" className="page-header">
      <div className="page-header__row">
        <h1 className="page-header__title">{title}</h1>
        {trailing}
      </div>
      {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      {children && <div className="page-header__extra">{children}</div>}
    </Glass>
  )
}
