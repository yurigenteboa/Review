import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ComposeSheet, type ComposeStart } from './components/review/ComposeSheet'
import { TabBar } from './components/ui/TabBar'
import { AuthProvider, useAuth } from './lib/auth'
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

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } },
})

function Shell() {
  const location = useLocation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { session, loading } = useAuth()
  const [compose, setCompose] = useState<{ open: boolean; start: ComposeStart; key: number }>({ open: false, start: {}, key: 0 })
  const [toast, setToast] = useState<string | null>(null)

  const openCompose = useCallback(
    (start: ComposeStart = {}) => setCompose((c) => ({ open: true, start, key: c.key + 1 })),
    [],
  )
  const closeCompose = useCallback(() => setCompose((c) => ({ ...c, open: false })), [])

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

  if (loading) return <div style={{ minHeight: '100dvh' }} aria-busy="true" />
  if (!session) return <Login />

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{ maxWidth: 640, margin: '0 auto' }}
        >
          <Routes location={location}>
            <Route path="/" element={<Inicio onCompose={() => openCompose()} />} />
            <Route path="/buscar" element={<Buscar onCompose={openCompose} />} />
            <Route path="/amigos" element={<Amigos />} />
            <Route path="/u/:id" element={<Pessoa />} />
            <Route path="/notificacoes" element={<Notificacoes />} />
            <Route path="/convite/:code" element={<div className="page" aria-busy="true" />} />
            <Route path="/mapa" element={<Mapa />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/item/:id" element={<Item onCompose={openCompose} />} />
            <Route path="/kit" element={<Kit />} />
            <Route path="*" element={<Inicio onCompose={() => openCompose()} />} />
          </Routes>
        </motion.main>
      </AnimatePresence>

      <TabBar onCompose={() => openCompose()} />

      <ComposeSheet key={compose.key} open={compose.open} start={compose.start} onClose={closeCompose} onDone={setToast} />

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
    </>
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
