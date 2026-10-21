import { useState, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { postDisease, postGroq } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useLocation } from '@/hooks/useLocation'
import { Upload, Camera, Bug, AlertTriangle, CheckCircle, Loader2, FileDown, Volume2, VolumeX } from 'lucide-react'
import jsPDF from 'jspdf'

const CROP_TYPES = ['Select crop (optional)', 'Tomato', 'Potato', 'Wheat', 'Rice', 'Cotton', 'Maize', 'Soybean', 'Sugarcane', 'Other']

const SEVERITY_COLORS = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-orange-100 text-orange-700',
  high: 'bg-red-100 text-red-700',
}

function formatInlineReport(text) {
  return text.split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`)/g).filter(Boolean).map((part, index) => {
    if (/^(\*\*|__)/.test(part)) return <strong key={index}>{part.slice(2, -2)}</strong>
    if (/^(\*|_)/.test(part)) return <em key={index}>{part.slice(1, -1)}</em>
    if (part.startsWith('`')) return <code key={index} className="rounded bg-black/5 px-1">{part.slice(1, -1)}</code>
    return part
  })
}

function parseVisionDetection(raw) {
  const text = String(raw || '').trim()
  const parsed = { diseaseName: '', confidence: null, symptoms: [], actions: [], notes: '' }

  try {
    const jsonText = text.match(/\{[\s\S]*\}/)?.[0]
    if (jsonText) {
      const data = JSON.parse(jsonText)
      parsed.diseaseName = data.disease_name || data.diseaseName || data.diagnosis || ''
      const confidence = data.confidence_percent ?? data.confidence
      const numericConfidence = Number(String(confidence ?? '').match(/\d+(?:\.\d+)?/)?.[0])
      parsed.confidence = Number.isFinite(numericConfidence) ? Math.max(0, Math.min(100, Math.round(numericConfidence))) : null
      const toList = value => (Array.isArray(value) ? value : String(value || '').split(/\n|;/))
        .map(item => String(item).replace(/^\s*[-*+•\d.)]+\s*/, '').trim())
        .filter(Boolean)
      parsed.symptoms = toList(data.visible_symptoms || data.symptoms)
      parsed.actions = toList(data.immediate_actions || data.actions)
      if (!parsed.diseaseName) parsed.diseaseName = 'Unable to identify reliably'
      return parsed
    }
  } catch {
    // Continue with the labelled-text parser for non-JSON model responses.
  }

  let currentSection = ''
  const labels = [
    ['diseaseName', /^(?:disease(?: name)?|diagnosis|result)\s*:\s*(.*)$/i],
    ['confidence', /^confidence(?: level| score)?\s*:\s*(.*)$/i],
    ['symptoms', /^(?:(?:visible )?symptoms|symptoms observed)\s*:\s*(.*)$/i],
    ['actions', /^(?:(?:immediate|recommended) )?(?:(?:treatment|next) )?(?:actions|steps)(?:\s*\([^)]*\))?\s*:\s*(.*)$/i],
  ]
  const extraLines = []

  text.split(/\r?\n/).forEach(line => {
    const cleanLine = line.trim().replace(/^#{1,6}\s*/, '').replace(/\*\*/g, '').replace(/^\*\s*/, '')
    const field = labels.find(([, pattern]) => pattern.test(cleanLine))
    if (field) {
      currentSection = field[0]
      const value = cleanLine.match(field[1])?.[1]?.trim() || ''
      if (currentSection === 'diseaseName') parsed.diseaseName = value
      if (currentSection === 'confidence') {
        const number = value.match(/\d+(?:\.\d+)?/)?.[0]
        parsed.confidence = number ? Math.max(0, Math.min(100, Math.round(Number(number)))) : null
      }
      if (currentSection === 'symptoms' && value) parsed.symptoms.push(value.replace(/^[-*+•]\s*/, ''))
      if (currentSection === 'actions' && value) parsed.actions.push(value.replace(/^[-*+•]\s*/, ''))
      return
    }

    const value = cleanLine.replace(/^[-*+•\d.)]+\s*/, '').trim()
    if (!value) return
    if (currentSection === 'symptoms') parsed.symptoms.push(value)
    else if (currentSection === 'actions') parsed.actions.push(value)
    else extraLines.push(value)
  })

  if (!parsed.diseaseName) parsed.diseaseName = 'Unable to identify reliably'
  if (extraLines.length) parsed.notes = extraLines.join(' ')
  return parsed
}

