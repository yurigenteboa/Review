import { NavLink } from 'react-router-dom'
import { useFriends } from '../../lib/social'
import { useTabReselect } from '../../lib/navigation'
import { Glass } from './Glass'
import { HomeIcon, PeopleIcon, PersonIcon, PlusIcon, SearchIcon } from './Icons'

const TABS = [
  { to: '/', label: 'Início', Icon: HomeIcon, end: true },
  { to: '/buscar', label: 'Buscar', Icon: SearchIcon, end: false },
  { to: '/amigos', label: 'Amigos', Icon: PeopleIcon, end: false },
  { to: '/perfil', label: 'Perfil', Icon: PersonIcon, end: false },
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
    <nav className="tabbar" aria-label="Navegação principal">
      <Glass variant="pill" className="tabbar__tabs">
        {TABS.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="tabbar__tab tap" style={{ position: 'relative' }} onClick={(e) => reselect(to) && e.preventDefault()}>
            <Icon />
            <span>{label}</span>
            {to === '/amigos' && pending > 0 && (
              <span className="count-badge" aria-label={`${pending} pedidos de amizade`}>
                {pending}
              </span>
            )}
          </NavLink>
        ))}
      </Glass>
      <button type="button" className="tabbar__plus tap" aria-label="Nova review" onClick={onCompose}>
        <span style={{ color: '#fff', display: 'flex' }}>
          <PlusIcon size={26} />
        </span>
      </button>
    </nav>
  )
}
