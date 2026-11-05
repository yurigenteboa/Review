import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, ReviewCard } from '../components/review/ReviewCard'
import { CategoryChips } from '../components/ui/Chips'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../lib/auth'
import type { CategoryId } from '../lib/categories'
import { useFeed, useMyProfile } from '../lib/queries'
import { EmptyState, ErrorState, LoadingCards } from './states'

export default function Inicio({ onCompose }: { onCompose: () => void }) {
  const [cat, setCat] = useState<CategoryId | 'all'>('all')
  const { userId } = useAuth()
  const { data: me } = useMyProfile(userId)
  const feed = useFeed(cat)

  return (
    <div className="page">
      <PageHeader
        title="Início"
        subtitle="Suas reviews e as dos seus amigos"
        trailing={
          me && (
            <Link to="/perfil" aria-label="Abrir seu perfil" className="tap" style={{ display: 'flex' }}>
              <Avatar profile={me} size={40} />
            </Link>
          )
        }
      >
        <CategoryChips value={cat} onChange={setCat} />
      </PageHeader>

      <div className="page__body">
        {feed.isLoading && <LoadingCards />}
        {feed.error && <ErrorState error={feed.error} onRetry={() => feed.refetch()} />}
        {feed.data?.map((r) => <ReviewCard key={r.id} review={r} />)}
        {feed.data?.length === 0 && (
          <EmptyState
            title={cat === 'all' ? 'Nada por aqui ainda' : 'Nenhuma review nessa categoria'}
            text="Toque no + para fazer a sua primeira review."
            action={{ label: 'Nova review', onClick: onCompose }}
          />
        )}
      </div>
    </div>
  )
}
