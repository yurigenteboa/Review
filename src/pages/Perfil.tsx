import { ProfileView } from '../components/profile/ProfileView'
import { useAuth } from '../lib/auth'

/** Seu perfil: a mesma tela do perfil dos outros, com as opções de dono. */
export default function Perfil() {
  const { userId } = useAuth()
  if (!userId) return null
  return <ProfileView userId={userId} isMe />
}
