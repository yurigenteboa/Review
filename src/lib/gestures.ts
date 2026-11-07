import { useRef, type MouseEvent, type PointerEvent, type SyntheticEvent } from 'react'

/** Eventos do React atravessam portais (janelas abertas a partir do card): ignora o que não é do card. */
const outside = (e: SyntheticEvent) => !(e.currentTarget as Node).contains(e.target as Node)

/**
 * Segurar (M3). Toque: ~480 ms parado. Android e mouse (botão direito) também chegam
 * pelo `contextmenu`. Depois de disparar, o clique que viria em seguida é engolido
 * (para não abrir o link que estava embaixo do dedo).
 */
export function useLongPress(onLong: () => void, ms = 480) {
  const timer = useRef<number | undefined>(undefined)
  const start = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)

  const cancel = () => {
    window.clearTimeout(timer.current)
    start.current = null
  }
  const fire = () => {
    cancel()
    fired.current = true
    onLong()
  }

  return {
    onPointerDown: (e: PointerEvent) => {
      fired.current = false
      if (e.pointerType !== 'touch' || outside(e)) return
      start.current = { x: e.clientX, y: e.clientY }
      timer.current = window.setTimeout(fire, ms)
    },
    onPointerMove: (e: PointerEvent) => {
      const s = start.current
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: MouseEvent) => {
      if (outside(e)) return
      e.preventDefault()
      if (!fired.current) fire()
    },
    onClickCapture: (e: MouseEvent) => {
      if (!fired.current) return
      fired.current = false
      e.preventDefault()
      e.stopPropagation()
    },
  }
}

/**
 * Dois toques rápidos (M3), fora de links e botões. Funciona com dedo e mouse.
 */
export function useDoubleTap(onDouble: (pos: { x: number; y: number }) => void, gap = 300) {
  const last = useRef<{ t: number; x: number; y: number } | null>(null)
  return {
    onPointerUp: (e: PointerEvent) => {
      if (outside(e) || (e.target as Element).closest('a, button, input, label, [role="button"]')) return
      const now = performance.now()
      const l = last.current
      if (l && now - l.t < gap && Math.hypot(e.clientX - l.x, e.clientY - l.y) < 30) {
        last.current = null
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        onDouble({ x: e.clientX - r.left, y: e.clientY - r.top })
        return
      }
      last.current = { t: now, x: e.clientX, y: e.clientY }
    },
  }
}
