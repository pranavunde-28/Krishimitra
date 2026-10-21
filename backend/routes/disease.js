const express = require('express')
const axios = require('axios')
const multer = require('multer')
const Groq = require('groq-sdk')
const router = express.Router()

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) return cb(null, true)
    cb(new Error('Only JPG, PNG and WEBP images are allowed'))
  },
})

let groqClient = null
function getGroq() {
  if (!groqClient) groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY })
  return groqClient
}

router.post('/', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image provided' })
    }

    const { cropType } = req.body
    const sanitizedCropType = cropType ? String(cropType).slice(0, 50) : null
    const base64Image = req.file.buffer.toString('base64')
    const mimeType = req.file.mimetype

    // try crop.health API first
    const cropHealthKey = process.env.CROP_HEALTH_API_KEY
    if (cropHealthKey && cropHealthKey !== 'your_crop_health_key') {
      try {
        const { data } = await axios.post(
          'https://crop.health/api/v1/identification',
          {
            images: [`data:${mimeType};base64,${base64Image}`],
            ...(sanitizedCropType && { crop: sanitizedCropType }),
          },
          {
            headers: { 'Api-Key': cropHealthKey, 'Content-Type': 'application/json' },
            timeout: 15000,
          }
        )
        return res.json({ result: data, source: 'crop.health' })
      } catch (e) {
        console.warn('[Disease] crop.health failed, falling back to Groq:', e.message)
      }
    }

    // Groq vision fallback
    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({ error: 'Disease detection service not configured' })
    }

    const completion = await getGroq().chat.completions.create({
      model: process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Assess this plant image${sanitizedCropType ? ` (crop: ${sanitizedCropType})` : ''}. Return exactly these four fields, each on its own line, using the labels shown and no extra sections:\nDisease name: ...\nConfidence: ...%\nVisible symptoms:\n- ...\nImmediate actions:\n- ...\nIf the image does not support a reliable identification, write "Unable to identify reliably" for the disease name, "Not available" for confidence, and say so in the symptoms. Do not invent a disease or confidence value. Keep symptoms and actions concise and practical.`,
          },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64Image}` },
          },
        ],
      }],
      max_tokens: 512,
    })

    res.json({
      result: { raw: completion.choices[0]?.message?.content || '' },
      source: 'groq-vision',
    })
  } catch (err) {
    if (err.message?.includes('Only JPG')) {
      return res.status(400).json({ error: err.message })
    }
    next(err)
  }
})

module.exports = router
