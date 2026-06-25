import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { DashboardPage } from './pages/DashboardPage'
import { MeetingLobby } from './pages/MeetingLobby'
import { VideoRoom } from './pages/VideoRoom'
import { MeetingSummary } from './pages/MeetingSummary'
import { ProtectedRoute } from './components/ProtectedRoute'
import { TeamWorkspace } from './pages/TeamWorkspace'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { AuthCallback } from './pages/AuthCallback'
import { SettingsPage } from './pages/SettingsPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { OrganizationSettings } from './pages/OrganizationSettings'
import { JoinOrganization } from './pages/JoinOrganization'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
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
            element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  )
}

export default App
