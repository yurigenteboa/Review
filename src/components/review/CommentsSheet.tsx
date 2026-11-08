import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { displayName, timeAgo } from '../../lib/format'
import { useAddComment, useComments, useDeleteComment } from '../../lib/social'
import type { Review } from '../../lib/types'
import { Sheet } from '../ui/Sheet'
import { Avatar } from './ReviewCard'

/** Comentários de uma review, numa sheet. Só carrega quando abre. */
export function CommentsSheet({ review, open, onClose }: { review: Review; open: boolean; onClose: () => void }) {
  const { userId } = useAuth()
  const comments = useComments(open ? review.id : null)
  const add = useAddComment()
  const del = useDeleteComment()
  const [text, setText] = useState('')
  const isOwner = review.user_id === userId

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !text.trim()) return
    await add.mutateAsync({ reviewId: review.id, body: text, uid: userId })
    setText('')
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Comentários · ${review.item.title}`} desktop="side">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {comments.isLoading && <span className="field-hint">Carregando…</span>}
        {comments.data?.length === 0 && (
          <p style={{ margin: 0, textAlign: 'center', color: 'var(--text-3)', fontSize: '0.9375rem' }}>Ninguém comentou ainda.</p>
        )}
        {comments.data?.map((c) => (
          <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Link to={c.user_id === userId ? '/perfil' : `/u/${c.user_id}`} onClick={onClose} style={{ display: 'flex' }}>
              <Avatar profile={c.author} size={32} />
            </Link>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}>
                <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{displayName(c.author)}</strong> · {timeAgo(c.created_at)}
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.9375rem', lineHeight: 1.4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.body}</p>
            </div>
            {(c.user_id === userId || isOwner) && (
              <button
                type="button"
                aria-label="Apagar comentário"
                disabled={del.isPending}
                onClick={() => del.mutate(c)}
                style={{ border: 'none', background: 'none', color: 'var(--text-3)', fontSize: '0.8125rem', minHeight: 32 }}
              >
                Apagar
              </button>
            )}
          </div>
        ))}

        <form onSubmit={send} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 4 }}>
          <label style={{ flex: 1 }}>
            <span className="visually-hidden">Escrever comentário</span>
            <textarea
              className="field"
              rows={2}
              maxLength={1000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Escreva um comentário…"
              style={{ height: 'auto', padding: '10px 14px', resize: 'none', lineHeight: 1.4 }}
            />
          </label>
          <button className="btn btn--primary tap" disabled={!text.trim() || add.isPending} style={{ minHeight: 44, padding: '0 18px', opacity: text.trim() ? 1 : 0.45 }}>
            Enviar
          </button>
        </form>
        {add.error && <span role="alert" style={{ color: 'var(--cat-filme-ink)', fontSize: '0.875rem' }}>Não deu para comentar: {(add.error as Error).message}</span>}
      </div>
    </Sheet>
  )
}