const DISEASE_REPORT_SECTIONS = [
  { title: 'What is this disease', aliases: ['what is this disease', 'disease overview', 'diagnosis'] },
  { title: 'How it spreads', aliases: ['how it spreads', 'spread', 'transmission'] },
  { title: 'Immediate actions', aliases: ['immediate actions', 'immediate steps', 'what to do now'] },
  { title: 'Organic remedy', aliases: ['organic remedy', 'organic treatment'] },
  { title: 'Chemical remedy', aliases: ['chemical remedy', 'chemical treatment'] },
  { title: 'Prevention tips', aliases: ['prevention tips', 'prevention', 'how to prevent'] },
]

function normalizeDiseaseReport(raw, diseaseName) {
  const sections = Object.fromEntries(DISEASE_REPORT_SECTIONS.map(({ title }) => [title, []]))
  let currentTitle = ''
  const unsectioned = []
  const lines = String(raw || '').replace(/\r/g, '').split('\n')

  lines.forEach(line => {
    const cleaned = line.trim()
      .replace(/^#{1,6}\s*/, '')
      .replace(/^\d+[.)]\s*/, '')
      .replace(/\*\*|__/g, '')
      .replace(/^\*+|\*+$/g, '')
      .trim()
    const match = DISEASE_REPORT_SECTIONS.flatMap(section => section.aliases.map(alias => ({ ...section, alias })))
      .map(section => ({ section, match: cleaned.match(new RegExp(`^${section.alias}(?:\\s*\\([^)]*\\))?\\s*:?\\s*(.*)$`, 'i')) }))
      .find(item => item.match)

    if (match) {
      currentTitle = match.section.title
      const remainder = match.match[1]?.trim()
      if (remainder) sections[currentTitle].push(remainder)
    } else if (cleaned) {
      if (currentTitle) sections[currentTitle].push(line.trim())
      else unsectioned.push(line.trim())
    }
  })

  if (unsectioned.length && !Object.values(sections).some(linesInSection => linesInSection.length)) {
    sections['What is this disease'].push(...unsectioned)
  }

  const defaults = {
    'What is this disease': `The image-based result is ${diseaseName || 'uncertain'}. Image analysis can be uncertain; confirm with a local agriculture officer.`,
    'How it spreads': 'Spread depends on the confirmed disease. Keep affected plants separate where practical and clean tools after use.',
    'Immediate actions': 'Inspect nearby plants, remove severely affected material where appropriate, and seek local agricultural advice before treatment.',
    'Organic remedy': 'Use an organic treatment only if it is approved for this crop and confirmed problem; follow its label.',
    'Chemical remedy': 'No specific chemical is recommended from an image alone. Confirm the problem and use only a locally approved product exactly as labeled.',
    'Prevention tips': 'Use healthy planting material, keep tools clean, monitor the crop regularly, and follow crop-specific local guidance.',
  }

  return DISEASE_REPORT_SECTIONS.map(({ title }) => `${title}:\n${sections[title].length ? sections[title].join('\n') : defaults[title]}`).join('\n\n')
}

