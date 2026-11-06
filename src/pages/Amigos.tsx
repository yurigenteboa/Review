import { useState } from 'react'
import { InviteCard } from '../components/social/InviteCard'
import { PersonRow, smallBtn } from '../components/social/PersonRow'
import { SearchIcon } from '../components/ui/Icons'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../lib/auth'
import { useDebounced } from '../lib/hooks'
import { useBreakpoint } from '../lib/breakpoints'
import { useFriends, useRequestFriend, useRespondFriend, useRemoveFriend, useSearchPeople } from '../lib/social'

export default function Amigos() {
  const { userId } = useAuth()
  const [q, setQ] = useState('')
  const term = useDebounced(q, 350)
  const friends = useFriends()
  const people = useSearchPeople(term)
  const request = useRequestFriend()
  const respond = useRespondFriend()
  const remove = useRemoveFriend()
  // Desktop: o convite vai para o painel da direita; no resto fica no meio da lista
  const wide = useBreakpoint() === 'desktop'

  const list = friends.data ?? []
  const received = list.filter((f) => f.status === 'pendente' && !f.requested_by_me)
  const sent = list.filter((f) => f.status === 'pendente' && f.requested_by_me)
  const accepted = list.filter((f) => f.status === 'aceita')
  const stateOf = (id: string) => list.find((f) => f.id === id)

  const sectionTitle = { margin: '8px 4px 0', fontSize: 13, fontWeight: 600, color: 'var(--text-2)' } as const

  return (
    <div className="page page--with-aside">
      <div className="page__main">
        <PageHeader title="Amigos">
          <label className="search-field">
            <span style={{ color: 'var(--text-3)', display: 'flex' }}>
              <SearchIcon size={18} />
            </span>
            <span className="visually-hidden">Buscar pessoas pelo @ ou nome</span>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por @ ou nome" autoCapitalize="none" />
          </label>
        </PageHeader>

        <div className="page__body">
          {term.trim().length >= 2 && (
            <>
              <span style={sectionTitle}>Pessoas</span>
              <div className="group">
                {people.isLoading && <div className="group__row" style={{ color: 'var(--text-3)' }}>Buscando…</div>}
                {people.data?.filter((p) => p.id !== userId).length === 0 && (
                  <div className="group__row" style={{ color: 'var(--text-3)' }}>Ninguém com esse nome ou @. Mande seu link de convite.</div>
                )}
                {people.data
                  ?.filter((p) => p.id !== userId)
                  .map((p) => {
                    const st = stateOf(p.id)
                    return (
                      <PersonRow
                        key={p.id}
                        person={p}
                        actions={
                          st?.status === 'aceita' ? (
                            <span className="vis-badge">Amigos</span>
                          ) : st?.requested_by_me ? (
                            <span className="vis-badge">Pedido enviado</span>
                          ) : st ? (
                            <button type="button" className="btn btn--primary tap" style={smallBtn} onClick={() => respond.mutate({ other: p.id, accept: true })}>
                              Aceitar
                            </button>
                          ) : (
                            <button type="button" className="btn btn--primary tap" style={smallBtn} disabled={request.isPending} onClick={() => request.mutate(p.id)}>
                              Adicionar
                            </button>
                          )
                        }
                      />
                    )
                  })}
              </div>
            </>
          )}

          {received.length > 0 && (
            <>
              <span style={sectionTitle}>Pedidos de amizade ({received.length})</span>
              <div className="group">
                {received.map((f) => (
                  <PersonRow
                    key={f.id}
                    person={f}
                    actions={
                      <>
                        <button type="button" className="btn btn--primary tap" style={smallBtn} disabled={respond.isPending} onClick={() => respond.mutate({ other: f.id, accept: true })}>
                          Aceitar
                        </button>
                        <button type="button" className="btn btn--plain tap" style={smallBtn} disabled={respond.isPending} onClick={() => respond.mutate({ other: f.id, accept: false })}>
                          Recusar
                        </button>
                      </>
                    }
                  />
                ))}
              </div>
            </>
          )}

          {!wide && <InviteCard />}

          <span style={sectionTitle}>Seus amigos ({accepted.length})</span>
          <div className="group">
            {friends.isLoading && <div className="group__row" style={{ color: 'var(--text-3)' }}>Carregando…</div>}
            {!friends.isLoading && accepted.length === 0 && (
              <div className="group__row" style={{ color: 'var(--text-3)' }}>Ainda ninguém. Mande o link de convite acima.</div>
            )}
            {accepted.map((f) => (
              <PersonRow key={f.id} person={f} />
            ))}
          </div>

          {sent.length > 0 && (
            <>
              <span style={sectionTitle}>Pedidos enviados</span>
              <div className="group">
                {sent.map((f) => (
                  <PersonRow
                    key={f.id}
                    person={f}
                    sub="aguardando resposta"
                    actions={
                      <button type="button" className="btn btn--plain tap" style={smallBtn} disabled={remove.isPending} onClick={() => remove.mutate(f.id)}>
                        Cancelar
                      </button>
                    }
                  />
                ))}
              </div>
            </>
          )}

          {(request.error || respond.error) && (
            <span role="alert" style={{ color: 'var(--cat-filme-ink)', fontSize: 14 }}>
              {((request.error || respond.error) as Error).message}
            </span>
          )}
        </div>
      </div>

      {wide && (
        <aside className="page-aside" aria-label="Convidar amigos">
          <InviteCard />
        </aside>
      )}
    </div>
  )
}
