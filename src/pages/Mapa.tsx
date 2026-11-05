import { PageHeader } from '../components/ui/PageHeader'

export default function Mapa() {
  return (
    <div className="page">
      <PageHeader title="Mapa" subtitle="Bares, banheiros e cidades que você avaliou" />
      <div className="page__body">
        <div
          style={{
            height: 420,
            borderRadius: 'var(--r-lg)',
            backgroundColor: 'var(--fill)',
            backgroundImage:
              'linear-gradient(var(--surface) 6px, transparent 6px), linear-gradient(90deg, var(--surface) 6px, transparent 6px)',
            backgroundSize: '96px 120px, 120px 96px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-3)',
            fontSize: 15,
            textAlign: 'center',
            padding: 24,
          }}
        >
          O mapa de verdade (MapLibre + OpenStreetMap) entra na Fase 5.
        </div>
      </div>
    </div>
  )
}
