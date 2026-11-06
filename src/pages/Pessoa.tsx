import { Navigate, useParams } from 'react-router-dom'
import { ProfileView } from '../components/profile/ProfileView'
import { useAuth } from '../lib/auth'

/** Perfil de outra pessoa (/u/:id). O seu redireciona para /perfil. */
export default function Pessoa() {
  const { id } = useParams()
  const { userId } = useAuth()
  if (!id) return <Navigate to="/amigos" replace />
  if (id === userId) return <Navigate to="/perfil" replace />
  return <ProfileView key={id} userId={id} isMe={false} />
}
