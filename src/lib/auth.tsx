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
