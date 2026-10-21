import { useState, useEffect } from 'react'
import { collection, onSnapshot, updateDoc, doc } from 'firebase/firestore'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { db, firebaseProjectId, isFirebaseConfigured } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, MapPin, Filter, Flame } from 'lucide-react'

// fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const STATUS_COLORS = {
  new: '#C62828',
  reviewing: '#E76F00',
  contained: '#2D6A4F',
}

const STATUS_LABELS = {
  new: 'New',
  reviewing: 'Under Investigation',
  contained: 'Contained',
}

const DEFAULT_CENTER = [19.0748, 74.748]

function HeatLayer({ reports }) {
  const map = useMap()

  useEffect(() => {
    let disposed = false
    let layer
    const points = reports.map(report => [
      Number(report.lat),
      Number(report.lon),
      report.severity === 'high' ? 1 : report.severity === 'medium' ? 0.65 : 0.35,
    ])

    const addHeatLayer = async () => {
      if (typeof L.heatLayer !== 'function') {
        window.L = L
        await import('leaflet.heat')
      }
      if (disposed) return
      layer = L.heatLayer(points, {
        radius: 30,
        blur: 22,
        maxZoom: 12,
        minOpacity: 0.35,
        gradient: { 0.25: '#2D6A4F', 0.55: '#F4A261', 0.8: '#E76F00', 1: '#C62828' },
      })
      layer.addTo(map)
    }

    void addHeatLayer()
    return () => {
      disposed = true
      if (layer) map.removeLayer(layer)
    }
  }, [map, reports])

  return null
}

function FitReports({ reports }) {
  const map = useMap()

  useEffect(() => {
    if (reports.length === 0) {
      map.setView(DEFAULT_CENTER, 7)
    } else if (reports.length === 1) {
      map.setView([Number(reports[0].lat), Number(reports[0].lon)], 11)
    } else {
      map.fitBounds(L.latLngBounds(reports.map(report => [Number(report.lat), Number(report.lon)])), {
        padding: [28, 28],
        maxZoom: 11,
      })
    }
    map.invalidateSize()
  }, [map, reports])

  return null
}

function createColoredIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

