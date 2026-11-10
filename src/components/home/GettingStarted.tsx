import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { requestCompose } from '../../lib/composeBus'
import { useMyProfile } from '../../lib/queries'
import { useFriends } from '../../lib/social'
import { supabase } from '../../lib/supabase'

import { t } from '../../lib/i18n'
const HIDE_KEY = 'mmisc.gettingStartedHidden'

/** Quantas entradas a pessoa já tem (só a contagem, sem baixar as reviews). */
function useMyEntryCount(userId: string | null) {
  return useQuery({
    queryKey: ['entry-count', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { count, error } = await supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('user_id', userId!)
      if (error) throw error
      return count ?? 0
    },
  })
}

/**
 * M4 · Primeiros passos: um cartão no topo do Início para quem está começando.
 * Cada passo se marca sozinho pelo que já existe (@, foto, primeiro registro, um amigo).
 * Some quando tudo estiver feito ou quando a pessoa tocar em "Ocultar".
 * (Substitui o antigo cartão "Escolha seu @".)
 */
export function GettingStarted() {
  const { userId } = useAuth()
  const { data: me } = useMyProfile(userId)
  const friends = useFriends()
  const entries = useMyEntryCount(userId)
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(HIDE_KEY) === '1'
    } catch {
      return false
    }
  })

  if (!me || hidden || friends.isLoading || entries.isLoading) return null

  const steps = [
    { done: Boolean(me.username), label: t('Escolher seu @'), hint: t('É como seus amigos te acham'), to: '/perfil' },
    { done: Boolean(me.avatar_url), label: t('Colocar uma foto'), hint: t('Toque na sua foto no perfil'), to: '/perfil' },
    { done: (entries.data ?? 0) > 0, label: t('Fazer o primeiro registro'), hint: t('Um álbum, filme, bar… leva 2 toques'), action: () => requestCompose() },
    {
      done: (friends.data ?? []).some((f) => f.status === 'aceita'),
      label: t('Adicionar um amigo'),
      hint: t('Mande seu link de convite'),
      to: '/amigos',
    },
  ]
  const doneCount = steps.filter((s) => s.done).length
  if (doneCount === steps.length) return null

  const hide = () => {
    try {
      localStorage.setItem(HIDE_KEY, '1')
    } catch {
      /* modo privado */
    }
    setHidden(true)
  }

  return (
    <section className="starter" aria-label={t('Primeiros passos')}>
      <header className="starter__head">
        <div>
          <h2>{t('Primeiros passos')}</h2>
          <p>
            {t('{feitos} de {total} feitos', { feitos: doneCount, total: steps.length })}
          </p>
        </div>
        <button type="button" className="link-btn" onClick={hide}>
          {t('Ocultar')}
        </button>
      </header>
      <div className="starter__bar" aria-hidden="true">
        <span style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ol className="starter__list">
        {steps.map((s) => {
          const body = (
            <>
              <span className={`starter__check ${s.done ? 'is-done' : ''}`} aria-hidden="true">
                {s.done ? '✓' : ''}
              </span>
              <span className="starter__text">
                <strong>{s.label}</strong>
                {!s.done && <span>{s.hint}</span>}
              </span>
              {!s.done && (
                <span className="starter__go" aria-hidden="true">
                  ›
                </span>
              )}
            </>
          )
          return (
            <li key={s.label} className={s.done ? 'is-done' : undefined}>
              <span className="visually-hidden">{s.done ? t('Feito: ') : t('A fazer: ')}</span>
              {s.done ? (
                <div className="starter__row">{body}</div>
              ) : s.to ? (
                <Link to={s.to} className="starter__row tap">
                  {body}
                </Link>
              ) : (
                <button type="button" className="starter__row tap" onClick={s.action}>
                  {body}
                </button>
              )}
            </li>
          )
        })}
      </ol>
      <Link to="/importar" className="starter__extra">
        {t('Já usa o Letterboxd? Traga seu diário de filmes')}
      </Link>
    </section>
  )
}
