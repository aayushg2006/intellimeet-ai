import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,

      // `session` is the auth response body: { ...user, token, refreshToken }
      setSession: (user, token, refreshToken) =>
        set({
          user,
          token,
          refreshToken: refreshToken ?? null,
          isAuthenticated: true,
        }),

      login: (user, token, refreshToken) =>
        set({
          user,
          token,
          refreshToken: refreshToken ?? null,
          isAuthenticated: true,
        }),

      register: (user, token, refreshToken) =>
        set({
          user,
          token,
          refreshToken: refreshToken ?? null,
          isAuthenticated: true,
        }),

      // Replaces only the tokens, leaving the cached user object alone.
      // Used by the silent-refresh interceptor.
      setTokens: (token, refreshToken) =>
        set((state) => ({
          token,
          refreshToken: refreshToken ?? state.refreshToken,
          isAuthenticated: true,
        })),

      logout: () =>
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
        }),

      setUser: (user) => set({ user }),
    }),
    {
      name: 'auth-storage',
    }
  )
)
