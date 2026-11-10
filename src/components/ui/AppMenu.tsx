import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { signOut, useAuth } from '../../lib/auth'
import { useProfileFull } from '../../lib/profile'
import { useFriends } from '../../lib/social'
import { Avatar } from '../review/ReviewCard'
import { GlobeIcon, LanguageIcon, MapIcon, PaletteIcon, PersonIcon, SparkleIcon } from './Icons'

import { LANGS, currentLang, t } from '../../lib/i18n'
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
const spring = { type: 'spring' as const, stiffness: 420, damping: 40 }

/**
 * Menu lateral (como o do app do Twitter no celular): entra pela esquerda, com você no topo,
 * os atalhos no meio e "Sair da conta" pequeno no rodapé. Fecha tocando fora, arrastando
 * para a esquerda, com Esc ou ao escolher um item. Abre por openMenu() (lib/menuBus.ts).
 */
export function AppMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  // Esc fecha, Tab fica preso no menu, o foco volta para quem abriu
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const onKey = (e: KeyboardEvent) => {
      const panel = panelRef.current
      if (!panel) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }))
    return () => {
      cancelAnimationFrame(t)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [open])

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            key="fundo"
            type="button"
            className="app-menu-backdrop"
            aria-label={t('Fechar menu')}
            tabIndex={-1}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            key="menu"
            ref={panelRef}
            className="app-menu"
            role="dialog"
            aria-modal="true"
            aria-label={t('Menu')}
            tabIndex={-1}
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={spring}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.6, right: 0 }}
            dragDirectionLock
            onDragEnd={(_e, info) => {
              if (info.offset.x < -80 || info.velocity.x < -500) onClose()
            }}
          >
            <MenuContent onClose={onClose} />
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function MenuContent({ onClose }: { onClose: () => void }) {
  const { userId } = useAuth()
  const { data: me } = useProfileFull(userId)
  const { data: friends } = useFriends()
  const [confirmOut, setConfirmOut] = useState(false)
  const friendCount = (friends ?? []).filter((f) => f.status === 'aceita').length
  const publicPath = me?.is_public && me.username ? `/@${me.username}` : null

  const items: { to: string; label: string; icon: ReactNode; hint?: string }[] = [
    { to: '/perfil', label: t('Perfil'), icon: <PersonIcon /> },
    { to: '/mapa', label: t('Mapa'), icon: <MapIcon /> },
    { to: '/retrospectiva', label: t('Retrospectiva'), icon: <SparkleIcon /> },
    ...(publicPath ? [{ to: publicPath, label: t('Perfil público'), icon: <GlobeIcon />, hint: `mmisc.com.br${publicPath}` }] : []),
    { to: '/aparencia', label: t('Aparência'), icon: <PaletteIcon /> },
    { to: '/aparencia#idioma', label: t('Idioma'), icon: <LanguageIcon />, hint: LANGS.find((l) => l.id === currentLang())?.native },
  ]

  return (
    <div className="app-menu__inner">
      <Link to="/perfil" className="app-menu__me tap" onClick={onClose}>
        {me && <Avatar profile={me} size={52} />}
        <span className="app-menu__name">{me?.display_name || me?.username || t('Você')}</span>
        {me?.username && <span className="app-menu__handle">@{me.username}</span>}
      </Link>
      <Link to="/amigos" className="app-menu__friends tap" onClick={onClose}>
        <strong>{friendCount}</strong> {friendCount === 1 ? 'amigo' : 'amigos'}
      </Link>

      <nav aria-label={t('Atalhos')} className="app-menu__nav">
        {items.map((it) => (
          <Link key={it.to} to={it.to} className="app-menu__item tap" onClick={onClose}>
            <span className="app-menu__icon">{it.icon}</span>
            <span className="app-menu__label">
              {it.label}
              {it.hint && <small>{it.hint}</small>}
            </span>
          </Link>
        ))}
      </nav>

      <div className="app-menu__foot">
        <span className="app-menu__legal">
          <Link to="/sobre" onClick={onClose}>
            {t('Sobre')}
          </Link>
          <Link to="/privacidade" onClick={onClose}>
            {t('Privacidade')}
          </Link>
          <Link to="/termos" onClick={onClose}>
            {t('Termos')}
          </Link>
        </span>
        <button
          type="button"
          className="app-menu__out tap"
          aria-live="polite"
          onClick={() => {
            if (!confirmOut) return setConfirmOut(true)
            onClose()
            void signOut()
          }}
        >
          {confirmOut ? t('Toque de novo para sair') : t('Sair da conta')}
        </button>
      </div>
    </div>
  )
}
