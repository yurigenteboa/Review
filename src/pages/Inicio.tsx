import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, ReviewCard } from '../components/review/ReviewCard'
import { CategoryChips } from '../components/ui/Chips'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../lib/auth'
import type { CategoryId } from '../lib/categories'
import { useFeed, useMyProfile } from '../lib/queries'
import { useUnreadCount } from '../lib/social'
import { BellIcon } from '../components/ui/Icons'
import { openMenu } from '../lib/menuBus'
import { EmptyState, ErrorState, LoadingCards } from './states'
import { HomeAside } from '../components/home/HomeAside'
import { NowStrip } from '../components/home/NowStrip'
import { GettingStarted } from '../components/home/GettingStarted'
import { InstallCard } from '../components/home/InstallCard'
import { useBreakpoint } from '../lib/breakpoints'

export default function Inicio({ onCompose }: { onCompose: () => void }) {
  const [cat, setCat] = useState<CategoryId | 'all'>('all')
  const { userId } = useAuth()
  const { data: me } = useMyProfile(userId)
  const feed = useFeed(cat)
  const unread = useUnreadCount()
  const wide = useBreakpoint() === 'desktop'

  return (
    <div className="page page--with-aside">
      <div className="page__main">
        <PageHeader
          title="Início"
          subtitle="Suas reviews e as dos seus amigos"
          trailing={
            // No tablet/desktop, sininho e perfil já estão na barra lateral
            <span className="mobile-only" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Link to="/notificacoes" className="icon-btn tap" aria-label={unread ? `Notificações (${unread} novas)` : 'Notificações'}>
                <BellIcon size={22} />
                {unread > 0 && <span className="count-badge">{unread > 9 ? '9+' : unread}</span>}
              </Link>
              {me && (
                <button type="button" className="menu-avatar-btn tap" aria-label="Abrir menu" onClick={openMenu}>
                  <Avatar profile={me} size={40} />
                </button>
              )}
            </span>
          }
        >
          <CategoryChips value={cat} onChange={setCat} />
        </PageHeader>

        <div className="page__body">
          {/* M4: convite para instalar (celular) e primeiros passos (substitui o "Escolha seu @") */}
          <InstallCard />
          <GettingStarted />
          {/* M3: fileira "Agora" (você + amigos), só na visão "Tudo" */}
        {cat === 'all' && <NowStrip />}
        {feed.isLoading && <LoadingCards />}
          {feed.error && <ErrorState error={feed.error} onRetry={() => feed.refetch()} />}
          {feed.data?.map((r) => <ReviewCard key={r.id} review={r} />)}
          {feed.data?.length === 0 && (
            <EmptyState
              title={cat === 'all' ? 'Nada por aqui ainda' : 'Nenhuma review nessa categoria'}
              text="Comece registrando o que você ouviu, viu ou visitou."
              action={{ label: 'Nova review', onClick: onCompose }}
            />
          )}
        </div>
      </div>

      {/* Desktop: painel com amigos e sua lista (D2 do plano desktop) */}
      {wide && <HomeAside />}
    </div>
  )
}
