import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { useAuthStore } from '../store/authStore'
import { Loader } from 'lucide-react'

/**
 * OAuth callback handler page.
 *
 * Google OAuth redirects here with a single-use `code`, which we exchange over
 * POST for the real tokens. The previous version received the JWT directly in
 * the query string, which left it in browser history and in the Referer header
 * of every subsequent request.
 */
export const AuthCallback = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const login = useAuthStore((state) => state.login)
  // Derived synchronously from the URL — no state update needed for the cases
  // we can decide before making any request.
  const initialError = searchParams.get('error')
    ? 'Google sign-in failed. Please try again.'
    : searchParams.get('code')
      ? null
      : 'Invalid authentication response.'

  const [authResult, setAuthResult] = useState({ error: initialError })
  // The code is single-use, so React StrictMode's double-mount would burn it on
  // the first render and fail on the second.
  const exchangedRef = useRef(false)

  useEffect(() => {
    if (exchangedRef.current || initialError) return
    exchangedRef.current = true

    const code = searchParams.get('code')
    const baseURL = import.meta.env.VITE_API_URL || ''

    axios
      .post(`${baseURL}/api/auth/oauth/exchange`, { code })
      .then(({ data }) => {
        login(data, data.token, data.refreshToken)
        // Drop the code from the URL before it reaches the history stack.
        navigate('/dashboard', { replace: true })
      })
      .catch(() => {
        setAuthResult({ error: 'This sign-in link has expired. Please try again.' })
      })
  }, [searchParams, login, navigate, initialError])

  useEffect(() => {
    if (authResult.error) {
      const timer = setTimeout(() => navigate('/login'), 3000)
      return () => clearTimeout(timer)
    }
  }, [authResult, navigate])

  if (authResult.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
        <div className="max-w-md rounded-2xl border border-white/20 bg-white/10 p-8 text-center text-white shadow-2xl shadow-black/20 backdrop-blur-lg">
          <div className="mb-2 text-lg font-semibold text-white">Authentication Error</div>
          <p className="text-sm text-slate-200">{authResult.error}</p>
          <p className="mt-2 text-sm text-slate-300">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-md rounded-2xl border border-white/20 bg-white/10 p-8 text-center text-white shadow-2xl shadow-black/20 backdrop-blur-lg">
        <Loader size={32} className="mx-auto mb-4 animate-spin text-white" />
        <p className="font-medium text-white">Completing sign-in...</p>
        <p className="mt-1 text-sm text-slate-300">Please wait</p>
      </div>
    </div>
  )
}
