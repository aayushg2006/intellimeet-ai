import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { LogOut, User, Video, Plus, ArrowUpRight, LayoutGrid, BarChart2, Loader, Settings, Search } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { WorkspaceSwitcher } from '../components/WorkspaceSwitcher'
import { ScheduleMeetingModal } from '../components/ScheduleMeetingModal'
import { useWorkspaceStore } from '../store/workspaceStore'
import { useSignedUrl } from '../hooks/useSignedUrl'

export const DashboardPage = () => {
  const navigate = useNavigate()
  const { user, token, logout } = useAuthStore()
  const { activeWorkspace } = useWorkspaceStore()
  const [meetingId, setMeetingId] = useState('')
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const { data: meetings = [], isLoading: loading } = useQuery({
    queryKey: ['meetings', activeWorkspace],
    queryFn: async () => {
      const res = await axios.get('/api/meetings', {
        headers: { Authorization: `Bearer ${token}` },
        params: { organizationId: activeWorkspace === 'personal' ? null : activeWorkspace }
      })
      return res.data
    },
    enabled: !!token
  })

  const { url: resolvedAvatarUrl } = useSignedUrl(user?.avatar)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleCreateMeeting = async () => {
    const newMeetingId = Math.random().toString(36).substring(2, 9).toUpperCase()
    
    try {
      await axios.post('/api/meetings', {
        title: 'Instant Meeting',
        roomId: newMeetingId,
        scheduledAt: new Date(),
        organizationId: activeWorkspace === 'personal' ? null : activeWorkspace
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      navigate(`/meeting/${newMeetingId}`)
    } catch (error) {
      console.error('Error creating meeting:', error)
      alert('Failed to create meeting')
    }
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

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })


  return (
    <div className="min-h-screen bg-[#FAF9F7] text-[#1A1A1A]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <nav className="bg-[#FAF9F7] border-b border-[#E8E4DD] sticky top-0 z-10">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2">
              <span className="text-[#7C3AED] text-sm">●</span>
              <span className="text-lg font-semibold text-[#1A1A1A] mr-4">IntellMeet</span>
              <WorkspaceSwitcher />
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => navigate('/workspace')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[#6B6560] hover:text-[#1A1A1A] hover:bg-[#F5F2EE] transition-colors"
              >
                <LayoutGrid size={15} />
                Workspace
              </button>
              <button
                type="button"
                onClick={() => navigate('/analytics')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[#6B6560] hover:text-[#1A1A1A] hover:bg-[#F5F2EE] transition-colors"
              >
                <BarChart2 size={15} />
                Analytics
              </button>
            </div>
            <div className="flex items-center gap-3">
              {resolvedAvatarUrl ? (
                <img src={resolvedAvatarUrl} alt={user.name} className="w-8 h-8 rounded-full object-cover bg-white" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#7C3AED] text-white text-sm font-medium flex items-center justify-center">
                  {user?.name
                    ? user.name
                        .split(' ')
                        .map((part) => part[0])
                        .join('')
                        .toUpperCase()
                    : 'U'}
                </div>
              )}
              <div className="text-sm text-[#6B6560]">{user?.name || 'User'}</div>
              <button
                onClick={() => navigate('/settings')}
                title="Settings"
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-[#6B6560] hover:text-[#7C3AED] transition-colors"
              >
                <Settings size={16} />
              </button>
              <button
                onClick={handleLogout}
                title="Logout"
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-[#6B6560] hover:text-red-500 transition-colors"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </nav>

        <header className="mt-10 mb-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm text-[#6B6560] mb-1">Good morning,</p>
              <h2 className="text-3xl font-semibold text-[#1A1A1A]">{user?.name || 'User'}</h2>
            </div>
            <div className="text-sm text-[#6B6560]">{currentDate}</div>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <button
            onClick={handleCreateMeeting}
            className="group relative bg-white border border-[#E8E4DD] hover:border-[#7C3AED]/40 rounded-2xl p-6 cursor-pointer transition-all duration-200 hover:shadow-md text-left"
          >
            <div className="w-10 h-10 bg-[#7C3AED]/8 rounded-xl flex items-center justify-center mb-4">
              <Video size={20} className="text-[#7C3AED]" />
            </div>
            <div className="text-[#1A1A1A] font-semibold text-lg">Instant Meeting</div>
            <div className="text-sm text-[#6B6560] mt-1">Start right now</div>
            <ArrowUpRight size={15} className="absolute top-5 right-5 text-[#C4BDB5] group-hover:text-[#7C3AED] transition-colors" />
          </button>

          <button
            onClick={() => setShowScheduleModal(true)}
            className="group relative bg-white border border-[#E8E4DD] hover:border-[#7C3AED]/40 rounded-2xl p-6 cursor-pointer transition-all duration-200 hover:shadow-md text-left"
          >
            <div className="w-10 h-10 bg-[#10B981]/10 rounded-xl flex items-center justify-center mb-4">
              <Plus size={20} className="text-[#10B981]" />
            </div>
            <div className="text-[#1A1A1A] font-semibold text-lg">Schedule Meeting</div>
            <div className="text-sm text-[#6B6560] mt-1">Plan for later</div>
            <ArrowUpRight size={15} className="absolute top-5 right-5 text-[#C4BDB5] group-hover:text-[#7C3AED] transition-colors" />
          </button>

          <button
            onClick={() => setShowJoinModal(true)}
            className="group relative bg-white border border-[#E8E4DD] hover:border-[#7C3AED]/40 rounded-2xl p-6 cursor-pointer transition-all duration-200 hover:shadow-md text-left"
          >
            <div className="w-10 h-10 bg-[#2563EB]/10 rounded-xl flex items-center justify-center mb-4">
              <Video size={20} className="text-[#2563EB]" />
            </div>
            <div className="text-[#1A1A1A] font-semibold text-lg">Join Meeting</div>
            <div className="text-sm text-[#6B6560] mt-1">Enter with a meeting ID</div>
            <ArrowUpRight
              size={15}
              className="absolute top-5 right-5 text-[#C4BDB5] group-hover:text-[#7C3AED] transition-colors"
            />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => navigate('/workspace')}
            className="group relative bg-white border border-[#E8E4DD] hover:border-[#7C3AED]/40 rounded-2xl p-6 cursor-pointer transition-all duration-200 hover:shadow-md text-left"
          >
            <div className="w-10 h-10 bg-[#059669]/10 rounded-xl flex items-center justify-center mb-4">
              <LayoutGrid size={20} className="text-[#059669]" />
            </div>
            <div className="text-[#1A1A1A] font-semibold text-lg">
              {activeWorkspace === 'personal' ? 'My Tasks' : 'Team Workspace'}
            </div>
            <div className="text-sm text-[#6B6560] mt-1">
              {activeWorkspace === 'personal' ? 'View your personal tasks' : 'View tasks & sprint board'}
            </div>
            <ArrowUpRight
              size={15}
              className="absolute top-5 right-5 text-[#C4BDB5] group-hover:text-[#7C3AED] transition-colors"
            />
          </button>

          <button
            onClick={() => navigate('/analytics')}
            className="group relative bg-white border border-[#E8E4DD] hover:border-[#7C3AED]/40 rounded-2xl p-6 cursor-pointer transition-all duration-200 hover:shadow-md text-left"
          >
            <div className="w-10 h-10 bg-[#D97706]/10 rounded-xl flex items-center justify-center mb-4">
              <BarChart2 size={20} className="text-[#D97706]" />
            </div>
            <div className="text-[#1A1A1A] font-semibold text-lg">Analytics</div>
            <div className="text-sm text-[#6B6560] mt-1">Meeting insights & reports</div>
            <ArrowUpRight
              size={15}
              className="absolute top-5 right-5 text-[#C4BDB5] group-hover:text-[#7C3AED] transition-colors"
            />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5">
            <div className="text-2xl font-semibold text-[#1A1A1A]">{meetings.length}</div>
            <div className="text-xs text-[#6B6560] mt-1">Total meetings</div>
          </div>
          <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5">
            <div className="text-2xl font-semibold text-[#1A1A1A]">
              {meetings.reduce((acc, m) => acc + (m.participants?.length || 1), 0)}
            </div>
            <div className="text-xs text-[#6B6560] mt-1">Total participants</div>
          </div>
          <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5">
            <div className="text-2xl font-semibold text-[#1A1A1A]">0h</div>
            <div className="text-xs text-[#6B6560] mt-1">Hours this week</div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative max-w-md">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#C4BDB5]" />
            <input
              type="text"
              placeholder="Search meetings by title or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-[#E8E4DD] rounded-xl text-sm focus:outline-none focus:border-[#7C3AED] transition-colors"
            />
          </div>
        </div>

        {(() => {
          const filteredMeetings = meetings.filter(m => 
            m.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
            m.roomId?.toLowerCase().includes(searchQuery.toLowerCase())
          )
          const upcomingMeetings = filteredMeetings.filter(m => m.status !== 'completed')
          const pastMeetings = filteredMeetings.filter(m => m.status === 'completed')

          return (
            <>
              {/* Upcoming Meetings */}
              <section className="mb-10">
                <div className="text-xs font-medium uppercase tracking-wider text-[#6B6560] mb-3">
                  Upcoming & Active Meetings
                </div>
                <div className="bg-white border border-[#E8E4DD] rounded-2xl overflow-hidden divide-y divide-[#E8E4DD]">
                  {loading ? (
                    <div className="p-5 text-center text-[#6B6560]"><Loader className="animate-spin inline-block mr-2" size={16}/>Loading meetings...</div>
                  ) : upcomingMeetings.length === 0 ? (
                    <div className="p-5 text-center text-[#6B6560]">No upcoming meetings.</div>
                  ) : (
                    upcomingMeetings.map((meeting) => (
                      <button
                        key={meeting._id}
                        type="button"
                        onClick={() => navigate(`/meeting/${meeting.roomId}`)}
                        className="flex items-center justify-between px-5 py-4 hover:bg-[#F5F2EE] transition-colors cursor-pointer w-full text-left group"
                      >
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-xl bg-[#7C3AED]/10 flex items-center justify-center mr-4 group-hover:bg-[#7C3AED]/20 transition-colors">
                            <Video size={18} className="text-[#7C3AED]" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-[#1A1A1A]">{meeting.title}</div>
                            <div className="text-xs text-[#6B6560] mt-1">
                              {new Date(meeting.scheduledAt || meeting.createdAt).toLocaleString()}
                              {meeting.meetingType && meeting.meetingType !== 'other' && ` • ${meeting.meetingType}`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <span className="bg-[#F5F2EE] text-[#6B6560] text-xs px-2.5 py-1 rounded-full">
                            {meeting.participants?.length || 1} people
                          </span>
                          <span className="ml-3 text-xs text-[#7C3AED] hover:underline">Join Now</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </section>

              {/* Past Meetings */}
              <section className="mb-10">
                <div className="text-xs font-medium uppercase tracking-wider text-[#6B6560] mb-3">
                  Past Meetings
                </div>
                <div className="bg-white border border-[#E8E4DD] rounded-2xl overflow-hidden divide-y divide-[#E8E4DD]">
                  {loading ? (
                    <div className="p-5 text-center text-[#6B6560]"><Loader className="animate-spin inline-block mr-2" size={16}/>Loading meetings...</div>
                  ) : pastMeetings.length === 0 ? (
                    <div className="p-5 text-center text-[#6B6560]">No past meetings found.</div>
                  ) : (
                    pastMeetings.map((meeting) => (
                      <button
                        key={meeting._id}
                        type="button"
                        onClick={() => navigate(`/meeting/${meeting.roomId}/summary`)}
                        className="flex items-center justify-between px-5 py-4 hover:bg-[#F5F2EE] transition-colors cursor-pointer w-full text-left opacity-75 hover:opacity-100 group"
                      >
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-xl bg-[#6B6560]/10 flex items-center justify-center mr-4">
                            <Video size={18} className="text-[#6B6560]" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-[#1A1A1A]">{meeting.title}</div>
                            <div className="text-xs text-[#6B6560] mt-1">
                              {new Date(meeting.scheduledAt || meeting.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <span className="bg-[#F5F2EE] text-[#6B6560] text-xs px-2.5 py-1 rounded-full">
                            {meeting.participants?.length || 1} people
                          </span>
                          <span className="ml-3 text-xs text-[#6B6560] group-hover:text-[#1A1A1A]">View summary</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </section>
            </>
          )
        })()}

        {showJoinModal && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-[#E8E4DD] rounded-2xl w-full max-w-sm p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-[#1A1A1A]">Join a meeting</h2>
              <p className="text-sm text-[#6B6560] mt-1 mb-5">Enter the meeting ID below</p>
              <input
                type="text"
                value={meetingId}
                onChange={(e) => setMeetingId(e.target.value.toUpperCase())}
                placeholder="Enter meeting ID"
                className="w-full bg-[#FAF9F7] border border-[#E8E4DD] text-[#1A1A1A] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#7C3AED] placeholder-[#C4BDB5] font-mono tracking-widest uppercase"
                onKeyPress={(e) => e.key === 'Enter' && handleJoinMeeting()}
              />
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 border border-[#E8E4DD] text-[#6B6560] hover:bg-[#F5F2EE] rounded-xl py-2.5 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleJoinMeeting}
                  className="flex-1 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl py-2.5 text-sm font-medium transition"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        )}

        <ScheduleMeetingModal 
          isOpen={showScheduleModal} 
          onClose={() => setShowScheduleModal(false)}
          onSchedule={(newMeetingId) => {
            setShowScheduleModal(false);
            navigate(`/meeting/${newMeetingId}`);
          }}
        />
      </div>
    </div>
  )
}
