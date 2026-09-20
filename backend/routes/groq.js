const express = require('express')
const Groq = require('groq-sdk')
const router = express.Router()

const SYSTEM_PROMPT = 'You are KrishiMitra, an AI assistant for Indian farmers. Always be helpful, practical, and specific to India. Keep responses concise and easy to understand.'
const MAX_MESSAGE_LENGTH = 2000
const MAX_MESSAGES = 5

// singleton Groq client
let groqClient = null
function getGroq() {
  if (!groqClient) groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY })
  return groqClient
}

router.post('/', async (req, res, next) => {
  try {
    const { messages, systemPrompt } = req.body

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' })
    }
    if (messages.length > MAX_MESSAGES) {
      return res.status(400).json({ error: `Maximum ${MAX_MESSAGES} messages allowed` })
    }

    // validate and sanitize messages
    const sanitized = messages.map(m => ({
      role: ['user', 'assistant', 'system'].includes(m.role) ? m.role : 'user',
      content: typeof m.content === 'string'
        ? m.content.slice(0, MAX_MESSAGE_LENGTH)
        : m.content,
    }))

    if (!process.env.GROQ_API_KEY) {
      return res.json({ text: 'AI insights will appear here once the Groq API key is configured.' })
    }

    const completion = await getGroq().chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: systemPrompt || SYSTEM_PROMPT },
        ...sanitized,
      ],
      max_tokens: 1024,
      temperature: 0.7,
    })

    const text = completion.choices[0]?.message?.content || ''
    res.json({ text })
  } catch (err) {
    if (err.status === 429) {
      return res.status(429).json({ error: 'AI service is busy. Please try again in a moment.' })
    }
    next(err)
  }
})

module.exports = router
