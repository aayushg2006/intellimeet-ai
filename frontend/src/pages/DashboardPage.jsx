import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { LogOut, User, Video, Plus } from 'lucide-react'

export const DashboardPage = () => {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [meetingId, setMeetingId] = useState('')
  const [showJoinModal, setShowJoinModal] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleCreateMeeting = () => {
    const newMeetingId = Math.random().toString(36).substring(2, 9).toUpperCase()
    navigate(`/meeting/${newMeetingId}`)
  }

  const handleJoinMeeting = () => {
    if (!meetingId.trim()) {
      alert('Please enter a meeting ID')
      return
    }
    navigate(`/meeting/${meetingId}`)
    setShowJoinModal(false)
    setMeetingId('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Navbar */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-purple-600">IntellMeet</h1>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Card */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
              <User size={32} className="text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">
                Welcome, {user?.name || 'User'}!
              </h2>
              <p className="text-gray-600">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Create Meeting */}
          <button
            onClick={handleCreateMeeting}
            className="bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg p-8 shadow-lg transition transform hover:scale-105 flex flex-col items-center justify-center gap-4"
          >
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <Plus size={32} />
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-bold">Create Meeting</h3>
              <p className="text-white text-opacity-90">Start a new meeting now</p>
            </div>
          </button>

          {/* Join Meeting */}
          <button
            onClick={() => setShowJoinModal(true)}
            className="bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg p-8 shadow-lg transition transform hover:scale-105 flex flex-col items-center justify-center gap-4"
          >
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <Video size={32} />
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-bold">Join Meeting</h3>
              <p className="text-white text-opacity-90">Enter meeting with ID</p>
            </div>
          </button>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {/* Card 1 */}
          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
            <div className="text-3xl font-bold text-purple-600 mb-2">5</div>
            <p className="text-gray-600">Upcoming Meetings</p>
          </div>

          {/* Card 2 */}
          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
            <div className="text-3xl font-bold text-blue-600 mb-2">12</div>
            <p className="text-gray-600">Total Participants</p>
          </div>

          {/* Card 3 */}
          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
            <div className="text-3xl font-bold text-indigo-600 mb-2">8</div>
            <p className="text-gray-600">Available Hours</p>
          </div>
        </div>

        {/* Debug Info */}
        <div className="mt-12 bg-gray-100 rounded-lg p-6">
          <h3 className="font-bold text-gray-900 mb-4">Debug Info (for development)</h3>
          <pre className="bg-gray-800 text-gray-100 p-4 rounded overflow-auto text-sm">
            {JSON.stringify(user, null, 2)}
          </pre>
        </div>
      </div>

      {/* Join Meeting Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-bold text-gray-900">Join Meeting</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ID Meeting
                </label>
                <input
                  type="text"
                  value={meetingId}
                  onChange={(e) => setMeetingId(e.target.value.toUpperCase())}
                  placeholder="Enter meeting ID"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && handleJoinMeeting()}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleJoinMeeting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
