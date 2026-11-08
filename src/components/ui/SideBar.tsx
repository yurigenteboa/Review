import { NavLink } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { useMyProfile } from '../../lib/queries'
import { useFriends, useUnreadCount } from '../../lib/social'
import { useTabReselect } from '../../lib/navigation'
import { Avatar } from '../review/ReviewCard'
import { Wordmark } from './Brand'
import { Glass } from './Glass'
import { BellIcon, HomeIcon, MoreIcon, PeopleIcon, PersonIcon, PlusIcon, SearchIcon } from './Icons'
import { openMenu } from '../../lib/menuBus'

interface SideBarProps {
  onCompose: () => void
  /** tablet: só ícones (72 px) · desktop: ícones + nomes (240 px) */
  compact: boolean
}

/**
 * Navegação do tablet e do desktop: barra lateral de vidro à esquerda,
 * no lugar da barra de abas de baixo. Mesmo destino das abas do celular,
 * mais Notificações (no celular fica no sininho do Início) e "Nova review".
 */
export function SideBar({ onCompose, compact }: SideBarProps) {
  const { userId } = useAuth()
  const { data: me } = useMyProfile(userId)
  const { data: friends } = useFriends()
  const unread = useUnreadCount()
  const reselect = useTabReselect()
  const pending = (friends ?? []).filter((f) => f.status === 'pendente' && !f.requested_by_me).length

  const items = [
    { to: '/', label: 'Início', icon: <HomeIcon />, end: true, badge: 0, badgeLabel: '' },
    { to: '/buscar', label: 'Buscar', icon: <SearchIcon />, end: false, badge: 0, badgeLabel: '' },
    { to: '/amigos', label: 'Amigos', icon: <PeopleIcon />, end: false, badge: pending, badgeLabel: `${pending} pedidos de amizade` },
    { to: '/notificacoes', label: 'Notificações', icon: <BellIcon />, end: false, badge: unread, badgeLabel: `${unread} notificações novas` },
    {
      to: '/perfil',
      label: 'Perfil',
      icon: me ? <Avatar profile={me} size={26} /> : <PersonIcon />,
      end: false,
      badge: 0,
      badgeLabel: '',
    },
  ]

  return (
    <Glass as="nav" variant="bar" className={`sidebar ${compact ? 'sidebar--compact' : ''}`} aria-label="Navegação principal">
      <NavLink to="/" className="sidebar__brand tap" aria-label="MMisc, ir para o Início">
        {compact ? (
          <img src="/favicon.svg" alt="" width={36} height={36} />
        ) : (
          <Wordmark label="" className="sidebar__wordmark" />
        )}
      </NavLink>

      <ul className="sidebar__list">
        {items.map((it) => (
          <li key={it.to}>
            <NavLink
              to={it.to}
              end={it.end}
              className="sidebar__item tap"
              onClick={(e) => reselect(it.to) && e.preventDefault()}
              aria-label={compact ? it.label : undefined}
              title={compact ? it.label : undefined}
            >
              <span className="sidebar__icon">
                {it.icon}
                {it.badge > 0 && (
                  <span className="count-badge sidebar__badge" aria-label={it.badgeLabel}>
                    {it.badge > 9 ? '9+' : it.badge}
                  </span>
                )}
              </span>
              {!compact && <span className="sidebar__label">{it.label}</span>}
            </NavLink>
          </li>
        ))}
        <li>
          {/* Mapa, Aparência, Retrospectiva, Perfil público, Sair: no menu lateral */}
          <button
            type="button"
            className="sidebar__item sidebar__more tap"
            onClick={openMenu}
            aria-label={compact ? 'Mais' : undefined}
            title={compact ? 'Mais' : undefined}
          >
            <span className="sidebar__icon">
              <MoreIcon />
            </span>
            {!compact && <span className="sidebar__label">Mais</span>}
          </button>
        </li>
      </ul>

      <button
        type="button"
        className="sidebar__compose tap"
        onClick={onCompose}
        aria-label={compact ? 'Nova review' : undefined}
        title="Nova review (atalho: N)"
      >
        <PlusIcon size={compact ? 26 : 22} />
        {!compact && <span>Nova review</span>}
      </button>
    </Glass>
  )
}
