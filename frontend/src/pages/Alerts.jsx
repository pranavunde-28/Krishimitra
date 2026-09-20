import { useState, useEffect } from 'react'
import { collection, onSnapshot, updateDoc, doc } from 'firebase/firestore'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { db, isFirebaseConfigured } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, MapPin, Filter } from 'lucide-react'

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

  const isOfficer = user?.profile?.role === 'officer'

  useEffect(() => {
    if (authLoading) return undefined

    if (!user) {
      setError('Please sign in to view disease alerts.')
      setLoading(false)
      return undefined
    }

    if (!isFirebaseConfigured || !db) {
      setError('Firebase is not configured. Alerts cannot load yet.')
      setLoading(false)
      return undefined
    }

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

  const validMapReports = filtered.filter(r => r.lat && r.lon && r.lat !== 0)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
      <div className="mt-8 mb-6">
        <h1 className="text-2xl font-bold text-[#1B4332]">Disease Alert Map</h1>
        <p className="text-sm text-gray-500 mt-1">Real-time disease outbreak reports from farmers</p>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
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
            <div style={{ height: '480px' }}>
              {loading ? (
                <Skeleton className="h-full w-full rounded-none" />
              ) : (
                <MapContainer
                  center={[19.0748, 74.748]}
                  zoom={7}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='© OpenStreetMap contributors'
                  />
                  {validMapReports.map(r => (
                    <Marker
                      key={r.id}
                      position={[r.lat, r.lon]}
                      icon={createColoredIcon(STATUS_COLORS[r.status] || STATUS_COLORS.new)}
                      eventHandlers={{ click: () => setSelected(r) }}
                    >
                      <Popup>
                        <div className="text-sm">
                          <p className="font-semibold">{r.diseaseName}</p>
                          <p className="text-gray-500">{r.cropType} · {r.district}</p>
                          <p className="text-gray-400 text-xs mt-1">{r.createdAt?.toDate?.()?.toLocaleDateString('en-IN') || 'Unknown date'}</p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-3 max-h-[480px] overflow-y-auto pr-1">
          {loading ? (
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
                      <p className="text-xs text-gray-500 mt-0.5">{r.cropType} · {r.district || 'Unknown'}</p>
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
                <p className="text-sm text-gray-500">{selected.cropType} · {selected.district}, {selected.state}</p>
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
