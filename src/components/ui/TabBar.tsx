import { NavLink } from 'react-router-dom'
import { useFriends } from '../../lib/social'
import { useTabReselect } from '../../lib/navigation'
import { Glass } from './Glass'
import { HomeIcon, PeopleIcon, PersonIcon, PlusIcon, SearchIcon } from './Icons'

import { t, tp } from '../../lib/i18n'
const TABS = [
  { to: '/', label: t('Início'), Icon: HomeIcon, end: true },
  { to: '/buscar', label: t('Buscar'), Icon: SearchIcon, end: false },
  { to: '/amigos', label: t('Amigos'), Icon: PeopleIcon, end: false },
  { to: '/perfil', label: t('Perfil'), Icon: PersonIcon, end: false },
]

interface TabBarProps {
  onCompose: () => void
}

/** Barra de abas flutuante de vidro + botão "+" de nova review. */
export function TabBar({ onCompose }: TabBarProps) {
  const { data: friends } = useFriends()
  // tocar na aba já aberta: sobe ao topo (ou recarrega, se já estiver no topo)
  const reselect = useTabReselect()
  const pending = (friends ?? []).filter((f) => f.status === 'pendente' && !f.requested_by_me).length

  return (
    <nav className="tabbar" aria-label={t('Navegação principal')}>
      <Glass variant="pill" className="tabbar__tabs">
        {TABS.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="tabbar__tab tap" style={{ position: 'relative' }} onClick={(e) => reselect(to) && e.preventDefault()}>
            <Icon />
            <span>{label}</span>
            {to === '/amigos' && pending > 0 && (
              <span className="count-badge" aria-label={tp(pending, '{n} pedido de amizade', '{n} pedidos de amizade')}>
                {pending}
              </span>
            )}
          </NavLink>
        ))}
      </Glass>
      <button type="button" className="tabbar__plus tap" aria-label={t('Nova review')} onClick={onCompose}>
        <span style={{ color: 'var(--on-accent)', display: 'flex' }}>
          <PlusIcon size={26} />
        </span>
      </button>
    </nav>
  )
}
