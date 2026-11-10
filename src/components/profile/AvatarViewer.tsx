import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { displayName } from '../../lib/format'
import { useRemoveProfileImage, useUploadProfileImage } from '../../lib/profileData'
import type { Profile } from '../../lib/types'
import { Avatar } from '../review/ReviewCard'

import { t } from '../../lib/i18n'
type AvatarProfile = Pick<Profile, 'id' | 'display_name' | 'username' | 'avatar_url'>

/** Foto do Google vem pequena (=s96-c); pede uma versão maior para ver ampliada. */
function largeUrl(url: string) {
  return url.replace(/=s\d+(-c)?$/, '=s800$1')
}

/**
 * Foto de perfil clicável: abre ampliada por cima da tela.
 * Para o dono, a vista ampliada tem "Trocar foto" (e "Remover"), que usam o mesmo
 * envio do Editar perfil (reduz para WebP 512 px e grava em profile-media).
 * Sem foto: o dono abre a vista para adicionar; para os outros não é clicável.
 */
export function AvatarViewer({ profile: p, size, isMe }: { profile: AvatarProfile; size: number; isMe: boolean }) {
  const [open, setOpen] = useState(false)
  const clickable = Boolean(p.avatar_url) || isMe
  const name = displayName(p)

  if (!clickable) return <Avatar profile={p} size={size} />

  return (
    <>
      <button
        type="button"
        className="avatar-btn tap"
        aria-label={p.avatar_url ? t('Ver foto de {name}', { name }) : t('Adicionar foto de perfil')}
        onClick={() => setOpen(true)}
      >
        <Avatar profile={p} size={size} />
      </button>
      <AvatarLightbox open={open} onClose={() => setOpen(false)} profile={p} isMe={isMe} />
    </>
  )
}

function AvatarLightbox({ open, onClose, profile: p, isMe }: { open: boolean; onClose: () => void; profile: AvatarProfile; isMe: boolean }) {
  const upload = useUploadProfileImage()
  const remove = useRemoveProfileImage()
  const input = useRef<HTMLInputElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const busy = upload.isPending || remove.isPending
  const error = (upload.error ?? remove.error) as Error | null
  const name = displayName(p)

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = requestAnimationFrame(() => closeBtn.current?.focus({ preventScroll: true }))
    return () => {
      cancelAnimationFrame(t)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [open, onClose])

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) upload.mutate({ userId: p.id, kind: 'avatar', file })
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="avatar-lightbox"
          className="avatar-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={t('Foto de {name}', { name })}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <button ref={closeBtn} type="button" className="icon-btn tap avatar-lightbox__close" aria-label={t('Fechar')} onClick={onClose}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>

          <motion.figure
            className="avatar-lightbox__figure"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            {p.avatar_url ? (
              <img
                className="avatar-lightbox__img"
                src={largeUrl(p.avatar_url)}
                alt={t('Foto de {name}', { name })}
                referrerPolicy="no-referrer"
                style={{ opacity: busy ? 0.5 : 1 }}
              />
            ) : (
              <span className="avatar-lightbox__img avatar-lightbox__empty">
                <Avatar profile={p} size={300} />
              </span>
            )}
            <figcaption>
              <strong>{name}</strong>
              {p.username && <span>@{p.username}</span>}
            </figcaption>
          </motion.figure>

          {isMe && (
            <div className="avatar-lightbox__actions">
              <button type="button" className="btn btn--primary tap" disabled={busy} onClick={() => input.current?.click()}>
                {upload.isPending ? t('Enviando…') : p.avatar_url ? t('Trocar foto') : t('Adicionar foto')}
              </button>
              {p.avatar_url && (
                <button type="button" className="btn btn--plain tap" disabled={busy} onClick={() => remove.mutate({ userId: p.id, kind: 'avatar' })}>
                  {remove.isPending ? t('Removendo…') : t('Remover')}
                </button>
              )}
              <input ref={input} type="file" accept="image/*" hidden onChange={pick} />
            </div>
          )}
          {error && (
            <p role="alert" className="avatar-lightbox__error">
              {t('Não deu para salvar a foto: {message}', { message: error.message })}
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
