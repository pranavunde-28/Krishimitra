require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')
const errorHandler = require('./middleware/errorHandler')
const { isCacheFresh, refreshCache } = require('./services/priceCache')

const app = express()

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet())

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  ...(process.env.FRONTEND_URL || '').split(',').map(origin => origin.trim()),
].filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    cb(new Error(`CORS blocked: ${origin}`))
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }))

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(morgan('[:date[iso]] :method :url :status :response-time ms'))

// ── Global rate limiter ───────────────────────────────────────────────────────
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
}))

// ── Strict rate limiter for AI routes ─────────────────────────────────────────
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'AI request limit reached. Please wait a moment.' },
})

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/prices', require('./routes/prices'))
app.use('/api/groq', aiLimiter, require('./routes/groq'))
app.use('/api/disease', aiLimiter, require('./routes/disease'))
app.use('/api/weather', require('./routes/weather'))
app.use('/api/report', require('./routes/reports'))
app.use('/api/voice', aiLimiter, require('./routes/voice'))

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  status: 'ok',
  service: 'KrishiMitra API',
  timestamp: new Date().toISOString(),
}))

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route not found' }))

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler)

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000

  app.listen(PORT, '0.0.0.0', () => {
  console.log(`[KrishiMitra] Backend running on port ${PORT}`)
  console.log(`[KrishiMitra] Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`)
})

  if (!isCacheFresh()) {
    console.log('[Cache] Stale — refreshing price data...')
    refreshCache().catch(e => console.error('[Cache] Refresh error:', e.message))
  } else {
    console.log('[Cache] Fresh — no fetch needed')
  }

  // schedule daily refresh at midnight IST (18:30 UTC)
  const now = new Date()
  const midnight = new Date()
  midnight.setUTCHours(18, 30, 0, 0)
  if (midnight < now) midnight.setDate(midnight.getDate() + 1)
  const msUntilMidnight = midnight - now

  setTimeout(() => {
    refreshCache()
    setInterval(() => refreshCache(), 24 * 60 * 60 * 1000)
  }, msUntilMidnight)

  console.log(`[Cache] Next refresh in ${(msUntilMidnight / 1000 / 60).toFixed(0)} minutes`)

