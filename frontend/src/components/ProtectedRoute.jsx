import { useAuth } from '@/context/AuthContext'
import { useState, useEffect } from 'react'
import LoginModal from '@/components/LoginModal'

export default function ProtectedRoute({ children }) {
  const { user, loading, isFirebaseConfigured } = useAuth()
  const [showLogin, setShowLogin] = useState(false)

  useEffect(() => {
    if (!loading && !user && isFirebaseConfigured) setShowLogin(true)
  }, [loading, user, isFirebaseConfigured])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    </div>
  )

  if (!user && isFirebaseConfigured) return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-[#f9fafb]">
        <div className="text-center px-4">
          <div className="text-4xl mb-4">🌾</div>
          <h2 className="text-xl font-bold text-[#1B4332] mb-2">Sign in to continue</h2>
          <p className="text-sm text-gray-500 mb-6">You need to be logged in to access this page</p>
          <button
            onClick={() => setShowLogin(true)}
            className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
      <LoginModal open={showLogin} onClose={() => setShowLogin(false)} />
    </>
  )

  return children
}
