import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const isPlaceholderValue = (value) => {
  if (!value || typeof value !== 'string') return true
  const normalized = value.trim().toLowerCase()
  return normalized === '' || normalized.includes('your_') || normalized.includes('your-') || normalized.includes('example') || normalized === 'test' || normalized.includes('replace-me')
}

const hasFirebaseConfig = Object.values(firebaseConfig).every((value) => Boolean(value)) && !Object.values(firebaseConfig).some(isPlaceholderValue)

const app = hasFirebaseConfig ? initializeApp(firebaseConfig) : null

export const isFirebaseConfigured = hasFirebaseConfig
export const firebaseProjectId = hasFirebaseConfig ? firebaseConfig.projectId : null
export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null
export const storage = app ? getStorage(app) : null
export default app
