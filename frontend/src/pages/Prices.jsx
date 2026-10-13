import { useState, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { getPrices, postGroq, refreshPrices } from '@/lib/api'
import { formatPrice } from '@/lib/utils'
import { RefreshCw, Download, TrendingUp } from 'lucide-react'

const STATES = [
  'Andhra Pradesh', 'Bihar', 'Gujarat', 'Haryana', 'Karnataka',
  'Madhya Pradesh', 'Maharashtra', 'Punjab', 'Rajasthan',
  'Telangana', 'Uttar Pradesh', 'West Bengal'
]

const MH_DISTRICTS = [
  'Ahmednagar', 'Akola', 'Amravati', 'Aurangabad', 'Beed', 'Bhandara', 'Buldhana', 'Chandrapur',
  'Dhule', 'Gadchiroli', 'Gondia', 'Hingoli', 'Jalgaon', 'Jalna', 'Kolhapur', 'Latur',
  'Mumbai City', 'Mumbai Suburban', 'Nagpur', 'Nanded', 'Nandurbar', 'Nashik', 'Osmanabad',
  'Palghar', 'Parbhani', 'Pune', 'Raigad', 'Ratnagiri', 'Sangli', 'Satara', 'Sindhudurg',
  'Solapur', 'Thane', 'Wardha', 'Washim', 'Yavatmal'
]

export default function Prices() {
  const queryClient = useQueryClient()
  const [state, setState] = useState('Maharashtra')
  const [district, setDistrict] = useState('All Districts')
  const [market, setMarket] = useState('All Markets')
  const [commodity, setCommodity] = useState('All Commodities')
  const [groqInsight, setGroqInsight] = useState('')
  const [insightLoading, setInsightLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // fetch all records for selected state (no district/commodity filter — filter client side)
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['prices', state],
    queryFn: async () => {
      const r = await getPrices({ state })
      return r.data
    },
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on component mount if data exists
  })

  const allRecords = useMemo(() => {
    const all = Array.isArray(data?.records) ? data.records : []
    return all.filter(r => !r.state || r.state === state)
  }, [data, state])

  // build dynamic district and commodity lists from actual data
  const districts = useMemo(() => {
    if (state === 'Maharashtra') {
      // Use full list for Maharashtra, merge with API data
      const apiDistricts = new Set(allRecords.filter(r => r.state === state).map(r => r.district).filter(Boolean))
      const merged = new Set([...MH_DISTRICTS, ...Array.from(apiDistricts)])
      return ['All Districts', ...Array.from(merged).sort((a, b) => a.localeCompare(b))]
    }
    // For other states, use API data only
    const set = new Set(allRecords.filter(r => r.state === state).map(r => r.district).filter(Boolean))
    return ['All Districts', ...Array.from(set).sort((a, b) => a.localeCompare(b))]
  }, [allRecords, state])

  const markets = useMemo(() => {
    const filtered = allRecords.filter(r => {
      if (district && district !== 'All Districts' && r.district !== district) return false
      return true
    })
    const set = new Set(filtered.map(r => r.market).filter(Boolean))
    return ['All Markets', ...Array.from(set).sort((a, b) => a.localeCompare(b))]
  }, [allRecords, district])

  const commodities = useMemo(() => {
    const filtered = allRecords.filter(r => {
      if (district && district !== 'All Districts' && r.district !== district) return false
      if (market && market !== 'All Markets' && r.market !== market) return false
      return true
    })
    const set = new Set(filtered.map(r => r.commodity).filter(Boolean))
    return ['All Commodities', ...Array.from(set).sort((a, b) => a.localeCompare(b))]
  }, [allRecords, district, market])

  // reset district/commodity when state changes
  useEffect(() => {
    setDistrict('All Districts')
    setMarket('All Markets')
    setCommodity('All Commodities')
  }, [state])

  // reset market and commodity when district changes
  useEffect(() => {
    setMarket('All Markets')
    setCommodity('All Commodities')
  }, [district])

  const handleForceRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refreshPrices(state)
    } catch {
      // Refresh the visible query even if the cache-refresh request fails.
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['prices'] })
      setIsRefreshing(false)
    }
  }

  // client-side filtering
  const records = useMemo(() => {
    return allRecords.filter(r => {
      if (district && district !== 'All Districts' && r.district !== district) return false
      if (market && market !== 'All Markets' && r.market !== market) return false
      if (commodity && commodity !== 'All Commodities' && r.commodity !== commodity) return false
      return true
    })
  }, [allRecords, district, market, commodity])

  // Groq insight
  useEffect(() => {
    if (!records.length) {
      setGroqInsight('')
      setInsightLoading(false)
      return
    }
    let cancelled = false
    const fetchInsight = async () => {
      setInsightLoading(true)
      try {
        const summary = records.slice(0, 10).map(r =>
          `${r.commodity} at ${r.market}: ₹${r.modal_price}/quintal`
        ).join(', ')
        const { data: res } = await postGroq({
          messages: [{ role: 'user', content: `Given these mandi prices in ${state}${district && district !== 'All Districts' ? ', ' + district : ''}: ${summary}. Write a 2-sentence insight for a farmer about current price trends and whether it's a good time to sell. Be specific and practical.` }],
        })
        if (!cancelled) setGroqInsight(res.text)
      } catch {
        if (!cancelled) setGroqInsight('')
      } finally {
        if (!cancelled) setInsightLoading(false)
      }
    }
    fetchInsight()
    return () => { cancelled = true }
  }, [records, state, district])

  // chart data
  const chartData = useMemo(() => {
    return records.reduce((acc, r) => {
      const existing = acc.find(x => x.commodity === r.commodity)
      if (!existing) acc.push({ commodity: r.commodity, price: Number(r.modal_price) })
      return acc
    }, []).slice(0, 8)
  }, [records])

  const exportCSV = () => {
    const header = 'Commodity,Market,District,Min Price,Max Price,Modal Price,Date\n'
    const rows = records.map(r =>
      `${r.commodity},${r.market},${r.district},${r.min_price},${r.max_price},${r.modal_price},${r.arrival_date}`
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `krishimitra-prices-${state}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] bg-clip-text text-transparent">Crop Prices Dashboard</h1>
          <p className="text-sm text-gray-600 mt-2 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${data?.source === 'live' ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`}></span>
            {isLoading ? 'Loading mandi prices...' : isError ? 'Prices unavailable' : data?.source === 'live' ? 'Live mandi prices' : 'Sample mandi prices'} · {isLoading ? '...' : `${records.length} records`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleForceRefresh} disabled={isRefreshing}
            className="border-[#C62828] text-[#C62828] hover:bg-red-50 transition-all hover:scale-105">
            <RefreshCw className={`w-4 h-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Force Refresh'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="border-[#2D6A4F] text-[#2D6A4F] hover:bg-green-50 transition-all hover:scale-105">
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} className="border-[#2D6A4F] text-[#2D6A4F] hover:bg-green-50 transition-all hover:scale-105">
            <Download className="w-4 h-4 mr-1" /> Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="rounded-xl shadow-md border-2 border-gray-100 mb-6 hover:shadow-lg transition-shadow">
        <CardContent className="p-5 flex flex-wrap gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-600 font-semibold">State</label>
            <select value={state} onChange={e => setState(e.target.value)}
              className="border-2 border-gray-300 rounded-lg px-4 py-2 text-sm focus:border-[#2D6A4F] focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 transition-all">
              {STATES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-600 font-semibold">District</label>
            <select value={district} onChange={e => setDistrict(e.target.value)}
              className="border-2 border-gray-300 rounded-lg px-4 py-2 text-sm focus:border-[#2D6A4F] focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 transition-all min-w-[160px]">
              {isLoading ? <option>Loading...</option> : districts.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-600 font-semibold">Market</label>
            <select value={market} onChange={e => {
              setMarket(e.target.value)
              setCommodity('All Commodities')
            }}
              className="border-2 border-gray-300 rounded-lg px-4 py-2 text-sm focus:border-[#2D6A4F] focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 transition-all min-w-[160px]">
              {isLoading ? <option>Loading...</option> : markets.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-600 font-semibold">Commodity</label>
            <select value={commodity} onChange={e => setCommodity(e.target.value)}
              className="border-2 border-gray-300 rounded-lg px-4 py-2 text-sm focus:border-[#2D6A4F] focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/20 transition-all min-w-[160px]">
              {isLoading ? <option>Loading...</option> : commodities.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Price Table */}
        <div className="lg:col-span-2">
          <Card className="rounded-xl shadow-md border-2 border-gray-100 hover:shadow-lg transition-shadow">
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gradient-to-r from-[#f0fdf4] to-[#D8F3DC] text-[#1B4332] sticky top-0 shadow-sm">
                    <tr>
                      <th className="text-left px-4 py-4 font-bold">Commodity</th>
                      <th className="text-left px-4 py-4 font-bold hidden sm:table-cell">Market</th>
                      <th className="text-left px-4 py-4 font-bold hidden md:table-cell">District</th>
                      <th className="text-left px-4 py-4 font-bold hidden lg:table-cell">Grade</th>
                      <th className="text-left px-4 py-4 font-bold hidden lg:table-cell">Variety</th>
                      <th className="text-right px-4 py-4 font-bold">Min</th>
                      <th className="text-right px-4 py-4 font-bold">Max</th>
                      <th className="text-right px-4 py-4 font-bold text-[#E76F00]">Modal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      Array(6).fill(0).map((_, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          {Array(8).fill(0).map((_, j) => (
                            <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                          ))}
                        </tr>
                      ))
                    ) : isError ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                        Failed to load prices.
                        <button onClick={() => refetch()} className="ml-2 text-[#2D6A4F] underline">Retry</button>
                      </td></tr>
                    ) : records.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No records found for selected filters.</td></tr>
                    ) : (
                      records.map((r, i) => (
                        <tr key={i} className="border-t border-gray-100 hover:bg-gradient-to-r hover:from-[#f0fdf4] hover:to-white transition-all">
                          <td className="px-4 py-4 font-semibold text-[#111827]">{r.commodity}</td>
                          <td className="px-4 py-4 text-gray-600 hidden sm:table-cell text-sm">{r.market}</td>
                          <td className="px-4 py-4 text-gray-500 hidden md:table-cell text-sm">{r.district}</td>
                          <td className="px-4 py-4 hidden lg:table-cell">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                              r.grade === 'FAQ' ? 'bg-green-100 text-green-700' :
                              r.grade === 'Non-FAQ' ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {r.grade || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-gray-500 text-xs hidden lg:table-cell">{r.variety || '—'}</td>
                          <td className="px-4 py-4 text-right text-gray-600 font-medium">{formatPrice(r.min_price)}</td>
                          <td className="px-4 py-4 text-right text-gray-600 font-medium">{formatPrice(r.max_price)}</td>
                          <td className="px-4 py-4 text-right font-bold text-[#E76F00] text-base">{formatPrice(r.modal_price)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5">
          <Card className="rounded-xl shadow-md border-2 border-gray-100 hover:shadow-lg transition-shadow">
            <CardContent className="p-5">
              <p className="text-sm font-bold text-[#1B4332] mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Modal Price by Commodity (₹/quintal)
              </p>
              {isLoading ? <Skeleton className="h-40 w-full" /> : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="commodity" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => [`₹${v}`, 'Modal Price']} />
                    <Bar dataKey="price" fill="#2D6A4F" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-md border-2 border-gradient-to-r from-[#2D6A4F] to-[#52B788] bg-gradient-to-br from-[#f0fdf4] to-white hover:shadow-lg transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2D6A4F] to-[#52B788] flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <p className="text-sm font-bold text-[#1B4332]">AI Price Insight</p>
                <Badge className="bg-gradient-to-r from-[#D8F3DC] to-[#f0fdf4] text-[#2D6A4F] text-xs border border-[#2D6A4F]/20">Groq AI</Badge>
              </div>
              {insightLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-3 w-3/5" />
                </div>
              ) : groqInsight ? (
                <p className="text-sm text-gray-700 leading-relaxed">{groqInsight}</p>
              ) : (
                <p className="text-sm text-gray-400">Insight will appear after prices load.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
