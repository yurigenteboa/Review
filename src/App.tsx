import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ComposeSheet, type ComposeStart } from './components/review/ComposeSheet'
import { TabBar } from './components/ui/TabBar'
import { SideBar } from './components/ui/SideBar'
import { useBreakpoint, useFinePointer } from './lib/breakpoints'
import { DesktopEnhancers } from './components/ui/DesktopEnhancers'
import { Glass } from './components/ui/Glass'
import { AuthProvider, FROM_APP_PARAM, isStandalone, useAuth } from './lib/auth'
import Legal, { LEGAL_PATHS, type LegalDoc } from './pages/Legal'
import PublicProfile from './pages/PublicProfile'
import { parseHandle } from './lib/publicProfile'
import Buscar from './pages/Buscar'
import Inicio from './pages/Inicio'
import Item from './pages/Item'
import Kit from './pages/Kit'
import Login from './pages/Login'
import Amigos from './pages/Amigos'
import Mapa from './pages/Mapa'
import Notificacoes from './pages/Notificacoes'
import Perfil from './pages/Perfil'
import Pessoa from './pages/Pessoa'
import { acceptInvite, savePendingInvite, takePendingInvite } from './lib/social'
import { useQueryClient } from '@tanstack/react-query'

// Telas raras: carregam só quando abertas (o leitor de .zip pesa)
const ImportLetterboxd = lazy(() => import('./pages/ImportLetterboxd'))
const Retrospectiva = lazy(() => import('./pages/Retrospectiva'))

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } },
})

/**
 * Lido uma vez, quando a página abre na volta do Google:
 * - `convite`: código de convite que viajou na URL (sobrevive mesmo se o login terminar no Safari);
 * - `origem=app` fora do app instalado: o login começou no app, mas o iPhone terminou no Safari.
 */
const returnParams = (() => {
  const p = new URLSearchParams(window.location.search)
  const invite = p.get('convite')
  const result = {
    invite: invite && /^[a-z0-9]+$/i.test(invite) ? invite : null,
    handedOffToBrowser: p.get(FROM_APP_PARAM) === 'app' && !isStandalone(),
  }
  if (p.has('convite') || p.has(FROM_APP_PARAM)) {
    p.delete('convite')
    p.delete(FROM_APP_PARAM)
    const qs = p.toString()
    // mantém o #access_token para o Supabase ler; só limpa os nossos parâmetros
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash)
  }
  return result
})()
if (returnParams.invite) savePendingInvite(returnParams.invite)

const PUBLIC_PAGES = Object.entries(LEGAL_PATHS) as [LegalDoc, string][]

function Shell() {
  const location = useLocation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { session, loading } = useAuth()
  const bp = useBreakpoint()
  const finePointer = useFinePointer()
  const [compose, setCompose] = useState<{ open: boolean; start: ComposeStart; key: number }>({ open: false, start: {}, key: 0 })
  const [toast, setToast] = useState<string | null>(null)
  const [handoff, setHandoff] = useState(returnParams.handedOffToBrowser)

  const openCompose = useCallback(
    (start: ComposeStart = {}) => setCompose((c) => ({ open: true, start, key: c.key + 1 })),
    [],
  )
  const closeCompose = useCallback(() => setCompose((c) => ({ ...c, open: false })), [])

  // Atalhos de teclado (desktop): N = nova review, / = buscar. Ignorados enquanto se digita
  // num campo, com Ctrl/Cmd/Alt apertado ou com uma janela aberta.
  useEffect(() => {
    if (!session) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        openCompose()
      } else if (e.key === '/') {
        e.preventDefault()
        const field = document.getElementById('busca-campo')
        if (field) field.focus()
        else navigate('/buscar')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [session, openCompose, navigate])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(t)
  }, [toast])

  // Link de convite (/convite/<código>): guarda o código; se já estiver logado, aceita na hora.
  const inviteMatch = location.pathname.match(/^\/convite\/([a-z0-9]+)/i)
  if (inviteMatch) savePendingInvite(inviteMatch[1])

  useEffect(() => {
    if (!session) return
    const code = takePendingInvite()
    if (!code) return
    acceptInvite(code)
      .then((ownerId) => {
        qc.invalidateQueries()
        setToast('Convite aceito: agora vocês são amigos')
        navigate(`/u/${ownerId}`, { replace: true })
      })
      .catch((e: Error) => {
        setToast(e.message.includes('inválido') ? 'Esse link de convite não vale mais' : 'Não deu para aceitar o convite')
        navigate('/', { replace: true })
      })
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  // Páginas públicas abrem com ou sem login (o Google exige que sejam acessíveis).
  const publicDoc = PUBLIC_PAGES.find(([, path]) => location.pathname === path)?.[0]
  if (publicDoc) return <Legal doc={publicDoc} />
  // Perfil público (mmisc.com.br/@usuario): abre com ou sem login.
  if (parseHandle(location.pathname)) return <PublicProfile />

  if (loading) return <div style={{ minHeight: '100dvh' }} aria-busy="true" />
  if (!session) return <Login />

  return (
    <div className={`shell shell--${bp}`}>
      {/* Celular: abas embaixo. Tablet/desktop: barra lateral (D1 do plano desktop). */}
      {bp === 'mobile' ? (
        <TabBar onCompose={() => openCompose()} />
      ) : (
        <SideBar onCompose={() => openCompose()} compact={bp === 'tablet'} />
      )}

      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="shell__main"
        >
          <Routes location={location}>
            <Route path="/" element={<Inicio onCompose={() => openCompose()} />} />
            <Route path="/buscar" element={<Buscar onCompose={openCompose} />} />
            <Route path="/amigos" element={<Amigos />} />
            <Route path="/u/:id" element={<Pessoa />} />
            <Route path="/notificacoes" element={<Notificacoes onCompose={openCompose} />} />
            <Route path="/convite/:code" element={<div className="page" aria-busy="true" />} />
            <Route path="/mapa" element={<Mapa />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/item/:id" element={<Item onCompose={openCompose} />} />
            <Route path="/kit" element={<Kit />} />
            <Route path="/importar" element={<Suspense fallback={<div className="page" aria-busy="true" />}><ImportLetterboxd /></Suspense>} />
            <Route path="/retrospectiva" element={<Suspense fallback={<div className="page" aria-busy="true" />}><Retrospectiva /></Suspense>} />
            <Route path="*" element={<Inicio onCompose={() => openCompose()} />} />
          </Routes>
        </motion.main>
      </AnimatePresence>

      {/* Mouse/trackpad: setas nas fileiras, dicas nos ícones, colar/arrastar fotos (D4) */}
      {finePointer && <DesktopEnhancers />}

      <ComposeSheet key={compose.key} open={compose.open} start={compose.start} onClose={closeCompose} onDone={setToast} />

      {handoff && (
        <Glass className="notice" role="status">
          <strong>Você entrou pelo navegador</strong>
          <span>
            O iPhone abriu o Google fora do app instalado, então o login ficou aqui. Pode continuar por aqui ou, no app
            da tela de início, entrar com o código por e-mail usando o mesmo e-mail do Google: é a mesma conta.
          </span>
          <button type="button" className="btn btn--plain tap" onClick={() => setHandoff(false)}>
            Entendi
          </button>
        </Glass>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            className="toast"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
