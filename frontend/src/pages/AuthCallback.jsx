import { useEffect, useState } from 'react'
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
  const [error, setError] = useState(null)

  useEffect(() => {
    try {
      const token = searchParams.get('token')
      const userParam = searchParams.get('user')
      const errorParam = searchParams.get('error')

      if (errorParam) {
        setError('Google sign-in failed. Please try again.')
        setTimeout(() => navigate('/login'), 3000)
        return
      }

      if (!token || !userParam) {
        setError('Invalid authentication response.')
        setTimeout(() => navigate('/login'), 3000)
        return
      }

      const userData = JSON.parse(decodeURIComponent(userParam))
      login(userData, token)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      console.error('OAuth callback error:', err)
      setError('Something went wrong during sign-in.')
      setTimeout(() => navigate('/login'), 3000)
    }
  }, [searchParams, login, navigate])

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md text-center">
          <div className="text-red-500 text-lg font-semibold mb-2">Authentication Error</div>
          <p className="text-gray-600">{error}</p>
          <p className="text-sm text-gray-400 mt-2">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md text-center">
        <Loader size={32} className="animate-spin text-purple-600 mx-auto mb-4" />
        <p className="text-gray-700 font-medium">Completing sign-in...</p>
        <p className="text-sm text-gray-400 mt-1">Please wait</p>
      </div>
    </div>
  )
}
