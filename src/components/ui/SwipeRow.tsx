import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { haptic } from '../../lib/haptics'

export interface SwipeAction {
  label: string
  onPress: () => void
  tone?: 'plain' | 'danger'
}

const ACTION_W = 84

/**
 * Linha que se arrasta para a esquerda e mostra ações (M3), como nas listas do iOS.
 * Só reage a toque (no desktop as mesmas ações ficam na página do item).
 * Rolagem vertical continua livre (`touch-action: pan-y`); com a linha aberta,
 * um toque nela fecha em vez de abrir o link.
 */
export function SwipeRow({ actions, children }: { actions: SwipeAction[]; children: ReactNode }) {
  const max = actions.length * ACTION_W
  const [x, setX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const g = useRef<{ id: number; x0: number; y0: number; base: number; locked: boolean | null } | null>(null)

  const onDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return
    g.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, base: x, locked: null }
  }
  const onMove = (e: PointerEvent) => {
    const s = g.current
    if (!s || s.id !== e.pointerId) return
    const dx = e.clientX - s.x0
    const dy = e.clientY - s.y0
    if (s.locked === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      s.locked = Math.abs(dx) > Math.abs(dy) // lateral = nosso; vertical = rolagem da página
      if (!s.locked) {
        g.current = null
        return
      }
      setDragging(true)
    }
    setX(Math.max(-max - 24, Math.min(0, s.base + dx)))
  }
  const onUp = () => {
    const s = g.current
    g.current = null
    if (!s?.locked) return
    setDragging(false)
    const open = x < -max / 2
    if (open && s.base === 0) haptic()
    setX(open ? -max : 0)
  }

  return (
    <div className={`swipe-row ${x !== 0 ? 'is-open' : ''}`}>
      <div className="swipe-row__actions" style={{ width: max }} aria-hidden={x === 0}>
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            tabIndex={x === 0 ? -1 : 0}
            className={`swipe-row__btn ${a.tone === 'danger' ? 'swipe-row__btn--danger' : ''}`}
            onClick={() => {
              a.onPress()
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div
        className="swipe-row__content"
        style={{ transform: `translateX(${x}px)`, transition: dragging ? 'none' : undefined }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onClickCapture={(e) => {
          if (x !== 0) {
            e.preventDefault()
            e.stopPropagation()
            setX(0)
          }
        }}
      >
        {children}
      </div>
    </div>
  )
}
