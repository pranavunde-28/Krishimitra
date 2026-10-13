import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// response interceptor — normalize errors
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.error ||
      err.response?.data?.message ||
      (err.code === 'ECONNABORTED' ? 'Request timed out. Please try again.' : null) ||
      (err.code === 'ERR_NETWORK' ? 'Cannot connect to server. Make sure backend is running.' : null) ||
      err.message ||
      'Something went wrong'

    return Promise.reject(new Error(message))
  }
)

export const getPrices = (params) => api.get('/api/prices', { params })
export const refreshPrices = (state) => api.post('/api/prices/refresh', { state }, { timeout: 60000 })
export const getWeather = (lat, lon) => api.get('/api/weather', { params: { lat, lon } })
export const postGroq = (payload) => api.post('/api/groq', payload)
export const postDisease = (formData) => api.post('/api/disease', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
  timeout: 60000, // disease detection can take longer
})
export const postReport = (data) => api.post('/api/report', data)
export const postVoice = (query, language) => api.post('/api/voice', { query, language })
export const getVoiceSpeechUrl = (text) => api.getUri({ url: '/api/voice/speech', params: { text } })

export default api
