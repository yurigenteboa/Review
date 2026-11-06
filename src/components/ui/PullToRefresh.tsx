import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const THRESHOLD = 72 // px puxados (já com resistência) para soltar e atualizar
const MAX = 120
const MIN_SPIN_MS = 600 // a bolinha gira pelo menos isso, para o gesto "ter acontecido"

/**
 * Puxar para atualizar, para telas de toque (o app instalado no iPhone não tem o do navegador,
 * e o `overscroll-behavior: none` do body desliga o do Android).
 * Vale em qualquer tela: com a página no topo, puxar para baixo e soltar recarrega
 * os dados que estão na tela (as consultas ativas do TanStack Query).
 * Fica quieto com uma janela aberta ou quando o gesto é mais lateral que vertical
 * (para não brigar com fileiras que rolam para o lado).
 */
export function PullToRefresh() {
  const qc = useQueryClient()
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const state = useRef({ startY: 0, startX: 0, tracking: false, engaged: false, pull: 0, buzzed: false })

  useEffect(() => {
    const s = state.current
    let frame = 0
    const show = (v: number) => {
      s.pull = v
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setPull(v))
    }

    const onStart = (e: TouchEvent) => {
      if (refreshing || e.touches.length !== 1 || window.scrollY > 0) return
      if (document.querySelector('[aria-modal="true"]')) return
      s.startY = e.touches[0].clientY
      s.startX = e.touches[0].clientX
      s.tracking = true
      s.engaged = false
      s.buzzed = false
    }
    const onMove = (e: TouchEvent) => {
      if (!s.tracking) return
      const dy = e.touches[0].clientY - s.startY
      const dx = Math.abs(e.touches[0].clientX - s.startX)
      if (!s.engaged) {
        // decide nos primeiros pixels: para baixo e mais vertical que lateral
        if (dy < 6 && dx < 6) return
        if (dy <= 0 || dx > dy || window.scrollY > 0) {
          s.tracking = false
          return
        }
        s.engaged = true
      }
      if (e.cancelable) e.preventDefault()
      const v = Math.min(MAX, dy * 0.5) // resistência: o dedo anda o dobro da bolinha
      if (v >= THRESHOLD && !s.buzzed) {
        s.buzzed = true
        navigator.vibrate?.(8) // Android: um toque leve ao passar do ponto
      }
      show(v)
    }
    const onEnd = async () => {
      if (!s.tracking) return
      s.tracking = false
      if (!s.engaged) return
      if (s.pull < THRESHOLD) {
        show(0)
        return
      }
      setRefreshing(true)
      show(THRESHOLD)
      const started = performance.now()
      try {
        await qc.refetchQueries({ type: 'active' })
      } finally {
        const wait = MIN_SPIN_MS - (performance.now() - started)
        if (wait > 0) await new Promise((r) => setTimeout(r, wait))
        setRefreshing(false)
        show(0)
      }
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [qc, refreshing])

  if (pull <= 0 && !refreshing) return null
  const progress = Math.min(1, pull / THRESHOLD)

  return createPortal(
    <div
      className={`ptr ${refreshing ? 'ptr--spinning' : ''} ${progress >= 1 ? 'ptr--ready' : ''}`}
      style={{ transform: `translate(-50%, ${pull}px)`, opacity: Math.max(0.2, progress) }}
      role="status"
      aria-live="polite"
    >
      <span className="visually-hidden">{refreshing ? 'Atualizando' : progress >= 1 ? 'Solte para atualizar' : ''}</span>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" style={{ transform: refreshing ? undefined : `rotate(${progress * 270}deg)` }}>
        <path d="M20 12a8 8 0 1 1-2.34-5.66" />
        <path d="M20 4v4h-4" />
      </svg>
    </div>,
    document.body,
  )
}
