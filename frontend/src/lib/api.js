import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const baseURL = import.meta.env.VITE_API_URL || ''

/**
 * The shared API client.
 *
 * Everything routed through here gets the bearer token attached automatically
 * and gets a transparent token refresh on 401. Previously every call site wrote
 * its own `Authorization` header and nothing handled 401 at all, so an expired
 * token left the app looking signed-in while every request silently failed.
 */
export const api = axios.create({ baseURL })

// A bare client for the refresh call itself, so a failing refresh can never
// re-enter the response interceptor and loop.
const refreshClient = axios.create({ baseURL })

// Single-flight: if several requests 401 at once we must issue exactly one
// refresh. The refresh token rotates on use, so two concurrent refreshes would
// make the second look like a replay and revoke the entire session.
let refreshPromise = null

const refreshSession = async () => {
  const { refreshToken } = useAuthStore.getState()
  if (!refreshToken) return null

  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post('/api/auth/refresh', { refreshToken })
      .then(({ data }) => {
        useAuthStore.getState().setTokens(data.token, data.refreshToken)
        if (data._id) useAuthStore.getState().setUser(data)
        return data.token
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

const forceSignOut = () => {
  useAuthStore.getState().logout()
  // Full reload rather than a router navigate: this can fire from anywhere,
  // including outside the Router, and we want all cached state discarded.
  if (!window.location.pathname.startsWith('/login')) {
    window.location.replace('/login?expired=1')
  }
}

/**
 * Attach auth + refresh behaviour to an axios instance.
 *
 * This is applied to both our own `api` instance and to the global axios
 * default, because ~40 pre-existing call sites use the bare `axios` singleton
 * with a hand-written Authorization header. Installing here means those keep
 * working against short-lived access tokens without a risky 40-file rewrite;
 * they can be migrated to `api` incrementally.
 */
export const installAuthInterceptors = (instance) => {
  instance.interceptors.request.use((config) => {
    const { token } = useAuthStore.getState()
    if (token) {
      // Overwrites any hand-written header, which is what we want — after a
      // refresh the store holds a newer token than the component captured.
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })

  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = error.config

      if (error.response?.status !== 401 || !original || original._retried) {
        return Promise.reject(error)
      }

      // Never try to refresh the auth endpoints themselves.
      if (original.url?.includes('/api/auth/refresh') || original.url?.includes('/api/auth/login')) {
        return Promise.reject(error)
      }

      original._retried = true

      const newToken = await refreshSession()
      if (!newToken) {
        forceSignOut()
        return Promise.reject(error)
      }

      original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` }
      return instance(original)
    }
  )
}

installAuthInterceptors(api)

/**
 * Return a token guaranteed usable right now, refreshing first if it is close
 * to expiry.
 *
 * Socket.io authenticates once during the handshake and cannot retry with a new
 * token mid-connection, so socket call sites use this rather than reading the
 * store directly.
 */
export const getFreshToken = async () => {
  const { token } = useAuthStore.getState()
  if (!token) return null

  try {
    const [, payload] = token.split('.')
    const { exp } = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    // Refresh if it expires within the next two minutes.
    if (exp * 1000 - Date.now() > 120_000) return token
  } catch {
    return token
  }

  return (await refreshSession()) || token
}

export default api
