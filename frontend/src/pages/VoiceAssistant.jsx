import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Mic, MicOff, Volume2, VolumeX, Send, Trash2 } from 'lucide-react'
import { postVoice } from '@/lib/api'

const LANGUAGES = [
  { code: 'en', label: 'English', speechCode: 'en-IN' },
  { code: 'hi', label: 'हिंदी', speechCode: 'hi-IN' },
  { code: 'mr', label: 'मराठी', speechCode: 'mr-IN' },
]

const SUGGESTIONS = [
  'What is the price of onion today?',
  'Which crops should I plant in June?',
  'How to treat tomato blight?',
  'What is PM-KISAN scheme?',
  'How much rainfall is expected this week?',
  'Best fertilizer for wheat crop?',
]

const SUGGESTIONS_HI = [
  'आज प्याज का भाव क्या है?',
  'जून में कौन सी फसल लगाएं?',
  'टमाटर की बीमारी का इलाज?',
  'पीएम किसान योजना क्या है?',
]

const SUGGESTIONS_MR = [
  'आज कांद्याचा भाव काय आहे?',
  'जूनमध्ये कोणती पिके लावावीत?',
  'टोमॅटोच्या रोगावर उपाय?',
  'पीएम किसान योजना काय आहे?',
]

function useSpeechRecognition(lang, onResult) {
  const recognitionRef = useRef(null)
  const [listening, setListening] = useState(false)
  const [supported] = useState(() => 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window)

  const start = useCallback(() => {
    if (!supported) return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SR()
    recognition.lang = lang
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript
      onResult(transcript)
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }, [lang, onResult, supported])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  return { listening, supported, start, stop }
}