export default function Alerts() {
  const { user, loading: authLoading } = useAuth()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterCrop, setFilterCrop] = useState('all')
  const [selected, setSelected] = useState(null)
  const [mapMode, setMapMode] = useState('heatmap')

  const isOfficer = user?.profile?.role === 'officer'
  const isLoading = authLoading || (Boolean(user) && loading)

  useEffect(() => {
    if (authLoading) return undefined
    if (!user?.uid || !isFirebaseConfigured || !db) return undefined

    const unsub = onSnapshot(collection(db, 'diseaseReports'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setReports(data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)))
      setError('')
      setLoading(false)
    }, (snapshotError) => {
      setError(snapshotError.code === 'permission-denied'
        ? 'You do not have permission to view disease alerts.'
        : 'Unable to load disease alerts. Please try again later.')
      setLoading(false)
    })
    return unsub
  }, [authLoading, user?.uid])

  const pageError = !authLoading && !user
    ? 'Please sign in to view disease alerts.'
    : !authLoading && user && (!isFirebaseConfigured || !db)
      ? 'Firebase is not configured. Alerts cannot load yet.'
      : error

  const updateStatus = async (id, status) => {
    try {
      await updateDoc(doc(db, 'diseaseReports', id), { status, updatedAt: new Date() })
    } catch (updateError) {
      setError(updateError.code === 'permission-denied'
        ? 'You do not have permission to update alerts.'
        : 'Unable to update this alert. Please try again.')
    }
  }

  const crops = ['all', ...new Set(reports.map(r => r.cropType).filter(Boolean))]

  const filtered = reports.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false
    if (filterCrop !== 'all' && r.cropType !== filterCrop) return false
    return true
  })

  const validMapReports = filtered.filter(r => {
    if (r.lat === null || r.lat === undefined || r.lon === null || r.lon === undefined) return false
    const lat = Number(r.lat)
    const lon = Number(r.lon)
    return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
      <div className="mt-8 mb-6">
        <h1 className="text-2xl font-bold text-[#1B4332]">Disease Alert Map</h1>
        <p className="text-sm text-gray-500 mt-1">Real-time disease outbreak reports from farmers</p>
        {firebaseProjectId && <p className="text-xs text-gray-400 mt-1">Connected Firebase project: {firebaseProjectId}</p>}
      </div>

      {pageError && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {pageError}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-4 text-sm">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: color }} />
            <span className="text-gray-600">{STATUS_LABELS[status]}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <Card className="rounded-xl shadow-sm border border-gray-100 mb-6">
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <Filter className="w-4 h-4 text-gray-400" />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:border-[#2D6A4F] focus:outline-none">
              <option value="all">All Status</option>
              <option value="new">New</option>
              <option value="reviewing">Under Investigation</option>
              <option value="contained">Contained</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Crop</label>
            <select value={filterCrop} onChange={e => setFilterCrop(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:border-[#2D6A4F] focus:outline-none">
              {crops.map(c => <option key={c} value={c}>{c === 'all' ? 'All Crops' : c}</option>)}
            </select>
          </div>
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} reports</span>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2">
          <Card className="rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
              <p className="text-sm font-medium text-[#1B4332]">{mapMode === 'heatmap' ? 'Outbreak hotspots' : 'Individual reports'}</p>
              <div className="flex gap-2">
                <Button size="sm" variant={mapMode === 'heatmap' ? 'default' : 'outline'}
                  onClick={() => setMapMode('heatmap')} className={mapMode === 'heatmap' ? 'bg-[#2D6A4F] text-white' : ''}>
                  <Flame className="mr-1 h-4 w-4" /> Heatmap
                </Button>
                <Button size="sm" variant={mapMode === 'markers' ? 'default' : 'outline'}
                  onClick={() => setMapMode('markers')} className={mapMode === 'markers' ? 'bg-[#2D6A4F] text-white' : ''}>
                  <MapPin className="mr-1 h-4 w-4" /> Pins
                </Button>
              </div>
            </div>
            <div style={{ height: '480px' }}>
              {isLoading ? (
                <Skeleton className="h-full w-full rounded-none" />
              ) : (
                <MapContainer
                  center={DEFAULT_CENTER}
                  zoom={7}
                  style={{ height: '100%', width: '100%' }}
                >
                  <FitReports reports={validMapReports} />
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='© OpenStreetMap contributors'
                  />
                  {mapMode === 'heatmap' && <HeatLayer reports={validMapReports} />}
                  {mapMode === 'markers' && validMapReports.map(r => (
                    <Marker
                      key={r.id}
                      position={[Number(r.lat), Number(r.lon)]}
                      icon={createColoredIcon(STATUS_COLORS[r.status] || STATUS_COLORS.new)}
                      eventHandlers={{ click: () => setSelected(r) }}
                    >
                      <Popup>
                        <div className="text-sm">
                          <p className="font-semibold">{r.diseaseName}</p>
                          <p className="text-gray-500">{r.cropType} · {r.district}</p>
                          <p className="text-gray-500">Reported by {r.farmerName || 'Farmer'}</p>
                          <p className="text-gray-400 text-xs mt-1">{r.createdAt?.toDate?.()?.toLocaleDateString('en-IN') || 'Unknown date'}</p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              )}
            </div>
            {!isLoading && validMapReports.length === 0 && (
              <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">No reports with valid GPS coordinates match these filters.</p>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-3 max-h-[480px] overflow-y-auto pr-1">
          {isLoading ? (
            Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : filtered.length === 0 ? (
            <Card className="rounded-xl shadow-sm border border-gray-100">
              <CardContent className="p-6 text-center text-gray-400 text-sm">
                No reports found
              </CardContent>
            </Card>
          ) : (
            filtered.map(r => (
              <Card
                key={r.id}
                onClick={() => setSelected(r)}
                className={`rounded-xl shadow-sm border cursor-pointer transition-all ${selected?.id === r.id ? 'border-[#2D6A4F] bg-[#f0fdf4]' : 'border-gray-100 hover:border-gray-200'}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm text-[#111827]">{r.diseaseName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{r.cropType} · {r.district || r.taluka || r.state || 'Location not provided'}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Reported by {r.farmerName || 'Farmer'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{r.createdAt?.toDate?.()?.toLocaleDateString('en-IN') || ''}</p>
                    </div>
                    <div className="w-3 h-3 rounded-full shrink-0 mt-1" style={{ background: STATUS_COLORS[r.status] || STATUS_COLORS.new }} />
                  </div>

                  {isOfficer && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline"
                        onClick={e => { e.stopPropagation(); updateStatus(r.id, 'reviewing') }}
                        className="text-xs border-[#E76F00] text-[#E76F00] h-7 px-2">
                        Investigating
                      </Button>
                      <Button size="sm" variant="outline"
                        onClick={e => { e.stopPropagation(); updateStatus(r.id, 'contained') }}
                        className="text-xs border-[#2D6A4F] text-[#2D6A4F] h-7 px-2">
                        Contained
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Selected report detail */}
      {selected && (
        <Card className="rounded-xl shadow-sm border border-[#2D6A4F] mt-6">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-[#1B4332]">{selected.diseaseName}</h3>
                <p className="text-sm text-gray-500">{selected.cropType} · {[selected.taluka, selected.district, selected.state].filter(Boolean).join(', ') || 'Location not provided'}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Reported by {selected.farmerName || 'Farmer'} · {selected.lat !== null && selected.lat !== undefined && selected.lon !== null && selected.lon !== undefined
                    ? `GPS ${Number(selected.lat).toFixed(4)}, ${Number(selected.lon).toFixed(4)}`
                    : 'GPS not provided'}
                </p>
              </div>
              <Badge className={`text-xs ${selected.status === 'new' ? 'bg-red-100 text-red-700' : selected.status === 'reviewing' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                {STATUS_LABELS[selected.status]}
              </Badge>
            </div>
            {selected.groqReport && (
              <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-sans bg-[#f0fdf4] rounded-lg p-3 max-h-48 overflow-y-auto">
                {selected.groqReport}
              </pre>
            )}
            <button onClick={() => setSelected(null)} className="text-xs text-gray-400 mt-3 hover:text-gray-600">Close</button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
