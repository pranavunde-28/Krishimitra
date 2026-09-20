import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import LoginModal from '@/components/LoginModal'
import { TrendingUp, Sprout, Bug, CloudSun, Bell, Users, BookOpen, User, Lock, Mic } from 'lucide-react'

const features = [
  { icon: TrendingUp, title: 'Crop Prices', desc: 'Real-time mandi prices from 3000+ markets across India', to: '/prices', color: 'text-[#E76F00]', bg: 'bg-[#FFF3E0]', preview: "See today's onion price in Lasalgaon, wheat in Kopargaon, tomato in Pune — updated daily from Agmarknet." },
  { icon: Sprout, title: 'Crop Advisor', desc: 'AI crop recommendations based on your soil & season', to: '/crop-advisor', color: 'text-[#2D6A4F]', bg: 'bg-[#D8F3DC]', preview: 'Tell us your soil type and district — our AI suggests the top 5 crops with expected yield and market outlook.' },
  { icon: Bug, title: 'Disease Detect', desc: 'Upload a photo and get instant AI diagnosis', to: '/disease-detect', color: 'text-[#C62828]', bg: 'bg-[#FFEBEE]', preview: 'Take a photo of your crop. Our AI identifies the disease, severity, and gives organic + chemical remedies.' },
  { icon: CloudSun, title: 'Weather', desc: 'Hyperlocal 7-day forecast with farming calendar', to: '/weather', color: 'text-[#1565C0]', bg: 'bg-[#E3F2FD]', preview: '7-day rainfall forecast for your exact location with AI-generated farming activity suggestions per day.' },
  { icon: Bell, title: 'Disease Alerts', desc: 'Community map of disease outbreaks near you', to: '/alerts', color: 'text-[#E76F00]', bg: 'bg-[#FFF3E0]', preview: 'See a live map of disease outbreaks reported by farmers in your district. Report and alert authorities.' },
  { icon: Users, title: 'Community', desc: 'Discuss farming tips, prices and schemes', to: '/community', color: 'text-[#2D6A4F]', bg: 'bg-[#D8F3DC]', preview: 'Ask questions, share tips, discuss market prices with farmers from across Maharashtra.' },
  { icon: BookOpen, title: 'Govt Schemes', desc: 'PM-KISAN, Fasal Bima, Soil Health Card and more', to: '/schemes', color: 'text-[#1565C0]', bg: 'bg-[#E3F2FD]', preview: 'Browse 8+ central and state schemes. Check eligibility, benefits and apply directly from the app.' },
  { icon: User, title: 'My Farm', desc: 'Your farm profile, reports and price alerts', to: '/profile', color: 'text-[#C62828]', bg: 'bg-[#FFEBEE]', preview: 'Save your farm details, track disease reports you submitted, and set price alerts for your crops.' },
  { icon: Mic, title: 'Voice Assistant', desc: 'Ask farming questions by voice in Hindi, Marathi or English', to: '/voice-assistant', color: 'text-[#2D6A4F]', bg: 'bg-[#D8F3DC]', preview: 'Speak your question and get instant AI answers with internet search. Works in Hindi, Marathi and English.' },
]

const stats = [
  { value: '3000+', label: 'Mandis Tracked' },
  { value: '50+', label: 'Crops Covered' },
  { value: 'Real-time', label: 'Data Updates' },
  { value: 'Free', label: 'Always Free' },
]

function FeatureCard({ feature, onLoginClick }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)
  const handleClick = () => user ? navigate(feature.to) : onLoginClick()

  return (
    <div className="relative cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[#2D6A4F] hover:shadow-xl" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onClick={handleClick}>
      <div className={`transition-all duration-200 ${hovered ? 'translate-y-1 opacity-0' : 'translate-y-0 opacity-100'}`}>
        <div className={`mb-4 flex h-9 w-9 items-center justify-center rounded-lg ${feature.bg}`}><feature.icon className={`h-4 w-4 ${feature.color}`} /></div>
        <h3 className="mb-1 text-sm font-semibold text-[#111827]">{feature.title}</h3><p className="text-xs leading-relaxed text-gray-400">{feature.desc}</p>
      </div>
      <div className={`absolute inset-0 flex flex-col justify-between p-5 transition-all duration-200 ${hovered ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`} style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #fff 100%)' }}>
        <div><div className="mb-2 flex items-center gap-2"><feature.icon className={`h-4 w-4 ${feature.color}`} /><span className="text-xs font-semibold text-[#1B4332]">{feature.title}</span></div><p className="text-xs leading-relaxed text-gray-600">{feature.preview}</p></div>
        <div className="mt-3 flex items-center gap-1.5">{user ? <span className="text-xs font-medium text-[#2D6A4F]">Open →</span> : <><Lock className="h-3 w-3 text-gray-400" /><span className="text-xs text-gray-400">Sign in to access</span></>}</div>
      </div>
    </div>
  )
}

