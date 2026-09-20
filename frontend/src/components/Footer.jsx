import { Link } from 'react-router-dom'
import { Leaf } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-[#1D6046] bg-[#073B2A] text-[#DDEFE4]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#16834F] shadow-lg shadow-black/20">
              <Leaf className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="text-xl font-black tracking-tight text-white">KrishiMitra</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9FD0B3]">Farm intelligence</div>
            </div>
          </div>
          <p className="max-w-xs text-sm leading-6 text-[#C5DFCF]">Smart farming starts here with practical guidance, live market data, and trusted tools for Indian farmers.</p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#2B765A] bg-[#0B513A] px-3 py-1.5 text-xs font-semibold text-[#B9DEC8]">
            <span className="h-2 w-2 rounded-full bg-[#54D17E]" /> Helping farmers grow better
          </div>
        </div>

        <div>
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-white">Explore</p>
          <div className="flex flex-col gap-3 text-sm text-[#B9D8C6]">
            <Link to="/prices" className="hover:text-white">Crop Prices</Link>
            <Link to="/crop-advisor" className="hover:text-white">Crop Advisor</Link>
            <Link to="/disease-detect" className="hover:text-white">Disease Detect</Link>
            <Link to="/schemes" className="hover:text-white">Government Schemes</Link>
          </div>
        </div>

        <div>
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-white">Useful Resources</p>
          <div className="flex flex-col gap-3 text-sm text-[#B9D8C6]">
            <a href="https://soilhealth.dac.gov.in" target="_blank" rel="noreferrer" className="hover:text-white">Soil Health Card</a>
            <a href="https://enam.gov.in" target="_blank" rel="noreferrer" className="hover:text-white">eNAM Portal</a>
            <a href="https://pmkisan.gov.in" target="_blank" rel="noreferrer" className="hover:text-white">PM-KISAN</a>
          </div>
        </div>
      </div>

      <div className="border-t border-[#1D6046] bg-[#052F22] py-4 text-center text-xs text-[#9FC5AF]">
        © 2026 KrishiMitra · Smart tools for a healthier harvest
      </div>
    </footer>
  )
}