import { useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Loader } from 'lucide-react'

/**
 * OAuth callback handler page.
 * Google OAuth redirects here with token & user data in URL params.
 * This page extracts them, stores in auth state, and redirects to dashboard.
 */
export const AuthCallback = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const login = useAuthStore((state) => state.login)
  const authResult = useMemo(() => {
    const token = searchParams.get('token')
    const userParam = searchParams.get('user')
    const errorParam = searchParams.get('error')

    if (errorParam) {
      return { error: 'Google sign-in failed. Please try again.' }
    }

    if (!token || !userParam) {
      return { error: 'Invalid authentication response.' }
    }

    try {
      return {
        token,
        user: JSON.parse(decodeURIComponent(userParam)),
      }
    } catch {
      return { error: 'Something went wrong during sign-in.' }
    }
  }, [searchParams])

  useEffect(() => {
    if (authResult.error) {
      const timer = setTimeout(() => navigate('/login'), 3000)
      return () => clearTimeout(timer)
    }

    if (authResult.token && authResult.user) {
      login(authResult.user, authResult.token)
      navigate('/dashboard', { replace: true })
    }
  }, [authResult, login, navigate])

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
