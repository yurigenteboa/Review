import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

interface AuthState {
  session: Session | null
  /** true enquanto a sessão salva ainda está sendo lida */
  loading: boolean
  userId: string | null
}

const AuthContext = createContext<AuthState>({ session: null, loading: true, userId: null })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ session, loading, userId: session?.user.id ?? null }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

/** Envia o e-mail com link + código. O link funciona no computador; o código, no app instalado. */
export async function sendLoginEmail(email: string) {
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin, shouldCreateUser: true },
  })
}

export async function verifyLoginCode(email: string, token: string) {
  return supabase.auth.verifyOtp({ email, token, type: 'email' })
}

export async function signOut() {
  return supabase.auth.signOut()
}

// ---------- Login social (Google) ----------

/** true no app instalado na tela de início (iPhone: navigator.standalone; outros: display-mode). */
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches
}

/** true só no app instalado do iPhone/iPad, onde o redirect do Google pode sair para o Safari. */
export function isStandaloneIOS(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true
}

/**
 * Botão do Google: ligado para todo mundo desde 06/11.
 * Para esconder de novo (ex.: problema no Google), ponha VITE_LOGIN_GOOGLE=off na Vercel.
 */
export function googleLoginEnabled(): boolean {
  return import.meta.env.VITE_LOGIN_GOOGLE !== 'off'
}

/** Marca na URL de volta que o login começou no app instalado (para detectar a ida ao Safari). */
export const FROM_APP_PARAM = 'origem'

/**
 * Vai para o Google e volta para o MMisc já logado.
 * O convite pendente viaja na própria URL de volta: se o login terminar no Safari
 * (outro localStorage), o convite não se perde.
 */
export async function signInWithGoogle(pendingInvite: string | null) {
  const back = new URL('/', window.location.origin)
  if (pendingInvite) back.searchParams.set('convite', pendingInvite)
  if (isStandalone()) back.searchParams.set(FROM_APP_PARAM, 'app')
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: back.toString(),
      // deixa escolher a conta, em vez de entrar direto na última usada
      queryParams: { prompt: 'select_account' },
    },
  })
}

/** Erro que o Supabase/Google devolve na URL quando o login falha ou é cancelado. */
export function readOAuthError(): string | null {
  const read = (s: string) => {
    const p = new URLSearchParams(s)
    return p.get('error_description') ?? p.get('error')
  }
  return read(window.location.search) ?? read(window.location.hash.replace(/^#/, ''))
}
