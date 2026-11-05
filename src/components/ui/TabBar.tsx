import { NavLink } from 'react-router-dom'
import { Glass } from './Glass'
import { HomeIcon, MapIcon, PersonIcon, PlusIcon, SearchIcon } from './Icons'

const TABS = [
  { to: '/', label: 'Início', Icon: HomeIcon, end: true },
  { to: '/buscar', label: 'Buscar', Icon: SearchIcon, end: false },
  { to: '/mapa', label: 'Mapa', Icon: MapIcon, end: false },
  { to: '/perfil', label: 'Perfil', Icon: PersonIcon, end: false },
]

interface TabBarProps {
  onCompose: () => void
}

/** Barra de abas flutuante de vidro + botão "+" de nova review. */
export function TabBar({ onCompose }: TabBarProps) {
  return (
    <nav className="tabbar" aria-label="Navegação principal">
      <Glass variant="pill" className="tabbar__tabs">
        {TABS.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="tabbar__tab tap">
            <Icon />
            <span>{label}</span>
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
