import { useState } from 'react'
import { Glass } from '../components/ui/Glass'
import { sendLoginEmail, verifyLoginCode } from '../lib/auth'

/**
 * Login sem senha:
 * 1. a pessoa digita o e-mail;
 * 2. recebe um e-mail com link E código;
 * 3. no computador, clica no link; no app instalado no iPhone, digita o código
 *    (o app instalado não compartilha o login com o Safari).
 */
export default function Login() {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await sendLoginEmail(email.trim())
    setBusy(false)
    if (error) {
      setError(
        error.status === 429
          ? 'Muitos e-mails enviados em pouco tempo. Espere alguns minutos e tente de novo.'
          : error.message,
      )
      return
    }
    setStep('code')
  }

  const verify = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await verifyLoginCode(email.trim(), code.trim())
    setBusy(false)
    if (error) setError('Código inválido ou expirado. Confira o e-mail mais recente.')
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'calc(var(--safe-top) + 24px) 20px calc(var(--safe-bottom) + 24px)',
        background: 'linear-gradient(160deg, #4B2380 0%, #0A84FF 45%, #FF9500 100%)',
      }}
    >
      <Glass style={{ width: '100%', maxWidth: 400, padding: 28 }}>
        <img src="/icons/icon-192.png" alt="" width={64} height={64} style={{ borderRadius: 16, display: 'block' }} />
        <h1 style={{ margin: '16px 0 4px', fontSize: 34, fontWeight: 800, letterSpacing: -0.8 }}>Review</h1>
        <p style={{ margin: 0, fontSize: 15, color: 'var(--text-2)' }}>
          Review de tudo: álbuns, filmes, bares, banheiros, cidades.
        </p>

        {step === 'email' ? (
          <form onSubmit={send} style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label>
              <span className="field-label">Seu e-mail</span>
              <input
                className="field"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
              />
            </label>
            <button className="btn btn--primary tap" disabled={busy}>
              {busy ? 'Enviando…' : 'Receber código'}
            </button>
            <span className="field-hint">Sem senha: mandamos um código de acesso para o seu e-mail.</span>
          </form>
        ) : (
          <form onSubmit={verify} style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0, fontSize: 15 }}>
              Enviamos um e-mail para <strong>{email}</strong>. Digite o código ou toque no link do e-mail.
            </p>
            <label>
              <span className="field-label">Código</span>
              <input
                className="field"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,8}"
                maxLength={8}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                style={{ fontSize: 24, letterSpacing: 6, textAlign: 'center' }}
              />
            </label>
            <button className="btn btn--primary tap" disabled={busy}>
              {busy ? 'Entrando…' : 'Entrar'}
            </button>
            <button
              type="button"
              className="btn btn--plain tap"
              onClick={() => {
                setStep('email')
                setCode('')
                setError(null)
              }}
            >
              Usar outro e-mail
            </button>
          </form>
        )}

        {error && (
          <p role="alert" style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--cat-filme-ink)' }}>
            {error}
          </p>
        )}
      </Glass>
    </div>
  )
}
