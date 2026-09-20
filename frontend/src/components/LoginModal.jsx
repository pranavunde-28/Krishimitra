import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'
import { Leaf } from 'lucide-react'

const FIREBASE_ERRORS = {
  'auth/invalid-phone-number': 'Invalid phone number. Enter a valid 10-digit Indian number.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/quota-exceeded': 'SMS quota exceeded. Try again later.',
  'auth/billing-not-enabled': 'SMS requires Firebase Blaze plan. For demo use: +919999999999 / OTP: 123456',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/operation-not-allowed': 'Phone login is not enabled. Contact support.',
  'auth/captcha-check-failed': 'reCAPTCHA check failed. Please refresh and try again.',
  'auth/invalid-verification-code': 'Wrong OTP. Please check and try again.',
  'auth/code-expired': 'OTP has expired. Please request a new one.',
  'auth/missing-phone-number': 'Phone number is required.',
  'auth/popup-closed-by-user': 'Sign-in popup was closed. Please try again.',
  'auth/network-request-failed': 'Network error. Check your internet connection.',
}

function getErrorMessage(error) {
  console.error('Firebase Auth Error:', error.code, error.message)
  return FIREBASE_ERRORS[error.code] || `Error: ${error.message}`
}

export default function LoginModal({ open, onClose }) {
  const { loginWithGoogle, sendOTP, isFirebaseConfigured } = useAuth()
  const [step, setStep] = useState('options')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [confirmResult, setConfirmResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const reset = () => {
    setStep('options')
    setPhone('')
    setOtp('')
    setError('')
    setConfirmResult(null)
    setLoading(false)
  }

  const handleClose = () => { reset(); onClose() }

  const handleGoogle = async () => {
    if (!isFirebaseConfigured) {
      setError('Firebase is not configured. Add your VITE_FIREBASE_* values in the frontend .env file.')
      return
    }

    setLoading(true)
    setError('')
    try {
      await loginWithGoogle()
      handleClose()
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const handleSendOTP = async () => {
    if (!isFirebaseConfigured) {
      setError('Firebase is not configured. Add your VITE_FIREBASE_* values in the frontend .env file.')
      return
    }

    setError('')
    const digits = phone.replace(/\D/g, '')

    if (digits.length !== 10) {
      setError('Enter exactly 10 digits')
      return
    }
    if (!/^[6-9]/.test(digits)) {
      setError('Indian mobile numbers start with 6, 7, 8 or 9')
      return
    }

    const formatted = `+91${digits}`
    setLoading(true)
    try {
      const result = await sendOTP(formatted)
      setConfirmResult(result)
      setStep('otp')
      setOtp('')
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) { setError('Enter the 6-digit OTP'); return }
    setLoading(true)
    setError('')
    try {
      await confirmResult.confirm(otp)
      handleClose()
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setOtp('')
    setError('')
    setStep('phone')
    // small delay so recaptcha container resets
    await new Promise(r => setTimeout(r, 300))
    await handleSendOTP()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#1B4332]">
            <Leaf className="w-5 h-5" /> Sign in to KrishiMitra
          </DialogTitle>
        </DialogHeader>

        {/* Step 1 — choose method */}
        {step === 'options' && (
          <div className="flex flex-col gap-3 mt-2">
            <Button onClick={handleGoogle} disabled={loading || !isFirebaseConfigured}
              className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white w-full disabled:opacity-60">
              {loading ? 'Signing in...' : isFirebaseConfigured ? 'Continue with Google' : 'Firebase not configured'}
            </Button>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <div className="flex-1 h-px bg-gray-200" /> or <div className="flex-1 h-px bg-gray-200" />
            </div>
            <Button variant="outline" onClick={() => { setError(''); setStep('phone') }} disabled={!isFirebaseConfigured}
              className="w-full border-gray-300 text-gray-700 disabled:opacity-60">
              Continue with Phone Number
            </Button>
            {!isFirebaseConfigured && (
              <p className="text-xs text-amber-600">
                Add your Firebase keys to the frontend .env file to enable sign-in.
              </p>
            )}
            {error && <p className="text-red-500 text-sm">{error}</p>}
          </div>
        )}

        {/* Step 2 — enter phone */}
        {step === 'phone' && (
          <div className="flex flex-col gap-3 mt-2">
            <p className="text-sm text-gray-500">Enter your 10-digit mobile number</p>
            <div className="flex gap-2">
              <div className="flex items-center px-3 bg-gray-50 border border-gray-300 rounded-md text-sm text-gray-600 shrink-0 select-none">
                🇮🇳 +91
              </div>
              <Input
                placeholder="9876543210"
                value={phone}
                onChange={e => {
                  setError('')
                  setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                }}
                maxLength={10}
                type="tel"
                inputMode="numeric"
                autoFocus
                className="focus:border-[#2D6A4F] tracking-widest text-center font-mono"
              />
            </div>
            <p className="text-xs text-gray-400">A 6-digit OTP will be sent via SMS</p>
            <Button
              onClick={handleSendOTP}
              disabled={loading || phone.replace(/\D/g, '').length !== 10}
              className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white w-full"
            >
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </Button>
            <button onClick={() => { setStep('options'); setError('') }}
              className="text-sm text-gray-400 hover:text-gray-600 text-left">
              ← Back
            </button>
            {error && <p className="text-red-500 text-sm">{error}</p>}
          </div>
        )}

        {/* Step 3 — enter OTP */}
        {step === 'otp' && (
          <div className="flex flex-col gap-3 mt-2">
            <p className="text-sm text-gray-500">
              OTP sent to <span className="font-semibold text-gray-700">+91 {phone}</span>
            </p>
            <Input
              placeholder="• • • • • •"
              value={otp}
              onChange={e => {
                setError('')
                setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
              }}
              maxLength={6}
              type="tel"
              inputMode="numeric"
              autoFocus
              className="text-center text-2xl tracking-[0.5em] font-mono focus:border-[#2D6A4F] h-14"
            />
            <Button
              onClick={handleVerifyOTP}
              disabled={loading || otp.length !== 6}
              className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white w-full"
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </Button>
            <button
              onClick={handleResend}
              disabled={loading}
              className="text-sm text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              Didn't receive? Resend OTP
            </button>
            {error && <p className="text-red-500 text-sm">{error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
