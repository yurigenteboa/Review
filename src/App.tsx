import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import type { ComposeStart } from './components/review/ComposeSheet'
import { TabBar } from './components/ui/TabBar'
import { SideBar } from './components/ui/SideBar'
import { useBreakpoint, useFinePointer } from './lib/breakpoints'
import { TAB_ROOTS, useScrollMemory } from './lib/navigation'
import { EdgeSwipeBack } from './components/ui/EdgeSwipeBack'
import { COMPOSE_EVENT } from './lib/composeBus'
import { PullToRefresh } from './components/ui/PullToRefresh'
import { Glass } from './components/ui/Glass'
import { AuthProvider, FROM_APP_PARAM, isStandalone, useAuth } from './lib/auth'
import { LEGAL_PATHS, type LegalDoc } from './pages/legalPaths'
import { parseHandle } from './lib/publicProfile'
import Inicio from './pages/Inicio'
import Login from './pages/Login'
import { acceptInvite, savePendingInvite, takePendingInvite } from './lib/social'
import { useQueryClient } from '@tanstack/react-query'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { reportError, track, trackAppOpen } from './lib/telemetry'

// M0 (velocidade no celular): só Início e Login vêm no primeiro download.
// As outras telas viram arquivos separados e são baixadas em segundo plano logo
// depois que o app abre (prefetchScreens), então a navegação continua instantânea.
const SCREENS = {
  Buscar: () => import('./pages/Buscar'),
  Amigos: () => import('./pages/Amigos'),
  Item: () => import('./pages/Item'),
  Perfil: () => import('./pages/Perfil'),
  Pessoa: () => import('./pages/Pessoa'),
  Notificacoes: () => import('./pages/Notificacoes'),
  Legal: () => import('./pages/Legal'),
  PublicProfile: () => import('./pages/PublicProfile'),
  // a janela de Registrar também vem depois (é grande) e fica pronta antes do primeiro toque no +
  Compose: () => import('./components/review/ComposeSheet'),
}
const Buscar = lazy(SCREENS.Buscar)
const Amigos = lazy(SCREENS.Amigos)
const Item = lazy(SCREENS.Item)
const Perfil = lazy(SCREENS.Perfil)
const Pessoa = lazy(SCREENS.Pessoa)
const Notificacoes = lazy(SCREENS.Notificacoes)
// Mapa: a biblioteca de mapa é pesada, então só baixa quando a tela abre (fora do prefetch)
const Mapa = lazy(() => import('./pages/Mapa'))
const Legal = lazy(SCREENS.Legal)
const PublicProfile = lazy(SCREENS.PublicProfile)
// Telas raras: só quando abertas (o leitor de .zip pesa)
const ImportLetterboxd = lazy(() => import('./pages/ImportLetterboxd'))
const Retrospectiva = lazy(() => import('./pages/Retrospectiva'))
const Ranking = lazy(() => import('./pages/Ranking'))
const Kit = lazy(() => import('./pages/Kit'))
const ComposeSheet = lazy(() => SCREENS.Compose().then((m) => ({ default: m.ComposeSheet })))
// Só para mouse/trackpad: no celular nem é baixado
const DesktopEnhancers = lazy(() => import('./components/ui/DesktopEnhancers').then((m) => ({ default: m.DesktopEnhancers })))

/** Baixa as telas comuns quando o aparelho estiver ocioso (sem atrapalhar a abertura). */
function prefetchScreens() {
  const run = () => Object.values(SCREENS).forEach((load) => void load().catch(() => {}))
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 })
  else setTimeout(run, 1500)
}

const loadingPage = <div className="page" aria-busy="true" />

/**
 * M1: transição entre telas. Abrir uma tela nova (item, pessoa…) entra pela direita;
 * voltar entra pela esquerda; trocar de aba só esmaece. `custom` = direção (1, -1 ou 0),
 * passado também ao AnimatePresence para a tela que sai saber para onde ir.
 */
const pageVariants: Variants = {
  enter: (d: number) => ({ opacity: 0, x: d * 28, y: d === 0 ? 8 : 0 }),
  center: { opacity: 1, x: 0, y: 0 },
  exit: (d: number) => ({ opacity: 0, x: d * -14 }),
}
const stillVariants: Variants = { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } }

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } },
  // Fase 0: consulta ou gravação que falhou também vira aviso (erros de rede são filtrados em telemetry.ts)
  queryCache: new QueryCache({ onError: (e, q) => reportError('query', withKey(e, q.queryKey)) }),
  mutationCache: new MutationCache({ onError: (e, _v, _c, m) => reportError('mutation', withKey(e, m.options.mutationKey ?? ['sem-chave'])) }),
})

