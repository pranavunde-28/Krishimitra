const axios = require('axios')
const fs = require('fs')
const path = require('path')

const CACHE_FILE = path.join(__dirname, '../data/prices_cache.json')
const AGMARKNET_URL = 'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070'

const STATES = [
  'Maharashtra', 'Karnataka', 'Punjab', 'Uttar Pradesh',
  'Madhya Pradesh', 'Rajasthan', 'Gujarat', 'Andhra Pradesh',
  'Telangana', 'Haryana', 'Bihar', 'West Bengal'
]

function getTodayIST() {
  return new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
}

function isCacheFresh() {
  if (!fs.existsSync(CACHE_FILE)) return false
  try {
    const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
    return cache.fetchedDate === getTodayIST() &&
      Array.isArray(cache.records) && cache.records.length > 0
  } catch { return false }
}

function readCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
  } catch { return null }
}

async function fetchAllForState(apiKey, state) {
  const params = {
    'api-key': apiKey,
    format: 'json',
    limit: 500,
    offset: 0,
    'filters[state.keyword]': state,
  }
  const { data: first } = await axios.get(AGMARKNET_URL, { params, timeout: 20000 })
  const total = first.total || 0
  let records = first.records || []
  console.log(`  ${state}: ${total} records`)

  const totalPages = Math.ceil(total / 500)
  for (let page = 1; page < totalPages; page++) {
    try {
      const { data } = await axios.get(AGMARKNET_URL, {
        params: { ...params, offset: page * 500 },
        timeout: 20000,
      })
      records = records.concat(data.records || [])
      await new Promise(r => setTimeout(r, 300))
    } catch (e) {
      console.log(`  Warning: page ${page} failed for ${state}: ${e.message}`)
    }
  }
  return records
}

async function refreshCache(stateFilter) {
  const apiKey = process.env.DATA_GOV_IN_API_KEY
  if (!apiKey || apiKey === 'your_data_gov_in_key') {
    console.log('No API key — skipping cache refresh')
    return false
  }

  console.log('🌾 Starting price cache refresh...')
  const start = Date.now()
  const allRecords = []

  const statesToFetch = stateFilter ? [stateFilter] : STATES
  for (const state of statesToFetch) {
    try {
      const records = await fetchAllForState(apiKey, state)
      allRecords.push(...records)
    } catch (e) {
      console.log(`  Failed ${state}: ${e.message}`)
    }
  }

  if (allRecords.length === 0) {
    console.log('⚠️ Price refresh returned no records; keeping the last known cache')
    return false
  }

  const previousCache = readCache()
  const records = stateFilter && Array.isArray(previousCache?.records)
    ? [
        ...previousCache.records.filter(record => record.state !== stateFilter),
        ...allRecords,
      ]
    : allRecords
  const cache = {
    fetchedDate: getTodayIST(),
    fetchedAt: new Date().toISOString(),
    totalRecords: records.length,
    records,
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf8')
  console.log(`✅ Cache saved: ${records.length} records in ${((Date.now() - start) / 1000).toFixed(1)}s`)
  return true
}

async function getCache(state) {
  const cache = readCache()
  const hasStateRecords = state && cache?.records?.some(record => record.state === state)
  if (isCacheFresh() && (!state || hasStateRecords)) {
    console.log('📦 Serving from local cache')
    return cache
  }
  console.log(`🔄 Cache missing fresh ${state || 'market'} prices — refreshing...`)
  await refreshCache(state)
  return readCache()
}

module.exports = { getCache, refreshCache, isCacheFresh, readCache }
