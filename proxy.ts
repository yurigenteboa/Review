// Vercel Routing Middleware (ligado em vercel.json → "proxy"). Roda SÓ em /@usuario.
//
// Por quê: o MMisc é uma página única montada no navegador, e o WhatsApp/Instagram/X
// não rodam JavaScript para montar a prévia do link. Aqui pegamos o index.html,
// colocamos título, descrição e imagem do perfil no <head> e devolvemos.
// Pessoas recebem a mesma página (o app carrega normalmente por cima).
//
// Usa só a chave pública (anon) que o app já usa, e a função public_profile,
// que devolve apenas o que é público. Qualquer falha devolve a página sem prévia.

const HANDLE = /^\/@([A-Za-z0-9_.]{3,24})\/?$/

interface PublicData {
  profile: { username: string; display_name: string | null; avatar_url: string | null; bio: string | null; cover_mode: string; cover_url: string | null }
  favorites: { item: { image_url: string | null } }[]
  reviews: { rating: number | string | null }[]
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

async function loadProfile(handle: string): Promise<PublicData | null> {
  const base = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!base || !key) return null
  const res = await fetch(`${base}/rest/v1/rpc/public_profile`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_handle: handle }),
    signal: AbortSignal.timeout(2500),
  })
  if (!res.ok) return null
  return (await res.json()) as PublicData | null
}

export function previewTags(d: PublicData, pageUrl: string, origin: string): string {
  const p = d.profile
  const name = p.display_name || `@${p.username}`
  const rated = d.reviews.map((r) => (r.rating == null ? null : Number(r.rating))).filter((n): n is number => n != null)
  const avg = rated.length ? (rated.reduce((s, n) => s + n, 0) / rated.length).toFixed(1).replace('.', ',') : null
  const numbers = d.reviews.length
    ? `${d.reviews.length} ${d.reviews.length === 1 ? 'review' : 'reviews'} no MMisc${avg ? ` · nota média ${avg}` : ''}`
    : 'Perfil no MMisc: nota para tudo.'
  const description = (p.bio ? `${p.bio.slice(0, 160)} · ` : '') + numbers
  const image =
    (p.cover_mode === 'foto' && p.cover_url) || p.avatar_url || d.favorites.find((f) => f.item.image_url)?.item.image_url || `${origin}/brand/og.png`
  const title = `${name} (@${p.username}) · MMisc`
  const big = Boolean(p.cover_mode === 'foto' && p.cover_url)
  return [
    `<meta name="description" content="${esc(description)}">`,
    `<meta property="og:type" content="profile">`,
    `<meta property="og:site_name" content="MMisc">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(pageUrl)}">`,
    `<meta property="og:image" content="${esc(image)}">`,
    `<meta property="profile:username" content="${esc(p.username)}">`,
    `<meta name="twitter:card" content="${big ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    `<meta name="twitter:image" content="${esc(image)}">`,
  ].join('\n    ')
}

export function injectTags(html: string, title: string, tags: string): string {
  const withTitle = html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/\s*<meta name="description"[^>]*>/, '') // a descrição genérica sai; entra a do perfil
    .replace(/\s*<!-- og:padrao[\s\S]*?<!-- \/og:padrao -->/, '') // a prévia padrão do site também
  return withTitle.replace('</head>', `    ${tags}\n  </head>`)
}

export default async function proxy(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const shellRes = await fetch(new URL('/index.html', url.origin))
  const shell = await shellRes.text()
  const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600' }

  const m = url.pathname.match(HANDLE)
  if (!m) return new Response(shell, { status: 200, headers })
  try {
    const data = await loadProfile(m[1].toLowerCase())
    if (!data) return new Response(shell, { status: 200, headers })
    const name = data.profile.display_name || `@${data.profile.username}`
    const html = injectTags(shell, `${name} (@${data.profile.username}) · MMisc`, previewTags(data, url.toString(), url.origin))
    return new Response(html, { status: 200, headers })
  } catch {
    return new Response(shell, { status: 200, headers })
  }
}
