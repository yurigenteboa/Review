import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { prefersReducedMotion } from '../../lib/appearance'
import { isStandaloneIOS } from '../../lib/auth'
import { haptic } from '../../lib/haptics'

const EDGE = 24 // px da borda esquerda onde o gesto pode começar
const DECIDE = 10 // px de movimento para decidir se é gesto lateral ou rolagem
const TRIGGER = 90 // px arrastados para voltar
const FLICK = 0.5 // px/ms: um "peteleco" rápido também volta

/**
 * M1: arrastar da borda esquerda para voltar, como nos apps do iPhone.
 * Só no app instalado do iPhone/iPad: no Safari o próprio navegador já faz isso
 * (os dois juntos brigariam) e o Android tem o gesto de voltar do sistema.
 * A tela acompanha o dedo pela propriedade CSS `translate`, separada do `transform`
 * que o motion usa nas transições, então um não atrapalha o outro.
 */
export function EdgeSwipeBack() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isStandaloneIOS()) return
    const reduce = prefersReducedMotion()

    let startX = 0
    let startY = 0
    let startT = 0
    let state: 'idle' | 'deciding' | 'dragging' = 'idle'
    let main: HTMLElement | null = null
    let dx = 0

    const canGoBack = () => {
      const idx = (window.history.state as { idx?: number } | null)?.idx
      return typeof idx === 'number' && idx > 0
    }
    const setX = (x: number, animate: boolean) => {
      if (!main) return
      main.style.transition = animate && !reduce ? 'translate .22s cubic-bezier(.2,.8,.2,1)' : 'none'
      main.style.translate = x ? `${x}px 0` : ''
    }

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (e.touches.length !== 1 || t.clientX > EDGE || !canGoBack()) return
      // janela aberta (registro, comentários, menus) tem o próprio gesto
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      main = document.getElementById('conteudo')
      if (!main) return
      startX = t.clientX
      startY = t.clientY
      startT = e.timeStamp
      dx = 0
      state = 'deciding'
    }

    const onMove = (e: TouchEvent) => {
      if (state === 'idle') return
      const t = e.touches[0]
      const mx = t.clientX - startX
      const my = t.clientY - startY
      if (state === 'deciding') {
        if (Math.abs(mx) < DECIDE && Math.abs(my) < DECIDE) return
        // vertical ou para a esquerda = é rolagem, não gesto
        if (Math.abs(my) > Math.abs(mx) || mx < 0) {
          state = 'idle'
          return
        }
        state = 'dragging'
      }
      e.preventDefault()
      dx = Math.max(0, mx)
      setX(dx * 0.9, false)
    }

    const onEnd = (e: TouchEvent) => {
      if (state !== 'dragging') {
        state = 'idle'
        return
      }
      state = 'idle'
      const speed = dx / Math.max(1, e.timeStamp - startT)
      if (dx > TRIGGER || speed > FLICK) {
        haptic('tick')
        setX(window.innerWidth, true)
        // dá tempo de a tela sair de cena antes de trocar
        window.setTimeout(() => navigate(-1), reduce ? 0 : 160)
      } else {
        setX(0, true)
      }
    }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd, { passive: true })
    document.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onEnd)
    }
  }, [navigate])

  return null
}
