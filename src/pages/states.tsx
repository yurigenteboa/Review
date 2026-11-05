// Estados de carregamento, vazio e erro reaproveitados pelas telas.

export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="review-card skeleton" aria-hidden="true" style={{ height: 150 }} />
      ))}
      <span className="visually-hidden" role="status">Carregando…</span>
    </>
  )
}

export function EmptyState({
  title,
  text,
  action,
}: {
  title: string
  text?: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <strong style={{ fontSize: 20 }}>{title}</strong>
      {text && <span style={{ fontSize: 15, color: 'var(--text-3)' }}>{text}</span>}
      {action && (
        <button type="button" className="btn btn--primary tap" style={{ marginTop: 12 }} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" style={{ textAlign: 'center', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
      <strong>Algo deu errado</strong>
      <span style={{ fontSize: 14, color: 'var(--text-3)' }}>{(error as Error)?.message ?? 'Erro desconhecido'}</span>
      {onRetry && (
        <button type="button" className="btn btn--plain tap" onClick={onRetry}>
          Tentar de novo
        </button>
      )}
    </div>
  )
}
