/**
 * Abre o menu lateral (AppMenu) de qualquer lugar: foto no Início, "Mais" na barra lateral.
 * O App escuta este evento. Mesmo esquema do composeBus.
 */
export const MENU_EVENT = 'mmisc:menu'

export function openMenu() {
  window.dispatchEvent(new CustomEvent(MENU_EVENT))
}
