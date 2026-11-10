// Links do perfil: descobre para qual rede um endereço leva (para mostrar o ícone dela).
// Ícones em lib/socialIcons.ts (gerados por scripts/marca/icones_redes.py).
// Rede nova: SVG em scripts/marca/redes/, rodar o script e acrescentar uma linha aqui.

import { linkDomain, type ProfileLink } from './profileData'

export type SocialNetwork = { id: string; name: string; hosts: string[] }

/** Ordem importa: o primeiro que bater vale (music.youtube.com antes de qualquer youtube). */
export const SOCIAL_NETWORKS: SocialNetwork[] = [
  { id: 'youtubemusic', name: 'YouTube Music', hosts: ['music.youtube.com'] },
  { id: 'applemusic', name: 'Apple Music', hosts: ['music.apple.com'] },
  { id: 'spotify', name: 'Spotify', hosts: ['spotify.com', 'spotify.link'] },
  { id: 'deezer', name: 'Deezer', hosts: ['deezer.com', 'deezer.page.link'] },
  { id: 'qobuz', name: 'Qobuz', hosts: ['qobuz.com'] },
  { id: 'bandcamp', name: 'Bandcamp', hosts: ['bandcamp.com'] },
  { id: 'lastfm', name: 'Last.fm', hosts: ['last.fm', 'lastfm.com', 'lastfm.com.br'] },
  { id: 'letterboxd', name: 'Letterboxd', hosts: ['letterboxd.com', 'boxd.it'] },
  { id: 'instagram', name: 'Instagram', hosts: ['instagram.com', 'instagr.am'] },
  { id: 'x', name: 'X', hosts: ['x.com', 'twitter.com'] },
  { id: 'facebook', name: 'Facebook', hosts: ['facebook.com', 'fb.com', 'fb.me'] },
  { id: 'reddit', name: 'Reddit', hosts: ['reddit.com', 'redd.it'] },
  { id: 'pinterest', name: 'Pinterest', hosts: ['pinterest.com', 'pinterest.com.br', 'pin.it'] },
  { id: 'github', name: 'GitHub', hosts: ['github.com'] },
]

/** "https://open.spotify.com/user/x" -> Spotify. Vale o domínio e qualquer subdomínio dele. */
export function socialNetwork(url: string): SocialNetwork | null {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
  return SOCIAL_NETWORKS.find((n) => n.hosts.some((h) => host === h || host.endsWith('.' + h))) ?? null
}

/** Nome que aparece no link: o que a pessoa escreveu, senão o nome da rede, senão o domínio. */
export const linkText = (l: ProfileLink) => l.label.trim() || socialNetwork(l.url)?.name || linkDomain(l.url)