function FormattedDiseaseReport({ text }) {
  const lines = String(text || '').replace(/\r/g, '').split('\n')
  const blocks = []
  let paragraph = []
  let listItems = []
  let listType = ''

  const flushParagraph = () => {
    if (!paragraph.length) return
    blocks.push(<p key={`p-${blocks.length}`}>{formatInlineReport(paragraph.join(' '))}</p>)
    paragraph = []
  }

  const flushList = () => {
    if (!listItems.length) return
    const List = listType === 'ordered' ? 'ol' : 'ul'
    blocks.push(
      <List key={`list-${blocks.length}`} className={`${listType === 'ordered' ? 'list-decimal' : 'list-disc'} space-y-1 pl-5`}>
        {listItems.map((item, index) => <li key={index}>{formatInlineReport(item)}</li>)}
      </List>
    )
    listItems = []
    listType = ''
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    const heading = trimmed.match(/^#{1,3}\s+(.+)$/)
    const normalizedHeading = trimmed
      .replace(/^#{1,6}\s*/, '')
      .replace(/^\d+[.)]\s*/, '')
      .replace(/\*\*|__/g, '')
      .trim()
    const section = normalizedHeading.match(/^(What is this disease|How it spreads|Immediate actions(?:\s*\([^)]*\))?|Organic remedy|Chemical remedy|Prevention tips)\s*:?\s*(.*)$/i)
    const bullet = trimmed.match(/^[-*+]\s+(.+)$/)
    const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/)

    if (!trimmed) {
      flushParagraph()
      flushList()
    } else if (heading || section) {
      flushParagraph()
      flushList()
      const title = section ? section[1].replace(/\s*\([^)]*\)/, '') : heading[1]
      blocks.push(<h3 key={`h-${index}`} className="font-semibold text-[#1B4332]">{formatInlineReport(title)}</h3>)
      const remainder = section?.[2]?.trim()
      if (remainder) paragraph.push(remainder)
    } else if (bullet || ordered) {
      flushParagraph()
      const nextListType = ordered ? 'ordered' : 'unordered'
      if (listItems.length && listType !== nextListType) flushList()
      listType = nextListType
      listItems.push((bullet || ordered)[1])
    } else {
      flushList()
      paragraph.push(trimmed.replace(/^>\s?/, ''))
    }
  })

  flushParagraph()
  flushList()

  return <div className="space-y-3">{blocks}</div>
}

