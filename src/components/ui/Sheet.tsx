import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
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
 * Arraste para baixo ou toque fora para fechar.
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  return (
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
            className="sheet-wrap"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={spring}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose()
            }}
            style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 41 }}
          >
            <Glass variant="sheet" className="sheet" role="dialog" aria-modal="true" aria-label={title}>
              <div className="sheet__handle" />
              {title && <h2 className="sheet__title">{title}</h2>}
              {children}
            </Glass>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
