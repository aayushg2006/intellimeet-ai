import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Eye, EyeOff, Loader } from 'lucide-react'
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''
const GOOGLE_AUTH_URL = `${API_BASE_URL}/api/auth/google`

export const LoginPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const login = useAuthStore((state) => state.login)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(searchParams.get('error') === 'oauth_failed' ? 'Google sign-in failed. Please try again.' : '')

  useEffect(() => { document.title = 'Sign In — IntellMeet' }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, { email, password })
      const { _id, name, email: userEmail, role, avatar, authProvider, token } = response.data

      const userData = {
        _id,
        id: _id,
        email: userEmail || email,
        name: name || email.split('@')[0],
        role,
        avatar,
        authProvider,
      }

      login(userData, token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    window.location.href = GOOGLE_AUTH_URL
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <svg className="absolute -left-16 -top-16 h-72 w-72 rotate-[-12deg] opacity-10" viewBox="0 0 300 300" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M30 200C70 140 130 120 190 155C240 185 260 245 300 260" stroke="#c084fc" strokeWidth="28" strokeLinecap="round" />
          <path d="M20 120C60 70 120 45 185 80C235 108 265 155 310 165" stroke="#93c5fd" strokeWidth="18" strokeLinecap="round" />
        </svg>
        <svg className="absolute -bottom-12 -left-6 h-80 w-80 rotate-[18deg] opacity-10" viewBox="0 0 320 320" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M40 180C95 120 175 110 220 150C252 180 275 220 300 250" stroke="#bfdbfe" strokeWidth="24" strokeLinecap="round" />
          <path d="M20 250C70 210 140 200 190 230C230 255 258 285 300 310" stroke="#d8b4fe" strokeWidth="16" strokeLinecap="round" />
        </svg>
        <svg className="absolute -right-20 top-6 h-72 w-72 rotate-[22deg] opacity-10" viewBox="0 0 300 300" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M30 120C95 80 155 82 200 120C240 154 258 205 280 240" stroke="#93c5fd" strokeWidth="26" strokeLinecap="round" />
        </svg>
      </div>

      <div className="relative flex min-h-screen items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-sm">
          <div className="rounded-[28px] border border-white/20 bg-white/10 p-6 shadow-[0_20px_80px_rgba(2,6,23,0.35)] backdrop-blur-lg sm:p-7">
            <div className="mb-5 text-center">
              <img src="/logo.png" alt="IntellMeet" className="mx-auto mb-2 h-8 w-8" />
              <h1 className="text-3xl font-bold tracking-tight text-white">Login</h1>
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-red-200/40 bg-red-500/20 p-3 text-sm text-red-100">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-white">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-purple-200/80 outline-none transition focus:border-white/40 focus:bg-white/15"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-medium text-white">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full rounded-full border border-white/20 bg-white/10 px-4 py-3 pr-12 text-sm text-white placeholder:text-purple-200/80 outline-none transition focus:border-white/40 focus:bg-white/15"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute inset-y-0 right-3 flex items-center text-white/70 transition hover:text-white"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <Link to="/forgot-password" className="text-sm font-medium text-purple-200 transition hover:text-white">
                  Forgot Password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader size={18} className="animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/20" />
              <span className="text-[11px] uppercase tracking-[0.25em] text-purple-100/80">or continue with</span>
              <div className="h-px flex-1 bg-white/20" />
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleGoogleLogin}
                aria-label="Continue with Google"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm transition-all duration-200 hover:scale-105 hover:bg-slate-100 hover:shadow-lg"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              </button>
            </div>

            <p className="mt-6 text-center text-sm text-purple-100/80">
              Don't have an account?{' '}
              <Link to="/register" className="font-medium text-purple-300 transition hover:text-white">
                Register for free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
