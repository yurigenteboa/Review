import 'maplibre-gl/dist/maplibre-gl.css'
import { LngLatBounds, Map as MapLibre, Marker, NavigationControl } from 'maplibre-gl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { Glass } from '../components/ui/Glass'
import { useAuth } from '../lib/auth'
import { categoryById, formatRating, PLACE_SEARCH, type CategoryId } from '../lib/categories'
import { useMapPlaces, type MapPlace } from '../lib/queries'
import { EmptyState, ErrorState } from './states'

/** Estilo de mapa gratuito, sem chave, com dados do OpenStreetMap (atribuição aparece no canto). */
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
/** Centro padrão: Praça da Sé, São Paulo */
const SP: [number, number] = [-46.6339, -23.5505]

type Filter = CategoryId | 'all'

/**
 * Fase 2c · Mapa dos lugares (bar, restaurante, café, banheiro) que você e quem você pode ver
 * registraram. Marcador com a nota e a cor da categoria; preenchido = você esteve lá.
 * Tocar abre um cartão com a média e o link para a página do lugar.
 */
export default function Mapa() {
  const { userId } = useAuth()
  const places = useMapPlaces(userId)
  const [filter, setFilter] = useState<Filter>('all')
  const [onlyMine, setOnlyMine] = useState(false)
  const [picked, setPicked] = useState<MapPlace | null>(null)
  const [locating, setLocating] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibre | null>(null)
  const markers = useRef<Marker[]>([])
  const fitted = useRef(false)

  const visible = useMemo(
    () => (places.data ?? []).filter((p) => (filter === 'all' || p.category === filter) && (!onlyMine || p.mine)),
    [places.data, filter, onlyMine],
  )

  // cria o mapa uma vez
  useEffect(() => {
    if (!box.current || map.current) return
    const m = new MapLibre({
      container: box.current,
      style: STYLE_URL,
      center: SP,
      zoom: 11,
      attributionControl: { compact: true },
      // gestos de dois dedos no celular; a página não "prende" a rolagem com um dedo
      cooperativeGestures: false,
    })
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    m.on('click', () => setPicked(null))
    map.current = m
    return () => {
      m.remove()
      map.current = null
    }
  }, [])

  // marcadores
  useEffect(() => {
    const m = map.current
    if (!m) return
    markers.current.forEach((mk) => mk.remove())
    markers.current = visible.map((p) => {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = `map-pin${p.mine ? ' map-pin--mine' : ''}`
      el.style.setProperty('--pin', `var(--cat-${p.category})`)
      el.style.setProperty('--pin-ink', `var(--cat-${p.category}-ink)`)
      el.setAttribute('aria-label', `${p.title}, ${categoryById(p.category).label}${p.rated ? `, nota ${formatRating(p.avg)}` : ''}`)
      el.textContent = p.rated ? formatRating(p.avg) : '·'
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        setPicked(p)
        m.easeTo({ center: [p.lng, p.lat], duration: 300 })
      })
      return new Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(m)
    })
    // primeira vez com dados: enquadra todos os lugares
    if (!fitted.current && visible.length) {
      fitted.current = true
      if (visible.length === 1) m.jumpTo({ center: [visible[0].lng, visible[0].lat], zoom: 14 })
      else {
        const b = new LngLatBounds()
        visible.forEach((p) => b.extend([p.lng, p.lat]))
        m.fitBounds(b, { padding: 60, maxZoom: 15, duration: 0 })
      }
    }
  }, [visible])

  const nearMe = () => {
    if (!navigator.geolocation || !map.current) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        map.current?.easeTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14 })
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    )
  }

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Todos' },
    ...PLACE_SEARCH.map((id) => ({ id, label: categoryById(id).label })),
  ]

  return (
    <div className="page page--wide map-page">
      <PageHeader title="Mapa" subtitle="Lugares que você e seus amigos registraram">
        <div className="chips no-scrollbar" role="group" aria-label="Filtrar lugares">
          {filters.map((f) => (
            <button key={f.id} type="button" className="chip tap" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
          <button type="button" className="chip tap" aria-pressed={onlyMine} onClick={() => setOnlyMine((v) => !v)}>
            Só os meus
          </button>
        </div>
      </PageHeader>

      <div className="page__body">
        {places.error && <ErrorState error={places.error} onRetry={() => void places.refetch()} />}
        <div className="map-wrap">
          <div ref={box} className="map-canvas" role="region" aria-label="Mapa de lugares" />
          <button type="button" className="glass glass--pill tap map-near" onClick={nearMe} disabled={locating}>
            {locating ? 'Localizando…' : 'Perto de mim'}
          </button>
          {picked && (
            <Glass className="map-card">
              <span className="map-card__cat" style={{ color: `var(--cat-${picked.category}-ink)` }}>
                {categoryById(picked.category).label}
              </span>
              <strong className="map-card__title">{picked.title}</strong>
              {picked.subtitle && <span className="map-card__sub">{picked.subtitle}</span>}
              <span className="map-card__meta">
                {picked.rated ? `${formatRating(picked.avg)} · ` : ''}
                {picked.people === 1 ? (picked.mine ? 'só você foi' : '1 pessoa foi') : `${picked.people} pessoas foram`}
              </span>
              <Link to={`/item/${picked.id}`} className="btn btn--primary tap map-card__open">
                Abrir
              </Link>
            </Glass>
          )}
        </div>
        {places.isSuccess && (places.data ?? []).length === 0 && (
          <EmptyState
            title="Nenhum lugar no mapa ainda"
            text="Registre um bar, restaurante, café ou banheiro escolhendo da busca (com localização) e ele aparece aqui."
          />
        )}
        {places.isSuccess && (places.data ?? []).length > 0 && (
          <p className="field-hint" style={{ margin: '0 4px' }}>
            {visible.length} {visible.length === 1 ? 'lugar' : 'lugares'} · fundo colorido = você esteve lá · lugares cadastrados à mão (sem localização) não aparecem
          </p>
        )}
      </div>
    </div>
  )
}
