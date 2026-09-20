const express = require('express')
const axios = require('axios')
const Groq = require('groq-sdk')
const router = express.Router()

let groqClient = null
function getGroq() {
  if (!groqClient) groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY })
  return groqClient
}

const SYSTEM_PROMPT = `You are KrishiMitra Voice Assistant, an AI helper for Indian farmers. 
You help farmers with:
- Crop prices and market information
- Crop recommendations based on soil and season
- Plant disease identification and treatment
- Weather and farming calendar
- Government schemes like PM-KISAN, Fasal Bima
- General farming advice specific to India and Maharashtra

Always respond in the same language the farmer asks in (Hindi, Marathi, or English).
Keep answers short, practical and easy to understand for a rural farmer.
When price data is provided, give specific numbers and mention the date.`

async function fetchPrices(commodity, state = 'Maharashtra') {
  try {
    const { data } = await axios.get('https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070', {
      params: {
        'api-key': process.env.DATA_GOV_IN_API_KEY,
        format: 'json',
        limit: 10,
        'filters[state]': state,
        'filters[commodity]': commodity,
      },
      timeout: 10000,
    })
    
    if (data?.records?.length > 0) {
      const records = data.records.slice(0, 5)
      return records.map(r => `${r.market}: ₹${r.modal_price}/quintal (${r.arrival_date})`).join(', ')
    }
    return null
  } catch {
    return null
  }
}

async function searchDuckDuckGo(query) {
  try {
    const { data } = await axios.get('https://api.duckduckgo.com/', {
      params: { q: query, format: 'json', no_html: 1, skip_disambig: 1 },
      timeout: 5000,
    })
    const results = []
    if (data.AbstractText) results.push(data.AbstractText)
    if (data.RelatedTopics?.length) {
      data.RelatedTopics.slice(0, 3).forEach(t => {
        if (t.Text) results.push(t.Text)
      })
    }
    return results.join('\n')
  } catch {
    return ''
  }
}

router.post('/', async (req, res, next) => {
  try {
    const { query, language = 'en' } = req.body

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' })
    }

    const sanitizedQuery = query.trim().slice(0, 500)
    if (!sanitizedQuery) {
      return res.status(400).json({ error: 'Query cannot be empty' })
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({ error: 'AI service not configured' })
    }

    // detect if query is about prices
    const priceKeywords = ['price', 'bhav', 'rate', 'cost', 'किमत', 'भाव', 'दर', 'किंमत']
    const isPriceQuery = priceKeywords.some(kw => sanitizedQuery.toLowerCase().includes(kw))
    
    let priceData = null
    if (isPriceQuery) {
      // extract commodity name (simple pattern matching)
      const commodities = ['onion', 'tomato', 'potato', 'wheat', 'rice', 'cotton', 'soybean', 'maize', 'sugarcane', 'chilli', 'turmeric']
      const hindiMap = { 'प्याज': 'onion', 'टमाटर': 'tomato', 'आलू': 'potato', 'गेहूं': 'wheat', 'चावल': 'rice', 'कपास': 'cotton' }
      const marathiMap = { 'कांदा': 'onion', 'टोमॅटो': 'tomato', 'बटाटा': 'potato', 'गहू': 'wheat', 'तांदूळ': 'rice', 'कापूस': 'cotton' }
      
      let commodity = null
      for (const c of commodities) {
        if (sanitizedQuery.toLowerCase().includes(c)) {
          commodity = c
          break
        }
      }
      if (!commodity) {
        for (const [hindi, eng] of Object.entries(hindiMap)) {
          if (sanitizedQuery.includes(hindi)) {
            commodity = eng
            break
          }
        }
      }
      if (!commodity) {
        for (const [marathi, eng] of Object.entries(marathiMap)) {
          if (sanitizedQuery.includes(marathi)) {
            commodity = eng
            break
          }
        }
      }
      
      if (commodity) {
        priceData = await fetchPrices(commodity)
      }
    }

    // search internet for context
    const searchContext = await searchDuckDuckGo(`${sanitizedQuery} farming India`)

    const langInstruction = language === 'hi'
      ? 'Respond in Hindi (Devanagari script).'
      : language === 'mr'
      ? 'Respond in Marathi (Devanagari script).'
      : 'Respond in English.'

    const userMessage = priceData
      ? `Question: ${sanitizedQuery}\n\nLatest prices: ${priceData}\n\n${langInstruction}`
      : searchContext
      ? `Question: ${sanitizedQuery}\n\nWeb context: ${searchContext.slice(0, 800)}\n\n${langInstruction}`
      : `Question: ${sanitizedQuery}\n\n${langInstruction}`

    const completion = await getGroq().chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 512,
      temperature: 0.7,
    })

    const answer = completion.choices[0]?.message?.content || ''
    res.json({ answer, searchUsed: !!searchContext, priceUsed: !!priceData })
  } catch (err) {
    if (err.status === 429) {
      return res.status(429).json({ error: 'AI service busy. Please try again.' })
    }
    next(err)
  }
})

module.exports = router
