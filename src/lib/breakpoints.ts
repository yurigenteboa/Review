import { useSyncExternalStore } from 'react'

/**
 * Tamanhos de tela do MMISC. Os mesmos números estão nos @media do CSS
 * (CSS não aceita variável dentro de @media), então mude nos dois lugares.
 *  - celular: até 699px (o app como sempre foi)
 *  - tablet:  700 a 1099px (barra lateral só com ícones)
 *  - desktop: 1100px ou mais (barra lateral com nomes + painel à direita)
 */
export const BREAKPOINTS = { tablet: 700, desktop: 1100 } as const

export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

const QUERIES = {
  tablet: `(min-width: ${BREAKPOINTS.tablet}px)`,
  desktop: `(min-width: ${BREAKPOINTS.desktop}px)`,
  /** Mouse ou trackpad: só aí faz sentido hover e atalhos de teclado visíveis. */
  finePointer: '(hover: hover) and (pointer: fine)',
} as const

function current(): Breakpoint {
  if (typeof window === 'undefined') return 'mobile'
  if (window.matchMedia(QUERIES.desktop).matches) return 'desktop'
  if (window.matchMedia(QUERIES.tablet).matches) return 'tablet'
  return 'mobile'
}

function subscribe(onChange: () => void) {
  const lists = Object.values(QUERIES).map((q) => window.matchMedia(q))
  lists.forEach((l) => l.addEventListener('change', onChange))
  return () => lists.forEach((l) => l.removeEventListener('change', onChange))
}

/**
 * Em que tamanho de tela o app está agora. Re-renderiza só quando cruza um corte
 * (não a cada pixel de redimensionamento).
 * Prefira CSS (@media) para mudar aparência; use o hook quando a ESTRUTURA muda
 * (ex.: barra de abas embaixo vs. barra lateral, sheet vs. janela no centro).
 */
export function useBreakpoint(): Breakpoint {
  return useSyncExternalStore(subscribe, current, () => 'mobile')
}

/** true quando há mouse/trackpad (hover de verdade). */
export function useFinePointer(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => typeof window !== 'undefined' && window.matchMedia(QUERIES.finePointer).matches,
    () => false,
  )
}
