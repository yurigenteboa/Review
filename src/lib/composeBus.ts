import type { ComposeStart } from '../components/review/ComposeSheet'

/**
 * Abre a janela de Registrar de qualquer lugar (menu do card, linha do diário…),
 * sem precisar passar `onCompose` por todas as telas. O App escuta este evento.
 */
export const COMPOSE_EVENT = 'mmisc:compose'

export function requestCompose(start: ComposeStart = {}) {
  window.dispatchEvent(new CustomEvent<ComposeStart>(COMPOSE_EVENT, { detail: start }))
}