function useSpeechSynthesis() {
  const [speaking, setSpeaking] = useState(false)
  const [supported] = useState(() => 'speechSynthesis' in window)

  const cleanSpeechText = (text) => String(text || '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[*_`#>]/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[•●▪◦]/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()

  const speak = useCallback((text, langCode) => {
    if (!supported) return
    window.speechSynthesis.cancel()

    const voices = window.speechSynthesis.getVoices()
    const match =
      voices.find(v => v.lang === langCode) ||
      voices.find(v => v.lang.startsWith(langCode.split('-')[0])) ||
      (langCode.startsWith('mr') ? voices.find(v => v.lang.startsWith('hi')) : null) ||
      voices.find(v => v.lang.startsWith('en'))

    const speechText = cleanSpeechText(text)
    if (!speechText) return
    const chunks = speechText.match(/[^.!?।]+[.!?।]+|[^.!?।]+$/g) || [speechText]
    const queue = chunks.reduce((result, chunk) => {
      const words = chunk.trim().split(' ')
      for (let index = 0; index < words.length; index += 35) {
        result.push(words.slice(index, index + 35).join(' '))
      }
      return result
    }, [])
    let chunkIndex = 0

    const speakNext = () => {
      if (chunkIndex >= queue.length) {
        setSpeaking(false)
        return
      }

      const utterance = new SpeechSynthesisUtterance(queue[chunkIndex])
      utterance.rate = 0.82
      utterance.pitch = 1
      if (match) {
        utterance.voice = match
        utterance.lang = match.lang
      } else {
        utterance.lang = langCode
      }
      utterance.onstart = () => setSpeaking(true)
      utterance.onend = () => {
        chunkIndex += 1
        speakNext()
      }
      utterance.onerror = () => setSpeaking(false)
      window.speechSynthesis.speak(utterance)
    }

    speakNext()
  }, [supported])

  // voices load async — wait for them
  const speakWhenReady = useCallback((text, langCode) => {
    if (!supported) return
    const voices = window.speechSynthesis.getVoices()
    if (voices.length > 0) {
      speak(text, langCode)
    } else {
      const handleVoicesChanged = () => {
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged)
        speak(text, langCode)
      }
      window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged)
    }
  }, [speak, supported])

  const stop = useCallback(() => {
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  return { speaking, supported, speak: speakWhenReady, stop }
}

export default function VoiceAssistant() {
  const [lang, setLang] = useState('en')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Namaste! I am KrishiMitra Voice Assistant. Ask me anything about farming, crop prices, weather, or government schemes. You can speak or type your question.' }
  ])
  const [loading, setLoading] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(true)
  const messagesEndRef = useRef(null)

  const currentLang = LANGUAGES.find(l => l.code === lang)

  const handleResult = useCallback((transcript) => {
    setInput(transcript)
  }, [])

  const { listening, supported: micSupported, start, stop } = useSpeechRecognition(currentLang.speechCode, handleResult)
  const { speaking, supported: ttsSupported, speak, stop: stopSpeaking } = useSpeechSynthesis()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    const query = (text || input).trim()
    if (!query || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: query }])
    setLoading(true)

    try {
      const { data } = await postVoice(query, lang)
      const answer = data.answer || 'Sorry, I could not find an answer.'
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: answer,
        searchUsed: data.searchUsed,
        priceUsed: data.priceUsed,
      }])
      if (autoSpeak && ttsSupported) speak(answer, currentLang.speechCode)
    } catch (e) {
      const errMsg = e.message || 'Something went wrong. Please try again.'
      setMessages(prev => [...prev, { role: 'assistant', text: errMsg, isError: true }])
    } finally {
      setLoading(false)
    }
  }

  const handleMic = () => {
    if (listening) stop()
    else start()
  }

  const suggestions = lang === 'hi' ? SUGGESTIONS_HI : lang === 'mr' ? SUGGESTIONS_MR : SUGGESTIONS

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
      <div className="mt-8 mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B4332]">Voice Assistant</h1>
          <p className="text-sm text-gray-500 mt-1">Ask anything about farming in Hindi, Marathi or English</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Language selector */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            {LANGUAGES.map(l => (
              <button key={l.code} onClick={() => setLang(l.code)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${lang === l.code ? 'bg-[#2D6A4F] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                {l.label}
              </button>
            ))}
          </div>
          {/* Auto speak toggle */}
          {ttsSupported && (
            <button onClick={() => { setAutoSpeak(a => !a); stopSpeaking() }}
              className={`p-2 rounded-lg border transition-colors ${autoSpeak ? 'border-[#2D6A4F] text-[#2D6A4F] bg-[#f0fdf4]' : 'border-gray-200 text-gray-400'}`}
              title={autoSpeak ? 'Auto-speak on' : 'Auto-speak off'}>
              {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Chat window */}
      <Card className="rounded-xl shadow-sm border border-gray-100 mb-4">
        <CardContent className="p-0">
          <div className="h-[420px] overflow-y-auto p-4 flex flex-col gap-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#2D6A4F] text-white rounded-br-sm'
                    : msg.isError
                    ? 'bg-[#FFEBEE] text-[#C62828] rounded-bl-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}>
                  <span translate="no">{msg.text}</span>
                  {msg.searchUsed && (
                    <span className="block mt-1 text-xs opacity-60">🌐 Web search used</span>
                  )}
                  {msg.priceUsed && (
                    <span className="block mt-1 text-xs opacity-60">💰 Live price data</span>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1 items-center h-4">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </CardContent>
      </Card>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => sendMessage(s)}
              className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-full text-gray-600 hover:border-[#2D6A4F] hover:text-[#2D6A4F] transition-colors">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex gap-2">
        {/* Mic button */}
        {micSupported && (
          <button onClick={handleMic}
            className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
              listening
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-white border border-gray-200 text-gray-500 hover:border-[#2D6A4F] hover:text-[#2D6A4F]'
            }`}
            title={listening ? 'Stop listening' : 'Start voice input'}>
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        )}

        {/* Text input */}
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder={listening ? 'Listening...' : lang === 'hi' ? 'अपना सवाल यहाँ लिखें...' : lang === 'mr' ? 'तुमचा प्रश्न इथे लिहा...' : 'Type or speak your question...'}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#2D6A4F] transition-colors"
          disabled={loading}
        />

        {/* Send button */}
        <Button onClick={() => sendMessage()} disabled={!input.trim() || loading}
          className="shrink-0 bg-[#2D6A4F] hover:bg-[#1B4332] text-white rounded-xl w-11 h-11 p-0">
          <Send className="w-4 h-4" />
        </Button>

        {/* Clear chat */}
        <button onClick={() => { setMessages([{ role: 'assistant', text: 'Chat cleared. Ask me anything!' }]); stopSpeaking() }}
          className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors"
          title="Clear chat">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Status indicators */}
      <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-400">
        {!micSupported && <span className="text-orange-400">⚠ Microphone not supported in this browser</span>}
        {!ttsSupported && <span className="text-orange-400">⚠ Text-to-speech not supported in this browser</span>}
        {ttsSupported && (() => {
          const voices = window.speechSynthesis?.getVoices() || []
          const hasHindi = voices.some(v => v.lang.startsWith('hi'))
          if (lang === 'hi' && !hasHindi) return <span className="text-orange-400">⚠ Hindi voice not found — speaking in English</span>
          return null
        })()}
        {speaking && (
          <button onClick={stopSpeaking} className="text-[#2D6A4F] hover:underline">
            Stop speaking
          </button>
        )}
        {listening && <span className="text-red-400 animate-pulse">● Recording...</span>}
      </div>
    </div>
  )
}
