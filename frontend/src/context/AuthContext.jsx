import { createContext, useContext, useEffect, useState } from 'react'
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, isFirebaseConfigured } from '@/lib/firebase'

const AuthContext = createContext(null)

function destroyRecaptcha() {
  try {
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear()
      window.recaptchaVerifier = null
    }
  } catch {}

  const old = document.getElementById('recaptcha-container')
  if (old) {
    const parent = old.parentNode
    parent.removeChild(old)
    const fresh = document.createElement('div')
    fresh.id = 'recaptcha-container'
    parent.appendChild(fresh)
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isFirebaseConfigured || !auth || !db) {
      setUser(null)
      setLoading(false)
      return undefined
    }

    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)

      if (!firebaseUser) return

      void (async () => {
        try {
          const ref = doc(db, 'users', firebaseUser.uid)
          const snap = await getDoc(ref)
          let profile = snap.data() || {}

          if (!snap.exists()) {
            profile = {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || '',
              email: firebaseUser.email || '',
              phone: firebaseUser.phoneNumber || '',
              role: 'farmer',
              language: 'en',
              bookmarkedSchemes: [],
              priceAlerts: [],
            }
            await setDoc(ref, { ...profile, createdAt: serverTimestamp() })
          }

          if (auth.currentUser?.uid === firebaseUser.uid) {
            setUser({ ...firebaseUser, profile })
          }
        } catch {
          // Firebase authentication remains valid even if the profile is unavailable.
        }
      })()
    })
    return unsub
  }, [])

  const loginWithGoogle = async () => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error('Firebase is not configured. Add your VITE_FIREBASE_* values to the frontend .env file.')
    }

    const provider = new GoogleAuthProvider()
    return signInWithPopup(auth, provider)
  }

  const sendOTP = async (phoneNumber) => {
    if (!isFirebaseConfigured || !auth) {
      throw new Error('Firebase is not configured. Add your VITE_FIREBASE_* values to the frontend .env file.')
    }

    destroyRecaptcha()
    const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
    })
    window.recaptchaVerifier = verifier
    return signInWithPhoneNumber(auth, phoneNumber, verifier)
  }

  const logout = async () => {
    if (!isFirebaseConfigured || !auth) {
      return
    }

    destroyRecaptcha()
    return signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, sendOTP, logout, isFirebaseConfigured }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
