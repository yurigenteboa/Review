import { locale, t } from './i18n'

const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' })

/** "agora", "há 5 min", "ontem", "há 3 dias", "12 de out." */
export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return t('agora')
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), 'minute')
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), 'hour')
  if (diff < 7 * 86400) return rtf.format(-Math.round(diff / 86400), 'day')
  return new Date(iso).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })
}

/** Iniciais para o avatar: "Yuri Soares" -> "YS" */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? '?').trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}

/** Cor estável por pessoa, para o avatar sem foto */
const AVATAR_COLORS = ['#AF52DE', '#0A84FF', '#FF9500', '#34C759', '#FF2D55', '#30B0C7', '#5E5CE6', '#A2845E']
export function avatarColor(id: string): string {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function displayName(p: { display_name: string | null; username: string | null } | null | undefined): string {
  return p?.display_name || (p?.username ? `@${p.username}` : t('Alguém'))
}
