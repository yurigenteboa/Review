import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { inviteUrl, useInviteCode, useResetInvite } from '../../lib/social'
import { QrIcon } from '../ui/Icons'

/** Seu link de convite: copiar, compartilhar (WhatsApp etc.), QR code e trocar o link. */
export function InviteCard() {
  const { data: code, isLoading } = useInviteCode()
  const reset = useResetInvite()
  const [qr, setQr] = useState<string | null>(null)
  const [showQr, setShowQr] = useState(false)
  const [copied, setCopied] = useState(false)
  const url = code ? inviteUrl(code) : ''

  useEffect(() => {
    if (!url || !showQr) return
    QRCode.toDataURL(url, { width: 480, margin: 1, color: { dark: '#1C1C1E', light: '#FFFFFF' } }).then(setQr)
  }, [url, showQr])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* navegador sem permissão: o link fica visível para copiar à mão */
    }
  }

  const share = async () => {
    const text = 'Bora dar nota em tudo comigo no MMISC? Entra por aqui:'
    if (navigator.share) {
      try {
        await navigator.share({ title: 'MMISC', text, url })
      } catch {
        /* cancelou o compartilhamento */
      }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener')
    }
  }

  return (
    <section className="review-card" aria-label="Convidar amigos" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <strong style={{ fontSize: 17 }}>Convide seus amigos</strong>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-3)' }}>
          Quem criar conta pelo seu link vira seu amigo na hora.
        </p>
      </div>

      <div className="search-field" style={{ fontSize: 14, color: 'var(--text-2)', overflow: 'hidden' }}>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{isLoading ? 'Gerando link…' : url}</span>
      </div>

      <div className="invite-actions">
        <button type="button" className="btn btn--primary tap" disabled={!code} onClick={share} style={{ padding: 0, fontSize: 15 }}>
          Compartilhar
        </button>
        <button type="button" className="btn btn--plain tap" disabled={!code} onClick={copy} style={{ padding: 0, fontSize: 15 }}>
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
        <button
          type="button"
          className="btn btn--plain tap"
          disabled={!code}
          aria-expanded={showQr}
          onClick={() => setShowQr((v) => !v)}
          style={{ padding: 0, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <QrIcon size={18} /> QR
        </button>
      </div>

      {showQr && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '8px 0' }}>
          {qr ? (
            <img src={qr} alt="QR code do seu convite" width={220} height={220} style={{ borderRadius: 16, background: '#fff', padding: 8 }} />
          ) : (
            <span className="skeleton" style={{ width: 220, height: 220, borderRadius: 16 }} />
          )}
          <span className="field-hint" style={{ margin: 0 }}>Peça para o amigo apontar a câmera do celular.</span>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          if (window.confirm('Trocar o link? O link antigo para de funcionar.')) reset.mutate()
        }}
        disabled={reset.isPending}
        style={{ alignSelf: 'flex-start', border: 'none', background: 'none', color: 'var(--text-3)', fontSize: 13, padding: 0, minHeight: 32 }}
      >
        Trocar link de convite
      </button>
    </section>
  )
}
