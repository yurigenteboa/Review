import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportError } from '../../lib/telemetry'

interface Props {
  children: ReactNode
  /** "tela": só a tela quebra (abas continuam); "app": o app inteiro mostra o aviso */
  scope?: 'tela' | 'app'
}
interface State {
  error: Error | null
}

/**
 * Fase 0: quando um componente quebra, em vez de tela branca a pessoa vê um aviso
 * com saída, e o erro vai para client_errors com o caminho dos componentes.
 * No App ele fica por tela (com key = endereço), então trocar de aba já limpa o erro.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const withTree = new Error(error.message)
    withTree.name = error.name
    withTree.stack = `${error.stack ?? ''}\n--- componentes ---${info.componentStack ?? ''}`.slice(0, 4000)
    reportError('react', withTree)
  }

  render() {
    if (!this.state.error) return this.props.children
    const app = this.props.scope === 'app'
    return (
      <div className="page" role="alert">
        <div className="crash">
          <strong className="crash__title">Algo deu errado {app ? 'no app' : 'nesta tela'}</strong>
          <span className="crash__text">
            O erro já foi avisado. {app ? 'Recarregar costuma resolver.' : 'Você pode tentar de novo ou voltar ao início.'}
          </span>
          <div className="crash__actions">
            <button type="button" className="btn btn--primary tap" onClick={() => location.reload()}>
              Recarregar
            </button>
            {!app && (
              <button type="button" className="btn btn--plain tap" onClick={() => location.assign('/')}>
                Ir para o início
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }
}
