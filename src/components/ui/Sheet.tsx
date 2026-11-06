import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Glass } from './Glass'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children?: ReactNode
}

const spring = { type: 'spring' as const, stiffness: 400, damping: 36 }

/**
 * Sheet que sobe de baixo, com vidro e "pegador".
 * Arraste o pegador para baixo, toque fora ou aperte Esc para fechar.
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const drag = useDragControls()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  // Portal: a sheet é desenhada direto no <body>, fora de qualquer card ou tela animada
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            key="backdrop"
            type="button"
            className="sheet-backdrop"
            aria-label="Fechar"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={spring}
            drag="y"
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose()
            }}
            style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 41 }}
          >
            <Glass variant="sheet" className="sheet" role="dialog" aria-modal="true" aria-label={title}>
              <div
                className="sheet__grab"
                onPointerDown={(e) => drag.start(e)}
                style={{ touchAction: 'none' }}
              >
                <div className="sheet__handle" />
                {title && <h2 className="sheet__title">{title}</h2>}
              </div>
              {children}
            </Glass>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
