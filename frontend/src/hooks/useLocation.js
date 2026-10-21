import { useState, useEffect } from 'react'

export function useLocation() {
  const [location, setLocation] = useState(() => typeof navigator !== 'undefined' && navigator.geolocation
    ? { lat: null, lon: null, error: null, loading: true }
    : { lat: null, lon: null, error: 'Geolocation not supported', loading: false })

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude, error: null, loading: false }),
        () => setLocation({ lat: null, lon: null, error: 'Location permission is required to share a report location', loading: false })
    )
  }, [])

  return location
}
