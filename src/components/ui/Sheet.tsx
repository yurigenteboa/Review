import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useBreakpoint } from '../../lib/breakpoints'
import { Glass } from './Glass'

import { t } from '../../lib/i18n'
interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children?: ReactNode
  /**
   * Como aparece no tablet/desktop (no celular é sempre a sheet de baixo):
   * - `dialog` (padrão): janela no centro — registrar, editar, escolher;
   * - `side`: painel à direita, da altura da tela — comentários, listas para ler.
   */
  desktop?: 'dialog' | 'side'
}

const spring = { type: 'spring' as const, stiffness: 400, damping: 36 }
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * No celular: sheet que sobe de baixo, com vidro e "pegador"
 * (arraste para baixo, toque fora ou Esc para fechar).
 * No tablet/desktop: janela no centro ou painel à direita (prop `desktop`).
 * Em todos: o Tab fica preso dentro dela e, ao fechar, o foco volta para quem abriu.
 */
export function Sheet({ open, onClose, title, children, desktop = 'dialog' }: SheetProps) {
  const drag = useDragControls()
  const bp = useBreakpoint()
  const panelRef = useRef<HTMLElement>(null)
  const mode = bp === 'mobile' ? 'bottom' : desktop
  // onClose costuma ser uma função nova a cada render; guardada em ref para o efeito abaixo
  // rodar só ao abrir/fechar. Antes ele re-rodava a cada tecla: devolvia o foco a quem abriu e
  // focava o painel de novo, tirando o cursor do campo enquanto a pessoa digitava.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const onKey = (e: KeyboardEvent) => {
      const panel = panelRef.current
      // Com duas sheets abertas, só a de cima (a última no <body>) responde
      if (!panel || !isTopmost(panel)) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (items.length === 0) {
        e.preventDefault()
        panel.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const inside = panel.contains(document.activeElement)
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Foco no painel (não no primeiro campo: no celular isso abriria o teclado sozinho)
    // Só se o foco ainda não estiver lá dentro (ex.: campo com autoFocus)
    const t = requestAnimationFrame(() => {
      const panel = panelRef.current
      if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true })
    })

    return () => {
      cancelAnimationFrame(t)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [open])

  const motionProps =
    mode === 'bottom'
      ? { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' }, transition: spring }
      : mode === 'side'
        ? { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' }, transition: spring }
        : {
            initial: { opacity: 0, scale: 0.96, y: 12 },
            animate: { opacity: 1, scale: 1, y: 0 },
            exit: { opacity: 0, scale: 0.97, y: 8 },
            transition: { type: 'spring' as const, stiffness: 500, damping: 38 },
          }

  // M2 · Teclado no celular: o teclado encolhe só a área visível (visualViewport) e a sheet,
  // presa ao fundo da tela, ficava atrás dele. Aqui ela sobe junto (--kb = altura do teclado)
  // e o campo que recebeu o foco é rolado para dentro da área visível.
  useEffect(() => {
    if (!open || mode !== 'bottom') return
    const vv = window.visualViewport
    const root = document.documentElement
    const apply = () => {
      const kb = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0
      root.style.setProperty('--kb', `${kb}px`)
    }
    let t: number | undefined
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null
      if (!el || !panelRef.current?.contains(el) || !el.matches('input, textarea, select')) return
      window.clearTimeout(t)
      t = window.setTimeout(() => el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 320)
    }
    apply()
    vv?.addEventListener('resize', apply)
    vv?.addEventListener('scroll', apply)
    document.addEventListener('focusin', onFocus)
    return () => {
      window.clearTimeout(t)
      vv?.removeEventListener('resize', apply)
      vv?.removeEventListener('scroll', apply)
      document.removeEventListener('focusin', onFocus)
      root.style.removeProperty('--kb')
    }
  }, [open, mode])

  // Portal: a sheet é desenhada direto no <body>, fora de qualquer card ou tela animada
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            key="backdrop"
            type="button"
            className="sheet-backdrop"
            aria-label={t('Fechar')}
            tabIndex={-1}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            key={`sheet-${mode}`}
            className={`sheet-frame sheet-frame--${mode}`}
            {...motionProps}
            {...(mode === 'bottom'
              ? {
                  drag: 'y' as const,
                  dragListener: false,
                  dragControls: drag,
                  dragConstraints: { top: 0, bottom: 0 },
                  dragElastic: { top: 0, bottom: 0.6 },
                  onDragEnd: (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
                    if (info.offset.y > 120 || info.velocity.y > 600) onClose()
                  },
                }
              : {})}
          >
            <Glass
              variant="sheet"
              className={`sheet sheet--${mode}`}
              role="dialog"
              aria-modal="true"
              aria-label={title}
              ref={panelRef}
              tabIndex={-1}
            >
              {mode === 'bottom' ? (
                <div className="sheet__grab" onPointerDown={(e) => drag.start(e)} style={{ touchAction: 'none' }}>
                  <div className="sheet__handle" />
                  {title && <h2 className="sheet__title">{title}</h2>}
                </div>
              ) : (
                <div className="sheet__top">
                  {title && <h2 className="sheet__title">{title}</h2>}
                  <button type="button" className="icon-btn tap sheet__close" aria-label={t('Fechar')} onClick={onClose}>
                    <CloseIcon />
                  </button>
                </div>
              )}
              {children}
            </Glass>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** A sheet de cima é a última aberta no <body>. */
function isTopmost(panel: HTMLElement) {
  const all = document.querySelectorAll('.sheet[role="dialog"]')
  return all[all.length - 1] === panel
}

const CloseIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)
