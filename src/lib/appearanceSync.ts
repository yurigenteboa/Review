import { supabase } from './supabase'
import {
  applyFromAccount,
  currentAppearance,
  localChangedAt,
  onUserChange,
  syncable,
  type AccentId,
  type Appearance,
  type SyncedAppearance,
} from './appearance'

/**
 * A4 · Aparência na conta. Com "Usar em todos os meus aparelhos" ligado (padrão):
 * - ao entrar, compara a hora da última mudança neste aparelho com a da conta; vale a mais recente;
 * - cada mudança feita pela pessoa vai para a conta 1 s depois (várias mexidas = uma gravação);
 * - a cor de destaque também vai para profiles.cor_destaque (a única parte pública).
 * O tamanho do texto nunca sai do aparelho. Tabela user_settings: só o dono lê e grava (RLS).
 * Falhas de rede não atrapalham: a aparência continua valendo no aparelho e tenta de novo na próxima mudança.
 */

let stopFns: (() => void)[] = []
let timer: number | undefined
let lastColor: AccentId | null = null

async function push(userId: string, a: Appearance) {
  const when = localChangedAt() ?? new Date().toISOString()
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, aparencia: syncable(a), atualizado_em: when }, { onConflict: 'user_id' })
  if (error) throw error
  if (a.destaque !== lastColor) {
    const { error: e2 } = await supabase.from('profiles').update({ cor_destaque: a.destaque }).eq('id', userId)
    if (!e2) lastColor = a.destaque
  }
}

export function stopAppearanceSync() {
  window.clearTimeout(timer)
  stopFns.forEach((f) => f())
  stopFns = []
}

export async function startAppearanceSync(userId: string) {
  stopAppearanceSync()

  // mudanças da pessoa → conta (se o interruptor estiver ligado neste aparelho)
  stopFns.push(
    onUserChange((a) => {
      window.clearTimeout(timer)
      if (!a.sincronizar) return
      timer = window.setTimeout(() => void push(userId, a).catch(() => {}), 1000)
    }),
  )

  if (!currentAppearance().sincronizar) return
  const { data, error } = await supabase.from('user_settings').select('aparencia, atualizado_em').eq('user_id', userId).maybeSingle()
  if (error) return
  const local = localChangedAt()
  if (data) {
    const remoteAt = new Date(data.atualizado_em as string).getTime()
    const localAt = local ? new Date(local).getTime() : 0
    if (remoteAt > localAt) {
      applyFromAccount(data.aparencia as Partial<SyncedAppearance>, data.atualizado_em as string)
      lastColor = (data.aparencia as Partial<SyncedAppearance>).destaque ?? null
      return
    }
    if (localAt > remoteAt) await push(userId, currentAppearance()).catch(() => {})
    return
  }
  // nada na conta ainda: só sobe se a pessoa já mexeu em algo neste aparelho
  if (local) await push(userId, currentAppearance()).catch(() => {})
}
