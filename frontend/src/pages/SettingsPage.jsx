import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { ArrowLeft, User, Mail, Shield, Camera, Save, Loader, Check } from 'lucide-react'
import axios from 'axios'

export const SettingsPage = () => {
  const navigate = useNavigate()
  const { user, token, login } = useAuthStore()

  const [name, setName] = useState(user?.name || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const initials = user?.name
    ?.split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase() || 'U'

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    setSaved(false)

    try {
      const res = await axios.put(
        '/api/auth/profile',
        { name: name.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      const updatedUser = {
        _id: res.data._id,
        id: res.data._id,
        name: res.data.name,
        email: res.data.email,
        role: res.data.role,
        avatar: res.data.avatar,
        authProvider: res.data.authProvider,
      }

      login(updatedUser, res.data.token)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF9F7]">
      {/* Header */}
      <div className="border-b border-[#E8E4DD] bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[#1A1A1A] font-semibold">
          <span className="text-[#7C3AED]">●</span>
          IntellMeet
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-sm text-[#6B6560] hover:text-[#1A1A1A] transition"
        >
          <ArrowLeft size={16} />
          Back to dashboard
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-6 pt-8 pb-10">
        <h1 className="text-2xl font-semibold text-[#1A1A1A]">Settings</h1>
        <p className="text-sm text-[#6B6560] mt-1">Manage your profile and account</p>

        {/* Profile Card */}
        <div className="mt-8 bg-white border border-[#E8E4DD] rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-[#1A1A1A] mb-5 flex items-center gap-2">
            <User size={16} className="text-[#7C3AED]" />
            Profile Information
          </h2>

          {/* Avatar */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative group">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-[#7C3AED] text-white text-xl font-semibold flex items-center justify-center">
                  {initials}
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer">
                <Camera size={18} className="text-white" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-[#1A1A1A]">{user?.name}</p>
              <p className="text-xs text-[#6B6560]">{user?.email}</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          {saved && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center gap-2">
              <Check size={16} />
              Profile updated successfully
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-[#6B6560] uppercase tracking-wider mb-1.5">
                Display Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 text-[#C4BDB5]" size={16} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#FAF9F7] border border-[#E8E4DD] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[#1A1A1A] placeholder-[#C4BDB5] focus:outline-none focus:border-[#7C3AED] transition"
                  placeholder="Your name"
                />
              </div>
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="block text-xs font-medium text-[#6B6560] uppercase tracking-wider mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 text-[#C4BDB5]" size={16} />
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full bg-[#F5F2EE] border border-[#E8E4DD] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[#6B6560] cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-[#C4BDB5] mt-1">Email cannot be changed</p>
            </div>

            {/* Role (read-only) */}
            <div>
              <label className="block text-xs font-medium text-[#6B6560] uppercase tracking-wider mb-1.5">
                Role
              </label>
              <div className="relative">
                <Shield className="absolute left-3 top-2.5 text-[#C4BDB5]" size={16} />
                <input
                  type="text"
                  value={user?.role || 'Member'}
                  disabled
                  className="w-full bg-[#F5F2EE] border border-[#E8E4DD] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[#6B6560] cursor-not-allowed"
                />
              </div>
            </div>

            {/* Auth Provider Badge */}
            <div>
              <label className="block text-xs font-medium text-[#6B6560] uppercase tracking-wider mb-1.5">
                Sign-in Method
              </label>
              <div className="flex items-center gap-2">
                {(user?.authProvider === 'local' || user?.authProvider === 'both') && (
                  <span className="bg-[#F5F2EE] text-[#6B6560] text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
                    <Mail size={12} />
                    Email/Password
                  </span>
                )}
                {(user?.authProvider === 'google' || user?.authProvider === 'both') && (
                  <span className="bg-blue-50 text-blue-600 text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
                    <svg className="w-3 h-3" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Google
                  </span>
                )}
              </div>
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={saving || name.trim() === user?.name}
              className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2 mt-6"
            >
              {saving ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save Changes
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
