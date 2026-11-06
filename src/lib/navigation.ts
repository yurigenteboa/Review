import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { useLocation, useNavigationType, type Location } from 'react-router-dom'

/**
 * M1 · Navegação com cara de app.
 *
 * Memória de rolagem:
 * - Voltar (botão voltar do celular/navegador ou "<" do app) devolve a tela
 *   exatamente onde ela estava (guardado por `location.key`, uma entrada do histórico).
 * - As abas principais lembram a própria posição: sair do Início para Buscar e voltar
 *   pela aba mantém o feed onde estava.
 * - Qualquer outra tela nova abre no topo (antes ela abria na altura da tela anterior).
 */
export const TAB_ROOTS = ['/', '/buscar', '/amigos', '/perfil', '/notificacoes']

const byKey = new Map<string, number>()
const byTab = new Map<string, number>()

/** Rola até `y` assim que a página nova tiver altura para isso (dados do cache chegam em seguida). */
function scrollWhenReady(y: number) {
  if (y <= 0) {
    window.scrollTo(0, 0)
    return
  }
  const start = performance.now()
  const tick = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    if (max >= y - 2 || performance.now() - start > 1200) {
      window.scrollTo(0, Math.min(y, Math.max(0, max)))
      return
    }
    requestAnimationFrame(tick)
  }
  tick()
}

/**
 * Devolve a função que aplica a rolagem certa. O App chama no `onExitComplete`
 * do AnimatePresence, ou seja, quando a tela nova já está montada.
 */
export function useScrollMemory() {
  const location = useLocation()
  const navType = useNavigationType()
  const current = useRef<Location>(location)
  const target = useRef(0)

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    const onScroll = () => {
      const loc = current.current
      byKey.set(loc.key, window.scrollY)
      if (TAB_ROOTS.includes(loc.pathname)) byTab.set(loc.pathname, window.scrollY)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Decide o destino quando a tela muda (só a troca de caminho; ?aba= e ?cat= não mexem na rolagem)
  if (location.pathname !== current.current.pathname) {
    target.current =
      navType === 'POP'
        ? (byKey.get(location.key) ?? 0)
        : TAB_ROOTS.includes(location.pathname)
          ? (byTab.get(location.pathname) ?? 0)
          : 0
  }
  current.current = location

  return useCallback(() => scrollWhenReady(target.current), [])
}

/**
 * Toque numa aba que já está aberta (como no iOS):
 * - se a tela está rolada, sobe suave até o topo;
 * - se já está no topo, recarrega os dados da tela.
 * Devolve true quando tratou o toque (aí o link não navega).
 */
export function useTabReselect() {
  const qc = useQueryClient()
  const location = useLocation()
  return useCallback(
    (to: string) => {
      if (location.pathname !== to) return false
      if (window.scrollY > 4) {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
      } else {
        void qc.refetchQueries({ type: 'active' })
      }
      return true
    },
    [location.pathname, qc],
  )
}
