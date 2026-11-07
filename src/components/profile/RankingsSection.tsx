import { Link } from 'react-router-dom'
import { RANKED_CATEGORIES } from '../../lib/categories'
import { CATEGORY_PLURAL } from '../../lib/profileStats'
import { useMyRankCounts } from '../../lib/queries'

/** Seção do perfil (só o dono): atalho para cada ranking que já tem lugares. */
export function RankingsSection({ userId }: { userId: string }) {
  const counts = useMyRankCounts(userId)
  const cats = RANKED_CATEGORIES.filter((c) => (counts.data?.[c.id] ?? 0) > 0)
  if (cats.length === 0) return null
  return (
    <section className="profile-section" aria-labelledby="sec-rankings">
      <div className="profile-section__head">
        <h2 id="sec-rankings">Seus lugares em ordem</h2>
      </div>
      <div className="chips no-scrollbar">
        {cats.map((c) => (
          <Link key={c.id} to={`/ranking?cat=${c.id}`} className="chip tap">
            {CATEGORY_PLURAL[c.id][0].toUpperCase() + CATEGORY_PLURAL[c.id].slice(1)} · {counts.data?.[c.id]} ›
          </Link>
        ))}
      </div>
    </section>
  )
}
