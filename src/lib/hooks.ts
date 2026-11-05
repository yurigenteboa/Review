import { useEffect, useState } from 'react'

/** Devolve o valor só depois que a pessoa para de digitar por `ms` milissegundos. */
export function useDebounced<T>(value: T, ms = 400): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

type Near = { lat: number; lng: number }

/** Localização aproximada, pedida só quando a pessoa toca em "Perto de mim". */
export function useNearMe() {
  const [near, setNear] = useState<Near | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'denied' | 'error'>('idle')

  const request = () => {
    if (!('geolocation' in navigator)) {
      setStatus('error')
      return
    }
    setStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setNear({ lat: p.coords.latitude, lng: p.coords.longitude })
        setStatus('idle')
      },
      (e) => setStatus(e.code === e.PERMISSION_DENIED ? 'denied' : 'error'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    )
  }

  return { near, status, request, clear: () => setNear(null) }
}