/** Junta a chave da consulta ao erro (só o primeiro pedaço: nome da consulta, sem ids). */
function withKey(e: Error, key: readonly unknown[]) {
  const named = new Error(`[${String(key[0])}] ${e.message}`)
  named.stack = e.stack
  return named
}

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
  // M1: rolagem lembrada ao voltar e por aba; telas novas abrem no topo
  const restoreScroll = useScrollMemory()
  const navType = useNavigationType()
  const reduceMotion = useReducedMotion()
  const pageDir = TAB_ROOTS.includes(location.pathname) && navType !== 'POP' ? 0 : navType === 'POP' ? -1 : 1
  const [compose, setCompose] = useState<{ open: boolean; start: ComposeStart; key: number }>({ open: false, start: {}, key: 0 })
  const [toast, setToast] = useState<string | null>(null)
  const [handoff, setHandoff] = useState(returnParams.handedOffToBrowser)

  const openCompose = useCallback((start: ComposeStart = {}) => {
    track('compose_open', { editou: Boolean(start.edit) })
    setCompose((c) => ({ open: true, start, key: c.key + 1 }))
  }, [])
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

  // Com a pessoa logada, baixa as outras telas em segundo plano (e conta "abriu o app" 1x por dia)
  useEffect(() => {
    if (!session) return
    prefetchScreens()
    trackAppOpen()
  }, [session])

  // Registrar pedido de qualquer canto (menu do card, diário…): ver lib/composeBus.ts
  useEffect(() => {
    const onReq = (e: Event) => openCompose((e as CustomEvent<ComposeStart>).detail ?? {})
    window.addEventListener(COMPOSE_EVENT, onReq)
    return () => window.removeEventListener(COMPOSE_EVENT, onReq)
  }, [openCompose])

  // Atalho "Nova review" do ícone do app (Android): /?novo=1 abre o registro
  useEffect(() => {
    if (!session) return
    const p = new URLSearchParams(location.search)
    if (p.get('novo') !== '1') return
    p.delete('novo')
    navigate({ pathname: location.pathname, search: p.toString() ? `?${p}` : '' }, { replace: true })
    openCompose()
  }, [session, location.search]) // eslint-disable-line react-hooks/exhaustive-deps

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
  if (publicDoc) return <Suspense fallback={loadingPage}><Legal doc={publicDoc} /></Suspense>
  // Perfil público (mmisc.com.br/@usuario): abre com ou sem login.
  if (parseHandle(location.pathname)) return <Suspense fallback={loadingPage}><PublicProfile /></Suspense>

  if (loading) return <div style={{ minHeight: '100dvh' }} aria-busy="true" />
  if (!session) return <Login />

  return (
    <div className={`shell shell--${bp}`}>
      {/* Teclado: pula a navegação e vai direto ao conteúdo (aparece só ao receber foco) */}
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      {/* Celular: abas embaixo. Tablet/desktop: barra lateral (D1 do plano desktop). */}
      {bp === 'mobile' ? (
        <TabBar onCompose={() => openCompose()} />
      ) : (
        <SideBar onCompose={() => openCompose()} compact={bp === 'tablet'} />
      )}

      <AnimatePresence mode="wait" onExitComplete={restoreScroll} custom={pageDir}>
        <motion.main
          key={location.pathname}
          custom={pageDir}
          variants={reduceMotion ? stillVariants : pageVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
          className="shell__main"
          id="conteudo"
          tabIndex={-1}
        >
          <ErrorBoundary key={location.pathname}>
          <Suspense fallback={loadingPage}>
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
            <Route path="/importar" element={<ImportLetterboxd />} />
            <Route path="/retrospectiva" element={<Retrospectiva />} />
            <Route path="/ranking" element={<Ranking />} />
            <Route path="*" element={<Inicio onCompose={() => openCompose()} />} />
          </Routes>
          </Suspense>
          </ErrorBoundary>
        </motion.main>
      </AnimatePresence>

      {/* Mouse/trackpad: setas nas fileiras, dicas nos ícones, colar/arrastar fotos (D4) */}
      {finePointer && (
        <Suspense fallback={null}>
          <DesktopEnhancers />
        </Suspense>
      )}

      {/* Toque: puxar para baixo no topo da tela atualiza os dados (M1) */}
      {!finePointer && <PullToRefresh />}
      {/* App instalado no iPhone: arrastar da borda esquerda volta (M1) */}
      {!finePointer && <EdgeSwipeBack />}

      {compose.key > 0 && (
        <Suspense fallback={null}>
          <ComposeSheet key={compose.key} open={compose.open} start={compose.start} onClose={closeCompose} onDone={setToast} />
        </Suspense>
      )}

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