function cleanReportForSpeech(text) {
  return String(text || '')
    .replace(/```[^\n]*\n?([\s\S]*?)```/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '. ')
    .replace(/^\s*\d+[.)]\s+/gm, '. ')
    .replace(/\*\*|__|[*_`~]/g, '')
    .replace(/₹/g, ' rupees ')
    .replace(/%/g, ' percent ')
    .replace(/[^\p{L}\p{N}\p{M}\s.,!?।'’]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export default function DiseaseDetect() {
  const { user } = useAuth()
  const { lat, lon, loading: locationLoading, error: locationError } = useLocation()
  const fileRef = useRef()
  const uploadCountRef = useRef(0)

  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [cropType, setCropType] = useState('')
  const [status, setStatus] = useState('') // analysing | insights | done
  const [result, setResult] = useState(null)
  const [groqReport, setGroqReport] = useState('')
  const [error, setError] = useState('')
  const [reported, setReported] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [isReadingReport, setIsReadingReport] = useState(false)
  const [webcamOpen, setWebcamOpen] = useState(false)
  const [stream, setStream] = useState(null)
  const videoRef = useRef()
  const canvasRef = useRef()
  const hasValidLocation = Number.isFinite(lat) && Number.isFinite(lon)
    && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180

  const toggleReportSpeech = () => {
    if (!('speechSynthesis' in window)) return
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel()
      setIsReadingReport(false)
      return
    }

    const text = cleanReportForSpeech(groqReport)
    if (!text) return
    const utterance = new SpeechSynthesisUtterance(text)
    const appLanguage = localStorage.getItem('km_lang')?.split('-')[0] || 'en'
    const langCode = appLanguage === 'mr' ? 'mr-IN' : appLanguage === 'hi' ? 'hi-IN' : 'en-IN'
    const voice = window.speechSynthesis.getVoices().find(item => item.lang.toLowerCase() === langCode.toLowerCase())
    utterance.lang = voice?.lang || langCode
    if (voice) utterance.voice = voice
    utterance.onstart = () => setIsReadingReport(true)
    utterance.onend = () => setIsReadingReport(false)
    utterance.onerror = () => setIsReadingReport(false)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  useEffect(() => () => window.speechSynthesis?.cancel(), [])

  const downloadPDF = () => {
    const pdf = new jsPDF()
    pdf.setFont('helvetica')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const margin = 15
    let y = 20

    // header bar
    pdf.setFillColor(27, 67, 50)
    pdf.rect(0, 0, pageWidth, 14, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')
    pdf.text('KrishiMitra - Disease Detection Report', margin, 9)

    // date
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, pageWidth - margin, 9, { align: 'right' })

    y = 28
    pdf.setTextColor(0, 0, 0)

    // farmer info
    pdf.setFillColor(240, 253, 244)
    pdf.rect(margin, y, pageWidth - margin * 2, 22, 'F')
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(27, 67, 50)
    pdf.text('Farmer Details', margin + 3, y + 7)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(60, 60, 60)
    pdf.text(`Name: ${user?.displayName || 'Not provided'}`, margin + 3, y + 14)
    pdf.text(`Contact: ${user?.phoneNumber || user?.email || 'Not provided'}`, margin + 3, y + 19)
    y += 28

    // detection result
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.setTextColor(27, 67, 50)
    pdf.text('Detection Result', margin, y)
    y += 6
    pdf.setDrawColor(45, 106, 79)
    pdf.line(margin, y, pageWidth - margin, y)
    y += 6

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(0, 0, 0)
    pdf.text(`Disease: ${result?.diseaseName || 'Unknown'}`, margin, y)
    y += 6
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text(`Crop Type: ${cropType || 'Not specified'}`, margin, y)
    y += 5
    pdf.text(`Confidence: ${Number.isFinite(result?.confidence) ? `${result.confidence}%` : 'Not available'}`, margin, y)
    y += 5
    pdf.text(`Severity: ${Number.isFinite(result?.confidence) ? (result.confidence > 70 ? 'High' : result.confidence > 40 ? 'Medium' : 'Low') : 'Not assessed'}`, margin, y)
    y += 5
    pdf.text(`Location: ${hasValidLocation ? `${lat.toFixed(4)}, ${lon.toFixed(4)}` : 'Not available'}`, margin, y)
    y += 10

    // AI report
    if (groqReport) {
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.setTextColor(27, 67, 50)
      pdf.text('AI Diagnosis Report', margin, y)
      y += 6
      pdf.setDrawColor(45, 106, 79)
      pdf.line(margin, y, pageWidth - margin, y)
      y += 6

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8.5)
      pdf.setTextColor(40, 40, 40)
      const lines = pdf.splitTextToSize(groqReport, pageWidth - margin * 2)
      lines.forEach(line => {
        if (y > 270) { pdf.addPage(); y = 20 }
        pdf.text(line, margin, y)
        y += 5
      })
    }

    // footer
    pdf.setFontSize(7)
    pdf.setTextColor(150, 150, 150)
    pdf.text('KrishiMitra - AI for Agriculture | Anjivani College of Engineering, Kopargaon', pageWidth / 2, 290, { align: 'center' })

    pdf.save(`krishimitra-disease-report-${Date.now()}.pdf`)
  }

  const handleFile = (file) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5MB'); return }
    
    uploadCountRef.current += 1
    const preview = URL.createObjectURL(file)
    
    setImage(file)
    setImagePreview(preview)
    setResult(null)
    setGroqReport('')
    setError('')
    setReported(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    handleFile(e.dataTransfer.files[0])
  }

  const detect = async () => {
    if (!image) return
    setError('')
    setResult(null)
    setGroqReport('')

    // Save current language and force to English BEFORE any React updates
    const savedLang = localStorage.getItem('km_lang') || 'en'
    const wasTranslated = savedLang !== 'en'
    
    if (wasTranslated) {
      // Switch to English immediately
      const select = document.querySelector('.goog-te-combo')
      if (select) {
        select.value = 'en'
        select.dispatchEvent(new Event('change'))
      }
      // Wait longer for Google Translate to finish switching to English
      await new Promise(resolve => setTimeout(resolve, 1500))
    }

    try {
      // Step 1 — detect disease
      setStatus('analysing')
      const formData = new FormData()
      formData.append('image', image)
      if (cropType) formData.append('cropType', cropType)
      const { data: detectData } = await postDisease(formData)

      // parse result from either crop.health or groq-vision
      let diseaseName = 'Unknown'
      let confidence = null
      let description = ''

      let symptoms = []
      let actions = []
      if (detectData.source === 'groq-vision') {
        const visionResult = parseVisionDetection(detectData.result?.raw)
        diseaseName = visionResult.diseaseName
        confidence = visionResult.confidence
        symptoms = visionResult.symptoms
        actions = visionResult.actions
        description = visionResult.notes
      } else if (detectData.source === 'crop.health') {
        const top = detectData.result?.result?.disease?.suggestions?.[0]
        diseaseName = top?.name || 'Unknown'
        confidence = Number.isFinite(top?.probability) ? Math.round(top.probability * 100) : null
        description = top?.details?.description || ''
      } else {
        diseaseName = 'Unable to identify reliably'
        description = 'Configure API keys for detailed analysis'
      }

      const parsed = { diseaseName, confidence, description, symptoms, actions, source: detectData.source }
      setResult(parsed)

      setStatus('insights')
      try {
        const { data: groqData } = await postGroq({
          messages: [{
            role: 'user',
            content: `Write a concise, farmer-friendly report for India. Use exactly these six headings, in this order, each on its own line, with the heading followed by a colon:
What is this disease:
How it spreads:
Immediate actions:
Organic remedy:
Chemical remedy:
Prevention tips:
Put practical advice under each heading. Do not invent a diagnosis or recommend a specific pesticide when the disease is uncertain; advise confirmation by a local agriculture officer and following product labels.

Case details: ${JSON.stringify({
              crop: cropType || 'unspecified',
              disease: String(diseaseName).slice(0, 120),
              confidence: Number.isFinite(confidence) ? `${confidence}%` : 'not available',
              symptoms: symptoms.slice(0, 3).map(item => String(item).slice(0, 120)),
              actions: actions.slice(0, 3).map(item => String(item).slice(0, 120)),
              assessment: String(description).slice(0, 200),
            })}`,
          }],
        })
        setGroqReport(normalizeDiseaseReport(groqData.text || '', diseaseName))
      } catch {
        setGroqReport(normalizeDiseaseReport('', diseaseName))
      }
      setStatus('done')

      // save to localStorage history
      const history = JSON.parse(localStorage.getItem('km_disease_history') || '[]')
      history.unshift({ diseaseName, cropType, date: new Date().toLocaleDateString('en-IN'), imagePreview })
      localStorage.setItem('km_disease_history', JSON.stringify(history.slice(0, 5)))

      // CRITICAL: Wait for React to finish ALL renders before translating back
      // Wait longer to ensure DOM is completely stable
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Now translate back to user's language
      if (wasTranslated) {
        const select = document.querySelector('.goog-te-combo')
        if (select) {
          select.value = savedLang
          select.dispatchEvent(new Event('change'))
        }
        
        // Wait for translation to complete and verify it worked
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Double-check: if page didn't translate, try again
        const htmlEl = document.documentElement
        const isTranslated = htmlEl.classList.contains('translated-ltr') || htmlEl.classList.contains('translated-rtl')
        if (!isTranslated && select) {
          select.value = savedLang
          select.dispatchEvent(new Event('change'))
        }
      }

    } catch (e) {
      setError(e.message || 'Detection failed. Please try again.')
      setStatus('')
      
      // Restore language even on error
      if (wasTranslated) {
        await new Promise(resolve => setTimeout(resolve, 500))
        const select = document.querySelector('.goog-te-combo')
        if (select) {
          select.value = savedLang
          select.dispatchEvent(new Event('change'))
        }
      }
    }
  }

  const submitReport = async () => {
    if (!user?.uid) {
      setError('Please sign in before submitting a disease report.')
      return
    }
    if (!hasValidLocation) {
      setError('Location required to submit report. Please enable location access.')
      return
    }
    setReporting(true)
    try {
      const { collection, addDoc, doc, getDoc, serverTimestamp } = await import('firebase/firestore')
      const { db, isFirebaseConfigured } = await import('@/lib/firebase')
      if (!isFirebaseConfigured || !db) {
        throw new Error('Firebase is not configured. Reports cannot be submitted yet.')
      }
      const profileSnapshot = await getDoc(doc(db, 'users', user.uid))
      const profile = profileSnapshot.data() || user.profile || {}
      const farmerName = profile.displayName || user.displayName || user.email || 'Farmer'
      await addDoc(collection(db, 'diseaseReports'), {
        farmerUid: user.uid,
        farmerName,
        cropType: cropType || 'Unknown',
        diseaseName: result?.diseaseName || 'Unknown',
        confidenceScore: result?.confidence || 0,
        severity: result?.confidence > 70 ? 'high' : result?.confidence > 40 ? 'medium' : 'low',
        groqReport,
        lat,
        lon,
        district: profile.district || '',
        state: profile.state || '',
        taluka: profile.taluka || '',
        status: 'new',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setReported(true)
    } catch (submitError) {
      setError(submitError.message || 'Failed to submit report. Try again.')
    } finally {
      setReporting(false)
    }
  }

  const reset = () => {
    setImage(null)
    setImagePreview(null)
    setCropType('')
    setResult(null)
    setGroqReport('')
    setError('')
    setStatus('')
    setReported(false)
  }

  const openWebcam = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      setStream(mediaStream)
      setWebcamOpen(true)
      setError('')
    } catch {
      setError('Camera access denied. Please allow camera permission.')
    }
  }

  const closeWebcam = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setWebcamOpen(false)
  }

  const capturePhoto = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)

    canvas.toBlob((blob) => {
      const file = new File([blob], `webcam-${Date.now()}.jpg`, { type: 'image/jpeg' })
      handleFile(file)
      closeWebcam()
    }, 'image/jpeg', 0.95)
  }

  useEffect(() => {
    if (webcamOpen && stream && videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [webcamOpen, stream])

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [stream])

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
      <div className="mt-8 mb-6">
        <h1 className="text-2xl font-bold text-[#1B4332]">Disease Detector</h1>
        <p className="text-sm text-gray-500 mt-1">Upload a photo of your crop to get instant AI diagnosis</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left — upload */}
        <div className="flex flex-col gap-4">
          {/* Drag and drop area */}
          <Card className="rounded-xl shadow-sm border border-gray-100">
            <CardContent className="p-4">
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  imagePreview ? 'border-[#2D6A4F]' : 'border-gray-200 hover:border-[#2D6A4F]'
                }`}
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="crop" className="max-h-48 mx-auto rounded-lg object-contain" key={`img-${uploadCountRef.current}`} />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <Upload className="w-10 h-10" />
                    <p className="text-sm font-medium">Drag & drop or click to upload</p>
                    <p className="text-xs">JPG, PNG, WEBP · Max 5MB</p>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => handleFile(e.target.files[0])} />

              {/* Camera button - works on both mobile and desktop */}
              <Button variant="outline" size="sm" className="w-full mt-3 border-gray-300 text-gray-600"
                onClick={openWebcam}>
                <Camera className="w-4 h-4 mr-2" /> Take Photo
              </Button>
            </CardContent>
          </Card>

          {/* Crop selector */}
          <Card className="rounded-xl shadow-sm border border-gray-100">
            <CardContent className="p-4">
              <label className="text-sm font-medium text-gray-700 block mb-2">Crop Type</label>
              <select value={cropType} onChange={e => setCropType(e.target.value === 'Select crop (optional)' ? '' : e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-[#2D6A4F] focus:outline-none">
                {CROP_TYPES.map(c => <option key={c}>{c}</option>)}
              </select>
            </CardContent>
          </Card>

          <Button onClick={detect} disabled={!image || status === 'analysing' || status === 'insights'}
            className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white w-full h-11">
            {status === 'analysing' ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analysing image...</>
            ) : status === 'insights' ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Getting AI insights...</>
            ) : (
              <><Bug className="w-4 h-4 mr-2" /> Detect Disease</>
            )}
          </Button>

          {error && (
            <div className="bg-[#FFEBEE] border border-[#C62828] text-[#C62828] text-sm px-4 py-2 rounded-lg">
              {error}
            </div>
          )}

          {/* Recent history */}
          {(() => {
            const history = JSON.parse(localStorage.getItem('km_disease_history') || '[]')
            if (!history.length) return null
            return (
              <Card className="rounded-xl shadow-sm border border-gray-100">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold text-[#1B4332] mb-3">Recent Detections</p>
                  <div className="flex flex-col gap-2">
                    {history.map((h, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <img src={h.imagePreview} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        <div>
                          <p className="font-medium text-[#111827]">{h.diseaseName}</p>
                          <p className="text-xs text-gray-400">{h.cropType || 'Unknown crop'} · {h.date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })()}
        </div>

        {/* Right — results */}
        <div className="flex flex-col gap-4">
          {!result && !status && (
            <Card className="rounded-xl shadow-sm border border-gray-100 bg-[#f0fdf4]">
              <CardContent className="p-6 text-center text-gray-400">
                <Bug className="w-12 h-12 mx-auto mb-3 text-[#D8F3DC]" />
                <p className="text-sm">Upload a crop photo and click Detect Disease to get AI diagnosis</p>
              </CardContent>
            </Card>
          )}

          {/* Detection result card */}
          {(result || status === 'analysing') && (
            <Card className="rounded-xl shadow-sm border border-gray-100">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Bug className="w-4 h-4 text-[#C62828]" />
                  <p className="text-sm font-semibold text-[#1B4332]">Detection Result</p>
                </div>
                {status === 'analysing' ? (
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ) : result && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-[#111827]">{result.diseaseName}</p>
                      {Number.isFinite(result.confidence) && result.confidence > 0 && (
                        <Badge className={SEVERITY_COLORS[result.confidence > 70 ? 'high' : result.confidence > 40 ? 'medium' : 'low']}>
                          {result.confidence}% confidence
                        </Badge>
                      )}
                    </div>
                    {result.description && (
                      <p className="text-sm text-gray-600 leading-relaxed">{result.description}</p>
                    )}
                    {result.symptoms?.length > 0 && (
                      <div className="text-sm text-gray-600">
                        <p className="font-medium text-gray-700">Visible symptoms</p>
                        <ul className="list-disc space-y-1 pl-5">
                          {result.symptoms.map((symptom, index) => <li key={`symptom-${index}`}>{symptom}</li>)}
                        </ul>
                      </div>
                    )}
                    {result.actions?.length > 0 && (
                      <div className="text-sm text-gray-600">
                        <p className="font-medium text-gray-700">Immediate actions</p>
                        <ul className="list-disc space-y-1 pl-5">
                          {result.actions.map((action, index) => <li key={`action-${index}`}>{action}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Groq AI report */}
          {(groqReport || status === 'insights') && (
            <Card className="rounded-xl shadow-sm border border-gray-100 bg-[#f0fdf4]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-sm font-semibold text-[#1B4332]">AI Diagnosis Report</p>
                  <Badge className="bg-[#D8F3DC] text-[#2D6A4F] text-xs">Groq AI</Badge>
                </div>
                {status === 'insights' ? (
                  <div className="space-y-2">
                    {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-3 w-full" />)}
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-gray-700 leading-relaxed">
                      <FormattedDiseaseReport text={groqReport} />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={toggleReportSpeech}
                      className="mt-4 border-[#2D6A4F]/30 text-[#2D6A4F] hover:bg-[#D8F3DC]"
                    >
                      {isReadingReport ? <VolumeX className="mr-2 h-4 w-4" /> : <Volume2 className="mr-2 h-4 w-4" />}
                      {isReadingReport ? 'Stop reading' : 'Listen to report'}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Action buttons after detection */}
          {status === 'done' && (
            <div className="flex flex-col gap-2">
              {reported ? (
                <div className="bg-[#D8F3DC] border border-[#2D6A4F] text-[#2D6A4F] text-sm px-4 py-3 rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Report submitted to agricultural authorities
                </div>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="border-[#C62828] text-[#C62828] hover:bg-[#FFEBEE] w-full"
                      disabled={locationLoading || !hasValidLocation}>
                      <AlertTriangle className="w-4 h-4 mr-2" /> Alert Authorities
                      {locationLoading && ' (Getting location...)'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Submit Disease Report?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Your name, crop and disease details, GPS coordinates, and saved district/state will be stored in Firebase and visible to signed-in users on the Alerts page.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={submitReport} disabled={reporting}
                        className="bg-[#C62828] hover:bg-red-800 text-white">
                        {reporting ? 'Submitting...' : 'Yes, Submit Report'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {!reported && !locationLoading && !hasValidLocation && (
                <p className="text-xs text-amber-700" role="status">
                  {locationError || 'Enable location access to attach your position to this report.'}
                </p>
              )}

              <Button variant="outline" onClick={downloadPDF}
                className="border-[#1565C0] text-[#1565C0] hover:bg-[#E3F2FD] w-full">
                <FileDown className="w-4 h-4 mr-2" /> Download PDF Report
              </Button>

              <Button variant="outline" onClick={reset} className="border-gray-300 text-gray-600 w-full">
                Detect Another
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Webcam Modal */}
      {webcamOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#1B4332]">Capture Photo</h3>
              <button onClick={closeWebcam} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            <div className="relative bg-black rounded-lg overflow-hidden mb-4">
              <video ref={videoRef} autoPlay playsInline className="w-full h-auto" />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <div className="flex gap-3">
              <Button onClick={capturePhoto} className="flex-1 bg-[#2D6A4F] hover:bg-[#1B4332] text-white">
                <Camera className="w-4 h-4 mr-2" /> Capture
              </Button>
              <Button onClick={closeWebcam} variant="outline" className="flex-1 border-gray-300 text-gray-600">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
