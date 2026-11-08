import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Glass } from '../components/ui/Glass'
import { useResolvedAppearance } from '../lib/appearance'
import {
  googleLoginEnabled,
  isStandaloneIOS,
  readOAuthError,
  sendLoginEmail,
  signInWithGoogle,
  verifyLoginCode,
} from '../lib/auth'
import { displayName } from '../lib/format'
import { inviteOwner, peekPendingInvite } from '../lib/social'

/** Traduz os erros mais comuns que voltam do Google/Supabase na URL. */
function oauthMessage(raw: string): string {
  if (/access_denied|cancel/i.test(raw)) return 'Login com o Google cancelado.'
  return `Não deu para entrar com o Google (${raw}). Tente de novo ou use o código por e-mail.`
}

/**
 * Login sem senha:
 * - Google (quando ligado): vai para o Google e volta logado;
 * - e-mail: a pessoa recebe link E código. No computador, clica no link; no app
 *   instalado no iPhone, digita o código (o app instalado não compartilha o login com o Safari).
 * Com o mesmo e-mail, Google e código caem na MESMA conta (o Supabase junta as duas).
 */
export default function Login() {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(() => {
    const raw = readOAuthError()
    return raw ? oauthMessage(raw) : null
  })
  const [inviter, setInviter] = useState<string | null>(null)
  const showGoogle = googleLoginEnabled()
  // No app instalado do iPhone o Google pode terminar no Safari: o código por e-mail vem primeiro.
  const appIOS = isStandaloneIOS()

  const google = async () => {
    setBusy(true)
    setError(null)
    const { error } = await signInWithGoogle(peekPendingInvite())
    // Em caso de sucesso a página já saiu para o Google; só chega aqui se falhar.
    if (error) {
      setBusy(false)
      setError(oauthMessage(error.message))
    }
  }

  const darkTheme = useResolvedAppearance().tema !== 'claro'
  const googleButton = showGoogle && step === 'email' && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button type="button" className="btn btn--google tap" onClick={google} disabled={busy}>
        {/* "G" oficial recortado do kit de marca do Google; fundo igual ao do botão em cada tema */}
        <img src={darkTheme ? '/brand/google-g-dark.png' : '/brand/google-g-light.png'} alt="" width={20} height={20} />
        Continuar com o Google
      </button>
      {appIOS && (
        <span className="field-hint">
          No app instalado, o Google pode abrir no Safari. Se isso acontecer, volte aqui e use o código por e-mail com o mesmo
          e-mail do Google: é a mesma conta.
        </span>
      )}
    </div>
  )

  // Veio por link de convite? Mostra quem convidou.
  useEffect(() => {
    const code = peekPendingInvite()
    if (code) inviteOwner(code).then((o) => o && setInviter(displayName(o)))
  }, [])

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
        background: 'var(--login-gradient)',
      }}
    >
      <Glass style={{ width: '100%', maxWidth: 400, padding: 28, background: 'var(--surface)' }}>
        <h1 style={{ margin: '0 0 12px' }}>
          <img
            src="/icons/icon-192.png"
            srcSet="/icons/icon-192.png 1x, /icons/icon-512.png 2x"
            alt="MMisc"
            width={112}
            height={112}
            style={{ borderRadius: 26, display: 'block' }}
          />
        </h1>
        <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--text-2)' }}>
          Nota para tudo: álbuns, filmes, bares, banheiros, cidades.
        </p>
        {inviter && (
          <p style={{ margin: '16px 0 0', padding: '10px 14px', borderRadius: 14, background: 'color-mix(in srgb, var(--accent) 14%, transparent)', fontSize: '0.9375rem' }}>
            <strong>{inviter}</strong> te convidou. Entre e vocês já viram amigos.
          </p>
        )}

        {!appIOS && googleButton && (
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {googleButton}
            <span className="login-divider">ou com seu e-mail</span>
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={send} style={{ marginTop: !appIOS && googleButton ? 12 : 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
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
            {appIOS && googleButton && (
              <>
                <span className="login-divider">ou</span>
                {googleButton}
              </>
            )}
          </form>
        ) : (
          <form onSubmit={verify} style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0, fontSize: '0.9375rem' }}>
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
                style={{ fontSize: '1.5rem', letterSpacing: 6, textAlign: 'center' }}
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
          <p role="alert" style={{ margin: '12px 0 0', fontSize: '0.875rem', color: 'var(--cat-filme-ink)' }}>
            {error}
          </p>
        )}

        <nav className="login-links" aria-label="Sobre o MMisc">
          <Link to="/sobre">Sobre</Link>
          <Link to="/privacidade">Privacidade</Link>
          <Link to="/termos">Termos</Link>
          <Link to="/aparencia">Aparência</Link>
        </nav>
      </Glass>
    </div>
  )
}
