import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useLocation } from '@/hooks/useLocation'
import { useWeather } from '@/hooks/useWeather'
import { postGroq } from '@/lib/api'
import { CloudSun, Droplets, Wind, Thermometer, AlertTriangle, CalendarDays, Download } from 'lucide-react'
import jsPDF from 'jspdf'

const WMO_CODES = {
  0: { label: 'Clear', icon: '☀️' },
  1: { label: 'Mainly Clear', icon: '🌤️' },
  2: { label: 'Partly Cloudy', icon: '⛅' },
  3: { label: 'Overcast', icon: '☁️' },
  45: { label: 'Foggy', icon: '🌫️' },
  51: { label: 'Drizzle', icon: '🌦️' },
  61: { label: 'Rain', icon: '🌧️' },
  63: { label: 'Moderate Rain', icon: '🌧️' },
  65: { label: 'Heavy Rain', icon: '⛈️' },
  80: { label: 'Showers', icon: '🌦️' },
  95: { label: 'Thunderstorm', icon: '⛈️' },
}

const getWeatherInfo = (code) => WMO_CODES[code] || { label: 'Unknown', icon: '🌡️' }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function Weather() {
  const { lat, lon } = useLocation()
  // Weather can use the local default if GPS permission is denied; disease
  // reports still require verified coordinates in DiseaseDetect.
  const weatherLat = lat ?? 19.0748
  const weatherLon = lon ?? 74.748
  const { data, isLoading, isError, error } = useWeather(weatherLat, weatherLon)
  const [calendar, setCalendar] = useState('')
  const [calLoading, setCalLoading] = useState(false)

  useEffect(() => {
    if (!data?.daily) return
    const fetchCalendar = async () => {
      setCalLoading(true)
      
      // Store user's current language
      const currentLang = document.documentElement.lang || 'en'
      
      // Switch to English before fetching
      if (currentLang !== 'en') {
        const select = document.querySelector('.goog-te-combo')
        if (select) {
          select.value = 'en'
          select.dispatchEvent(new Event('change'))
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
      
      try {
        const summary = data.daily.time.map((date, i) => {
          const info = getWeatherInfo(data.daily.weathercode[i])
          return `${date}: ${info.label}, max ${data.daily.temperature_2m_max[i]}°C, rain ${data.daily.precipitation_sum[i]}mm`
        }).join('; ')
        const { data: res } = await postGroq({
          messages: [{ role: 'user', content: `Given this 7-day weather forecast for a farmer in Maharashtra: ${summary}. Generate a day-by-day farming activity calendar with 1-2 practical suggestions per day. Format as:

Day 1 (Date):
- Activity suggestion

Day 2 (Date):
- Activity suggestion

Keep each suggestion to one short sentence.` }],
        })
        setCalendar(res.text)
        
        // Wait for DOM to stabilize
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        // Switch back to user's language
        if (currentLang !== 'en') {
          const select = document.querySelector('.goog-te-combo')
          if (select) {
            select.value = currentLang
            select.dispatchEvent(new Event('change'))
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        }
      } catch {
        setCalendar('')
      } finally {
        setCalLoading(false)
      }
    }
    fetchCalendar()
  }, [data])

  const daily = data?.daily
  const hourly = data?.hourly

  // current conditions from first hourly entry
  const currentTemp = hourly?.temperature_2m?.[0]
  const currentHumidity = hourly?.relative_humidity_2m?.[0]
  const currentWind = hourly?.windspeed_10m?.[0]
  const currentUV = hourly?.uv_index?.[0]

  // rainfall chart data
  const rainfallData = daily?.time?.map((date, i) => ({
    day: DAYS[new Date(date).getDay()],
    rain: daily.precipitation_sum[i],
  })) || []

  const hasHeavyRain = daily?.precipitation_sum?.some(r => r > 30)

  const downloadCalendarPDF = () => {
    if (!calendar || !data?.daily) return

    const doc = new jsPDF()
    doc.setFont('helvetica')
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 15
    const lineHeight = 6
    let y = 20

    // Header
    doc.setFontSize(22)
    doc.setTextColor(29, 106, 79)
    doc.text('7-Day Farming Calendar', margin, y)
    y += 10

    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text(`Generated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, margin, y)
    y += 10

    // Weather Summary Box
    doc.setFillColor(240, 253, 244)
    doc.rect(margin, y, pageWidth - 2 * margin, 28, 'F')
    doc.setDrawColor(45, 106, 79)
    doc.setLineWidth(0.3)
    doc.rect(margin, y, pageWidth - 2 * margin, 28, 'S')
    
    doc.setFontSize(9)
    doc.setTextColor(60, 60, 60)
    y += 6

    doc.text('Current Weather Conditions', margin + 3, y)
    y += 5
    doc.text(`Temperature: ${currentTemp}°C  |  Humidity: ${currentHumidity}%  |  Wind: ${currentWind} km/h  |  UV Index: ${currentUV}`, margin + 3, y)
    y += 5

    const totalRain = data.daily.precipitation_sum.reduce((a, b) => a + b, 0).toFixed(1)
    doc.text(`Expected Rainfall (7 days): ${totalRain}mm`, margin + 3, y)
    y += 10

    // Divider
    doc.setDrawColor(45, 106, 79)
    doc.setLineWidth(0.5)
    doc.line(margin, y, pageWidth - margin, y)
    y += 8

    // Section Title
    doc.setFontSize(12)
    doc.setTextColor(29, 106, 79)
    doc.setFont('helvetica', 'bold')
    doc.text('Daily Farming Activities', margin, y)
    y += 8
    doc.setFont('helvetica', 'normal')

    // Calendar Content
    doc.setFontSize(9)
    doc.setTextColor(0, 0, 0)

    const sections = calendar.split('\n\n')
    sections.forEach((section) => {
      const lines = section.split('\n').filter(l => l.trim())
      if (lines.length === 0) return

      lines.forEach((line, lineIdx) => {
        if (y > pageHeight - 20) {
          doc.addPage()
          y = 20
        }

        const trimmed = line.trim()

        if (trimmed.toLowerCase().startsWith('day') || /^\d+\./.test(trimmed)) {
          if (lineIdx > 0) y += 3
          doc.setFillColor(45, 106, 79)
          doc.rect(margin, y - 4, pageWidth - 2 * margin, 8, 'F')
          doc.setTextColor(255, 255, 255)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(10)
          const cleanHeader = trimmed.replace(/^[-•]\s*/, '')
          doc.text(cleanHeader, margin + 3, y + 1)
          y += 10
          doc.setTextColor(0, 0, 0)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9)
        } else {
          const cleanLine = trimmed.replace(/^[-•]\s*/, '')
          const wrappedLines = doc.splitTextToSize(cleanLine, pageWidth - 2 * margin - 8)
          wrappedLines.forEach((wLine, wIdx) => {
            if (y > pageHeight - 20) {
              doc.addPage()
              y = 20
            }
            if (wIdx === 0) {
              doc.text('>', margin + 4, y)
            }
            doc.text(wLine, margin + 8, y)
            y += lineHeight
          })
        }
      })

      y += 2
    })

    // Weather forecast table
    if (y > pageHeight - 70) {
      doc.addPage()
      y = 20
    }

    y += 8
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(29, 106, 79)
    doc.text('7-Day Weather Forecast', margin, y)
    y += 8
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(0, 0, 0)

    // Table header
    doc.setFillColor(216, 243, 220)
    doc.rect(margin, y - 4, pageWidth - 2 * margin, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.text('Date', margin + 2, y)
    doc.text('Condition', margin + 35, y)
    doc.text('Temperature', margin + 75, y)
    doc.text('Rain (mm)', margin + 115, y)
    y += 7
    doc.setFont('helvetica', 'normal')

    // Table rows
    data.daily.time.forEach((date, i) => {
      if (y > pageHeight - 20) {
        doc.addPage()
        y = 20
      }

      const info = getWeatherInfo(data.daily.weathercode[i])
      const dayName = DAYS[new Date(date).getDay()]
      const dateStr = new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })

      if (i % 2 === 0) {
        doc.setFillColor(250, 250, 250)
        doc.rect(margin, y - 4, pageWidth - 2 * margin, 6, 'F')
      }

      doc.text(`${dayName}, ${dateStr}`, margin + 2, y)
      doc.text(info.label, margin + 35, y)
      doc.text(`${data.daily.temperature_2m_max[i]}°C / ${data.daily.temperature_2m_min[i]}°C`, margin + 75, y)
      doc.text(`${data.daily.precipitation_sum[i]}`, margin + 115, y)
      y += 6
    })

    // Footer
    const totalPages = doc.internal.pages.length - 1
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text('KrishiMitra - Your Farming Companion', margin, pageHeight - 10)
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 20, pageHeight - 10)
    }

    doc.save(`KrishiMitra_Farming_Calendar_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  if (isLoading) return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
      <div className="mt-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  )

  if (isError) return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
      <div className="mt-8 text-center text-gray-500">
        Failed to load weather data: {error?.message || 'Check that the backend is running and VITE_BACKEND_URL points to it.'}
      </div>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
      <div className="mt-8 mb-6">
        <h1 className="text-2xl font-bold text-[#1B4332]">Weather & Farm Calendar</h1>
        <p className="text-sm text-gray-500 mt-1">
          {lat === null || lon === null ? 'Local forecast for Kopargaon (location permission unavailable)' : 'Hyperlocal forecast for your location'} · Open-Meteo
        </p>
      </div>

      {/* Heavy rain alert */}
      {hasHeavyRain && (
        <div className="bg-[#FFEBEE] border border-[#C62828] text-[#C62828] rounded-xl px-4 py-3 flex items-center gap-2 mb-6">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">Heavy rainfall (&gt;30mm) expected in the next 7 days. Avoid spraying pesticides and plan irrigation accordingly.</span>
        </div>
      )}

      {/* Current conditions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { icon: Thermometer, label: 'Temperature', value: `${currentTemp}°C`, color: 'text-[#E76F00]', bg: 'bg-[#FFF3E0]' },
          { icon: Droplets, label: 'Humidity', value: `${currentHumidity}%`, color: 'text-[#1565C0]', bg: 'bg-[#E3F2FD]' },
          { icon: Wind, label: 'Wind Speed', value: `${currentWind} km/h`, color: 'text-[#2D6A4F]', bg: 'bg-[#D8F3DC]' },
          { icon: CloudSun, label: 'UV Index', value: currentUV, color: 'text-[#C62828]', bg: 'bg-[#FFEBEE]' },
        ].map((item) => (
          <Card key={item.label} className="rounded-xl shadow-sm border border-gray-100">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${item.bg} flex items-center justify-center shrink-0`}>
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <div>
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="text-lg font-bold text-[#111827]">{item.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 7-day forecast strip */}
      <Card className="rounded-xl shadow-sm border border-gray-100 mb-6">
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-[#1B4332] mb-4">7-Day Forecast</p>
          <div className="grid grid-cols-7 gap-2">
            {daily?.time?.map((date, i) => {
              const info = getWeatherInfo(daily.weathercode[i])
              return (
                <div key={date} className="flex flex-col items-center gap-1 text-center">
                  <span className="text-xs text-gray-500">{DAYS[new Date(date).getDay()]}</span>
                  <span className="text-2xl">{info.icon}</span>
                  <span className="text-xs font-semibold text-[#111827]">{daily.temperature_2m_max[i]}°</span>
                  <span className="text-xs text-gray-400">{daily.temperature_2m_min[i]}°</span>
                  <span className="text-xs text-[#1565C0]">{daily.precipitation_sum[i]}mm</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rainfall chart */}
        <Card className="rounded-xl shadow-sm border border-gray-100">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-[#1B4332] mb-3">Rainfall Forecast (mm)</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={rainfallData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}mm`, 'Rainfall']} />
                <Bar dataKey="rain" fill="#1565C0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Groq farming calendar */}
        <Card className="rounded-xl shadow-sm border border-gray-100 bg-[#f0fdf4]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-[#2D6A4F]" />
                <p className="text-sm font-semibold text-[#1B4332]">AI Farming Calendar</p>
                <Badge className="bg-[#D8F3DC] text-[#2D6A4F] text-xs">Groq AI</Badge>
              </div>
              {!calLoading && calendar && (
                <Button onClick={downloadCalendarPDF} size="sm" className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white">
                  <Download className="w-3.5 h-3.5 mr-1" /> PDF
                </Button>
              )}
            </div>
            {calLoading ? (
              <div className="space-y-2">
                {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-3 w-full" />)}
              </div>
            ) : calendar ? (
              <div className="space-y-2">
                {calendar.split('\n\n').map((section, idx) => {
                  const lines = section.split('\n').filter(l => l.trim())
                  if (lines.length === 0) return null
                  
                  return (
                    <div key={idx} className="border-l-2 border-[#2D6A4F] pl-3 py-1">
                      {lines.map((line, lineIdx) => {
                        const trimmed = line.trim()
                        // Day headers
                        if (trimmed.toLowerCase().startsWith('day') || /^\d+\./.test(trimmed)) {
                          return (
                            <p key={lineIdx} className="font-semibold text-[#1B4332] text-sm mb-1">
                              {trimmed.replace(/^[-•]\s*/, '')}
                            </p>
                          )
                        }
                        // Activities (bullet points or regular text)
                        return (
                          <p key={lineIdx} className="text-sm text-gray-700 leading-relaxed">
                            {trimmed.replace(/^[-•]\s*/, '• ')}
                          </p>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Calendar will appear after weather loads.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
