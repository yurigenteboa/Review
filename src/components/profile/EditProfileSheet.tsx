import { useRef, useState } from 'react'
import { Avatar } from '../review/ReviewCard'
import { Sheet } from '../ui/Sheet'
import { CATEGORIES, categoryById, type CategoryId } from '../../lib/categories'
import { BIO_MAX, useSaveProfile, type ProfileFull } from '../../lib/profile'
import {
  linkDomain,
  normalizeUrl,
  useRemoveProfileImage,
  useSaveProfileExtras,
  useUploadProfileImage,
  type ProfileLink,
} from '../../lib/profileData'
import { publicProfileUrl } from '../../lib/publicProfile'

import { t } from '../../lib/i18n'
/** Editar perfil: nome, @, bio, foto, capa, links e as categorias da vitrine. */
export function EditProfileSheet({ profile: p, onClose }: { profile: ProfileFull; onClose: () => void }) {
  const save = useSaveProfile()
  const extras = useSaveProfileExtras()
  const upload = useUploadProfileImage()
  const removeImg = useRemoveProfileImage()
  const [name, setName] = useState(p.display_name ?? '')
  const [username, setUsername] = useState(p.username ?? '')
  const [bio, setBio] = useState(p.bio ?? '')
  const [links, setLinks] = useState<ProfileLink[]>(p.links ?? [])
  const [showcase, setShowcase] = useState<CategoryId[]>(p.showcase ?? [])
  const [coverMode, setCoverMode] = useState<'auto' | 'foto'>(p.cover_mode ?? 'auto')
  const [isPublic, setIsPublic] = useState(p.is_public ?? true)
  const [copied, setCopied] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const avatarInput = useRef<HTMLInputElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)

  const busy = save.isPending || extras.isPending
  const imgBusy = upload.isPending || removeImg.isPending
  const error = (save.error ?? extras.error ?? upload.error ?? removeImg.error) as Error | null

  const toggleCat = (c: CategoryId) => setShowcase((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean: ProfileLink[] = []
    for (const l of links) {
      if (!l.url.trim() && !l.label.trim()) continue
      const url = normalizeUrl(l.url)
      if (!url) {
        setLinkError(t('"{url}" não parece um link.', { url: l.url }))
        return
      }
      clean.push({ label: l.label.trim().slice(0, 40), url })
    }
    setLinkError(null)
    try {
      await save.mutateAsync({ id: p.id, display_name: name, username, bio })
      await extras.mutateAsync({ userId: p.id, links: clean, showcase, cover_mode: coverMode === 'foto' && !p.cover_url ? 'auto' : coverMode, is_public: isPublic })
      onClose()
    } catch {
      /* mensagem abaixo */
    }
  }

  const pickFile = (kind: 'avatar' | 'cover') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    upload.mutate({ userId: p.id, kind, file }, { onSuccess: () => kind === 'cover' && setCoverMode('foto') })
  }

  return (
    <Sheet open onClose={onClose} title={t('Editar perfil')}>
      <form className="profile__edit" onSubmit={submit}>
        <fieldset className="edit-block">
          <legend className="field-label">{t('Foto')}</legend>
          <div className="edit-photo">
            <Avatar profile={p} size={64} />
            <button type="button" className="btn btn--plain tap edit-small" disabled={imgBusy} onClick={() => avatarInput.current?.click()}>
              {upload.isPending && upload.variables?.kind === 'avatar' ? t('Enviando…') : t('Trocar foto')}
            </button>
            {p.avatar_url && (
              <button type="button" className="link-btn" disabled={imgBusy} onClick={() => removeImg.mutate({ userId: p.id, kind: 'avatar' })}>
                {t('Tirar')}
              </button>
            )}
            <input ref={avatarInput} type="file" accept="image/*" hidden onChange={pickFile('avatar')} />
          </div>
        </fieldset>

        <fieldset className="edit-block">
          <legend className="field-label">{t('Capa')}</legend>
          <div className="segmented" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <button type="button" aria-pressed={coverMode === 'auto'} aria-selected={coverMode === 'auto'} onClick={() => setCoverMode('auto')}>
              {t('Automática')}
            </button>
            <button
              type="button"
              aria-pressed={coverMode === 'foto'}
              aria-selected={coverMode === 'foto'}
              onClick={() => (p.cover_url ? setCoverMode('foto') : coverInput.current?.click())}
            >
              {t('Foto')}
            </button>
          </div>
          <span className="field-hint">
            {coverMode === 'auto' ? t('Mosaico das capas que você mais curte.') : t('Sua foto no topo do perfil.')}{' '}
            <button type="button" className="link-btn" disabled={imgBusy} onClick={() => coverInput.current?.click()}>
              {upload.isPending && upload.variables?.kind === 'cover' ? t('Enviando…') : p.cover_url ? t('Trocar foto da capa') : t('Escolher foto')}
            </button>
            {p.cover_url && (
              <>
                {' · '}
                <button type="button" className="link-btn" disabled={imgBusy} onClick={() => removeImg.mutate({ userId: p.id, kind: 'cover' }, { onSuccess: () => setCoverMode('auto') })}>
                  {t('Apagar')}
                </button>
              </>
            )}
          </span>
          <input ref={coverInput} type="file" accept="image/*" hidden onChange={pickFile('cover')} />
        </fieldset>

        <label>
          <span className="field-label">{t('Nome')}</span>
          <input className="field" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          <span className="field-label">{t('@ de usuário')}</span>
          <input
            className="field"
            value={username}
            maxLength={24}
            autoCapitalize="none"
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
            placeholder="yuri"
          />
        </label>
        <label>
          <span className="field-label">{t('Bio')}</span>
          <textarea
            className="field profile__bio-input"
            value={bio}
            maxLength={BIO_MAX}
            rows={3}
            onChange={(e) => setBio(e.target.value)}
            placeholder={t('O que você gosta, o que está procurando, onde mais te achar…')}
          />
          <span className="field-hint" style={{ textAlign: 'right' }}>
            {bio.length}/{BIO_MAX}
          </span>
        </label>

        <fieldset className="edit-block">
          <legend className="field-label">{t('Links (até 5)')}</legend>
          {links.map((l, i) => (
            <div key={i} className="edit-link">
              <input
                className="field"
                value={l.label}
                maxLength={40}
                placeholder={l.url ? linkDomain(normalizeUrl(l.url) ?? l.url) : t('Nome')}
                aria-label={t('Nome do link {v}', { v: i + 1 })}
                onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              />
              <input
                className="field"
                value={l.url}
                inputMode="url"
                autoCapitalize="none"
                placeholder="letterboxd.com/voce"
                aria-label={t('Endereço do link {v}', { v: i + 1 })}
                onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
              />
              <button type="button" className="fav-row__btn" aria-label={t('Tirar link {v}', { v: i + 1 })} onClick={() => setLinks(links.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
          ))}
          {links.length < 5 && (
            <button type="button" className="link-btn" onClick={() => setLinks([...links, { label: '', url: '' }])}>
              {t('+ Adicionar link')}
            </button>
          )}
          {linkError && <span role="alert" className="form-error">{linkError}</span>}
        </fieldset>

        <fieldset className="edit-block">
          <legend className="field-label">{t('Vitrine de favoritos')}</legend>
          <span className="field-hint" style={{ margin: '0 4px 8px' }}>
            {t('Quais categorias aparecem em "Tudo", na ordem em que você tocar.')}
          </span>
          <div className="chips-wrap">
            {CATEGORIES.map((c) => {
              const idx = showcase.indexOf(c.id)
              return (
                <button key={c.id} type="button" className="chip tap" aria-pressed={idx >= 0} onClick={() => toggleCat(c.id)}>
                  {idx >= 0 ? `${idx + 1}. ` : ''}
                  {categoryById(c.id).label}
                </button>
              )
            })}
          </div>
        </fieldset>

        <fieldset className="edit-block">
          <legend className="field-label">{t('Perfil público')}</legend>
          <div className="segmented" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <button type="button" aria-pressed={isPublic} aria-selected={isPublic} onClick={() => setIsPublic(true)}>
              {t('Público')}
            </button>
            <button type="button" aria-pressed={!isPublic} aria-selected={!isPublic} onClick={() => setIsPublic(false)}>
              {t('Privado')}
            </button>
          </div>
          <span className="field-hint" style={{ margin: '0 4px' }}>
            {isPublic
              ? t('Qualquer pessoa com o link vê: nome, @, foto, capa, bio, links, e o que estiver como Público (reviews, favoritos, Top 10). Amigos, metas, quero ver, notas privadas e o que é só para amigos ficam de fora.')
              : t('Ninguém sem conta vê seu perfil. Quem tem conta no MMisc continua vendo seu nome e o que você deixar visível.')}
          </span>
          {isPublic && (username ? (
            <span className="field-hint" style={{ margin: '0 4px' }}>
              {t('Seu link:')} <strong>{publicProfileUrl(username).replace(/^https?:\/\//, '')}</strong>{' '}
              <button
                type="button"
                className="link-btn"
                onClick={async () => {
                  const url = publicProfileUrl(username)
                  try {
                    if (navigator.share) await navigator.share({ title: t('Meu perfil no MMisc'), url })
                    else {
                      await navigator.clipboard.writeText(url)
                      setCopied(true)
                    }
                  } catch {
                    /* cancelou o compartilhamento */
                  }
                }}
              >
                {copied ? t('Copiado ✓') : t('Compartilhar')}
              </button>
            </span>
          ) : (
            <span className="field-hint" style={{ margin: '0 4px' }}>{t('Escolha um @ acima para ter seu link.')}</span>
          ))}
        </fieldset>

        {error && <span role="alert" className="form-error">{error.message}</span>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--primary tap" disabled={busy} style={{ flex: 1 }}>
            {busy ? t('Salvando…') : t('Salvar')}
          </button>
          <button type="button" className="btn btn--plain tap" onClick={onClose}>
            {t('Cancelar')}
          </button>
        </div>
      </form>
    </Sheet>
  )
}
