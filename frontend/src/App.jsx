import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { Loader } from 'lucide-react'
import { useAuthStore } from './store/authStore'
import { ProtectedRoute } from './components/ProtectedRoute'
import { NotificationProvider } from './providers/NotificationProvider'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Eager: these are on the critical path to first paint for a signed-out or
// just-signed-in user, so splitting them would only add a round trip.
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { LandingPage } from './pages/LandingPage'
import { DashboardPage } from './pages/DashboardPage'
import { AuthCallback } from './pages/AuthCallback'
import { NotFoundPage } from './pages/NotFoundPage'

// Lazy: heavy, and none of it is needed to render the first screen.
// VideoRoom alone pulls in react-quill and the WebRTC stack; AnalyticsPage
// pulls in recharts; TeamWorkspace pulls in @dnd-kit.
const VideoRoom = lazy(() => import('./pages/VideoRoom').then((m) => ({ default: m.VideoRoom })))
const MeetingLobby = lazy(() => import('./pages/MeetingLobby').then((m) => ({ default: m.MeetingLobby })))
const MeetingSummary = lazy(() => import('./pages/MeetingSummary').then((m) => ({ default: m.MeetingSummary })))
const TeamWorkspace = lazy(() => import('./pages/TeamWorkspace').then((m) => ({ default: m.TeamWorkspace })))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const OrganizationSettings = lazy(() => import('./pages/OrganizationSettings').then((m) => ({ default: m.OrganizationSettings })))
const JoinOrganization = lazy(() => import('./pages/JoinOrganization').then((m) => ({ default: m.JoinOrganization })))
const SearchPage = lazy(() => import('./pages/SearchPage').then((m) => ({ default: m.SearchPage })))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-[#FAF9F7]" role="status" aria-live="polite">
    <Loader size={26} className="animate-spin text-[#7C3AED]" aria-hidden="true" />
    <span className="sr-only">Loading…</span>
  </div>
)

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <NotificationProvider>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Public Auth Routes */}
              <Route
                path="/login"
                element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
              />
              <Route
                path="/register"
                element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />}
              />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* OAuth Callback (must be public) */}
              <Route path="/auth/callback" element={<AuthCallback />} />

              {/* Protected Routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/search"
                element={
                  <ProtectedRoute>
                    <SearchPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/meeting/:meetingId"
                element={
                  <ProtectedRoute>
                    <MeetingLobby />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/meeting/:meetingId/room"
                element={
                  <ProtectedRoute>
                    <VideoRoom />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/meeting/:meetingId/summary"
                element={
                  <ProtectedRoute>
                    <MeetingSummary />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/workspace"
                element={
                  <ProtectedRoute>
                    <TeamWorkspace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute>
                    <AnalyticsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/org/settings"
                element={
                  <ProtectedRoute>
                    <OrganizationSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/join/:token"
                element={
                  <ProtectedRoute>
                    <JoinOrganization />
                  </ProtectedRoute>
                }
              />

              {/* Fallback Routes */}
              <Route
                path="/"
                element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />}
              />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>

          {/* Inside the Router so notification toasts can navigate on click. */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#1C1C1E',
                color: '#ffffff',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)',
                fontSize: '14px',
              },
              success: { iconTheme: { primary: '#7C3AED', secondary: '#ffffff' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#ffffff' } },
            }}
          />
        </NotificationProvider>
      </Router>
    </QueryClientProvider>
  )
}

export default App
