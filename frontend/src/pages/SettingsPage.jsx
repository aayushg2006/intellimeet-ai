import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useSignedUrl } from '../hooks/useSignedUrl'
import { ArrowLeft, User, Mail, Shield, Camera, Save, Loader, Check, Upload } from 'lucide-react'
import axios from 'axios'

export const SettingsPage = () => {
  const navigate = useNavigate()
  const { user, token, login } = useAuthStore()

  const [name, setName] = useState(user?.name || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const fileInputRef = useRef(null)

  // Resolve the S3 key (or external URL) into a displayable URL
  const { url: resolvedAvatarUrl } = useSignedUrl(user?.avatar)

  const initials = user?.name
    ?.split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase() || 'U'

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate on client side
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPEG, PNG, GIF, or WebP)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB')
      return
    }

    // Show immediate preview
    const previewUrl = URL.createObjectURL(file)
    setAvatarPreview(previewUrl)
    setError('')
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await axios.post('/api/uploads/avatar', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      })

      // Update auth store with new avatar key
      const updatedUser = { ...user, avatar: res.data.key }
      login(updatedUser, token)

      // Use the returned signed URL for display
      setAvatarPreview(res.data.url)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload avatar')
      setAvatarPreview(null)
    } finally {
      setUploading(false)
    }
  }

  const displayAvatarUrl = avatarPreview || resolvedAvatarUrl

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
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-white via-[#FAF9F7] to-[#F3F0FF] text-[#1A1A1A]">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute left-[-3rem] top-12 h-[24rem] w-[24rem] rounded-full bg-gradient-to-br from-[#C4B5FD] via-[#93C5FD] to-[#E0E7FF] blur-3xl opacity-45" />
        <div className="absolute right-[-2rem] top-[-2rem] h-[20rem] w-[28rem] rounded-[45%] bg-gradient-to-br from-[#C4B5FD] via-[#93C5FD] to-[#E0E7FF] blur-3xl opacity-40" />
        <div className="absolute bottom-0 right-[8%] h-[18rem] w-[20rem] rounded-[40%] bg-gradient-to-br from-[#93C5FD] via-[#BFDBFE] to-white blur-3xl opacity-40" />
      </div>

      <div className="relative z-10">
        <div className="sticky top-0 z-50 border-b border-white/10 bg-white/60 px-6 py-4 backdrop-blur-sm">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-semibold text-[#1A1A1A]">
              <img src="/logo.png" alt="IntellMeet" className="h-8 w-auto" />
            </div>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              aria-label="Back to dashboard"
              className="flex items-center gap-2 text-sm text-[#6B6560] transition hover:text-[#1A1A1A]"
            >
              <ArrowLeft size={16} />
              Back to dashboard
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-2xl px-6 pt-8 pb-10">
          <h1 className="text-2xl font-semibold text-[#1A1A1A]">Settings</h1>
          <p className="mt-1 text-sm text-[#6B6560]">Manage your profile and account</p>

        {/* Profile Card */}
        <div className="mt-8 rounded-2xl border border-[#E8E4DD] bg-white/80 p-6 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.25)] backdrop-blur-sm">
          <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold text-[#1A1A1A]">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#7C3AED]/10 to-[#2563EB]/10">
              <User size={16} className="text-[#7C3AED]" />
            </div>
            Profile Information
          </h2>

          {/* Avatar */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative group">
              {displayAvatarUrl ? (
                <img
                  src={displayAvatarUrl}
                  alt={user?.name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-[#E8E4DD]"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-[#7C3AED] text-white text-xl font-semibold flex items-center justify-center">
                  {initials}
                </div>
              )}
              <button
                type="button"
                onClick={handleAvatarClick}
                disabled={uploading}
                aria-label="Upload profile photo"
                className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/40 opacity-0 transition disabled:cursor-wait group-hover:opacity-100"
              >
                {uploading ? (
                  <Loader size={18} className="text-white animate-spin" />
                ) : (
                  <Camera size={18} className="text-white" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-[#1A1A1A]">{user?.name}</p>
              <p className="text-xs text-[#6B6560]">{user?.email}</p>
              <button
                type="button"
                onClick={handleAvatarClick}
                disabled={uploading}
                className="text-xs text-[#7C3AED] hover:text-[#6D28D9] mt-1 flex items-center gap-1 transition disabled:opacity-50"
              >
                <Upload size={12} />
                {uploading ? 'Uploading...' : 'Change photo'}
              </button>
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
              <label htmlFor="display-name" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#6B6560]">
                Display Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 text-[#C4BDB5]" size={16} />
                <input
                  id="display-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-[#E8E4DD] bg-[#FAF9F7] py-2.5 pl-9 pr-4 text-sm text-[#1A1A1A] placeholder-[#C4BDB5] transition focus:border-[#7C3AED] focus:outline-none"
                  placeholder="Your name"
                />
              </div>
            </div>

            {/* Email (read-only) */}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#6B6560]">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 text-[#C4BDB5]" size={16} />
                <input
                  id="email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full cursor-not-allowed rounded-xl border border-[#E8E4DD] bg-[#F5F2EE] py-2.5 pl-9 pr-4 text-sm text-[#6B6560]"
                />
              </div>
              <p className="mt-1 text-xs text-[#C4BDB5]">Email cannot be changed</p>
            </div>

            {/* Role (read-only) */}
            <div>
              <label htmlFor="role" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#6B6560]">
                Role
              </label>
              <div className="relative">
                <Shield className="absolute left-3 top-2.5 text-[#C4BDB5]" size={16} />
                <input
                  id="role"
                  type="text"
                  value={user?.role || 'Member'}
                  disabled
                  className="w-full cursor-not-allowed rounded-xl border border-[#E8E4DD] bg-[#F5F2EE] py-2.5 pl-9 pr-4 text-sm text-[#6B6560]"
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
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] py-2.5 text-sm font-semibold text-white transition hover:from-[#6D28D9] hover:to-[#5B21B6] disabled:cursor-not-allowed disabled:opacity-40"
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
    </div>
  )
}