export default function Home() {
  const [loginOpen, setLoginOpen] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-transparent">
      <section className="mx-auto max-w-7xl rounded-2xl bg-cover bg-center bg-no-repeat px-4 pb-14 pt-28 sm:px-6 lg:px-8 lg:pt-32" style={{ backgroundImage: "linear-gradient(90deg, rgba(255,255,255,.96) 0%, rgba(255,255,255,.82) 48%, rgba(255,255,255,.18) 100%), url('https://images.unsplash.com/photo-1500595046743-cd271d694d30?auto=format&fit=crop&w=1800&q=85')" }}>
        <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="max-w-2xl"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#DDE7DF] bg-white/90 px-4 py-2 shadow-sm"><span className="h-2.5 w-2.5 rounded-full bg-[#22C55E]" /><span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#166534]">कृषि मित्र · Your Farming Companion</span></div><h1 className="text-4xl font-black text-[#17211B] sm:text-5xl lg:text-6xl">Smart Farming<span className="mt-2 block bg-gradient-to-r from-[#166534] via-[#22C55E] to-[#166534] bg-clip-text text-transparent">Starts Here</span></h1><p className="mt-5 max-w-xl text-base leading-7 text-[#4F6058] sm:text-lg">Real-time mandi prices, AI-powered crop advice, instant disease detection, and weather forecasts — all in one place, built for Indian farmers.</p><div className="mt-8 flex flex-wrap gap-3">{user ? <><Button size="lg" onClick={() => navigate('/prices')} className="rounded-full bg-[#166534] px-6 text-base font-semibold text-white">View Mandi Prices</Button><Button size="lg" variant="outline" onClick={() => navigate('/crop-advisor')} className="rounded-full border-[#DDE7DF] bg-white px-6 text-base font-semibold text-[#166534]">Get Crop Advice</Button></> : <><Button size="lg" onClick={() => setLoginOpen(true)} className="rounded-full bg-[#166534] px-6 text-base font-semibold text-white">Get Started — Free Forever</Button><Button size="lg" variant="outline" onClick={() => setLoginOpen(true)} className="rounded-full border-[#DDE7DF] bg-white px-6 text-base font-semibold text-[#166534]">Sign In</Button></>}</div></div>
          <div className="grid grid-cols-2 gap-4">{stats.map((s) => <div key={s.label} className="rounded-3xl border border-[#DDE7DF] bg-white/90 p-5 shadow-[0_18px_45px_rgba(23,33,27,0.06)]"><div className="mb-2 text-3xl font-black text-[#166534]">{s.value}</div><div className="text-sm font-medium text-[#5A6C62]">{s.label}</div></div>)}</div>
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="h-px bg-[#DDE7DF]" /></div>
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"><div className="mb-10 text-center"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#166534]">Everything you need</p><h2 className="mt-3 text-3xl font-black text-[#17211B] sm:text-4xl">Farm smarter every day</h2></div>{!user && <div className="mb-8 flex items-center justify-center gap-2 text-sm text-[#4F6058]"><Lock className="h-4 w-4 text-[#166534]" /><span>Sign in to unlock all features</span></div>}<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{features.map(f => <FeatureCard key={f.to} feature={f} onLoginClick={() => setLoginOpen(true)} />)}</div></section>
      <section className="border-t border-[#DDE7DF] bg-white/60"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-7 text-sm sm:px-6 lg:px-8"><div className="flex items-center gap-2 text-[#4F6058]"><span className="h-2.5 w-2.5 rounded-full bg-[#22C55E]" /><span>Data from <span className="font-semibold text-[#17211B]">Agmarknet · Ministry of Agriculture</span></span></div><div className="flex items-center gap-2 text-[#4F6058]"><span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" /><span>AI powered by <span className="font-semibold text-[#17211B]">Groq · Llama 4</span></span></div></div></section>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  )
}