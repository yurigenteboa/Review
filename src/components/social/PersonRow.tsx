import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { displayName } from '../../lib/format'
import type { Profile } from '../../lib/types'
import { Avatar } from '../review/ReviewCard'

/** Linha de pessoa (avatar, nome, @) com ações à direita. */
export function PersonRow({ person, sub, actions }: { person: Profile; sub?: string; actions?: ReactNode }) {
  return (
    <div className="group__row">
      <Link to={`/u/${person.id}`} className="tap" style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
        <Avatar profile={person} size={40} />
        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <strong style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName(person)}</strong>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}>{sub ?? (person.username ? `@${person.username}` : 'sem @ ainda')}</span>
        </span>
      </Link>
      {actions && <span style={{ display: 'flex', gap: 6, flex: 'none' }}>{actions}</span>}
    </div>
  )
}

export const smallBtn = { minHeight: 36, padding: '0 14px', fontSize: '0.875rem' } as const
