const express = require('express')
const { getCache, refreshCache, readCache } = require('../services/priceCache')
const router = express.Router()

const MOCK_PRICES = [
  { state: 'Maharashtra', district: 'Ahmednagar', market: 'Kopargaon APMC', commodity: 'Maize', variety: 'Other', grade: 'Non-FAQ', arrival_date: '13/04/2026', min_price: 1326, max_price: 1798, modal_price: 1600 },
  { state: 'Maharashtra', district: 'Ahmednagar', market: 'Kopargaon APMC', commodity: 'Onion', variety: 'Red', grade: 'Local', arrival_date: '13/04/2026', min_price: 400, max_price: 981, modal_price: 875 },
  { state: 'Maharashtra', district: 'Pune', market: 'Pune APMC', commodity: 'Tomato', variety: 'Local', grade: 'Medium', arrival_date: '13/04/2026', min_price: 800, max_price: 1200, modal_price: 1000 },
  { state: 'Maharashtra', district: 'Nashik', market: 'Lasalgaon APMC', commodity: 'Onion', variety: 'Red', grade: 'Local', arrival_date: '13/04/2026', min_price: 600, max_price: 900, modal_price: 750 },
  { state: 'Maharashtra', district: 'Latur', market: 'Latur APMC', commodity: 'Soybean', variety: 'Local', grade: 'FAQ', arrival_date: '13/04/2026', min_price: 3800, max_price: 4200, modal_price: 4000 },
]

const getSamplePrices = state => state
  ? MOCK_PRICES.filter(record => record.state === state)
  : MOCK_PRICES

// GET /api/prices — serves from local cache
router.get('/', async (req, res, next) => {
  try {
    const { state } = req.query
    const apiKey = process.env.DATA_GOV_IN_API_KEY
    if (!apiKey || apiKey === 'your_data_gov_in_key') {
      const records = getSamplePrices(state)
      return res.json({ records, source: 'sample', total: records.length })
    }

    const cache = await getCache(state)
    if (!cache) {
      const records = getSamplePrices(state)
      return res.json({ records, source: 'sample', total: records.length })
    }

    const cachedRecords = Array.isArray(cache.records) ? cache.records : []
    const records = state
      ? cachedRecords.filter(r => r.state === state)
      : cachedRecords

    if (records.length === 0) {
      const fallbackRecords = getSamplePrices(state)
      return res.json({
        records: fallbackRecords,
        total: fallbackRecords.length,
        fetchedDate: cache.fetchedDate,
        source: 'sample',
      })
    }

    res.json({
      records,
      total: records.length,
      fetchedDate: cache.fetchedDate,
      source: 'live',
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/prices/refresh — manually trigger cache refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const refreshed = await refreshCache(req.body?.state || req.query.state)
    const cache = readCache()
    res.json({
      success: refreshed,
      total: cache?.totalRecords || 0,
      fetchedDate: cache?.fetchedDate || null,
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
