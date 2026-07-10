import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { LogOut, Video, Plus, ArrowUpRight, LayoutGrid, BarChart2, Loader, Settings, Search } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { WorkspaceSwitcher } from '../components/WorkspaceSwitcher'
import { ScheduleMeetingModal } from '../components/ScheduleMeetingModal'
import { useWorkspaceStore } from '../store/workspaceStore'
import { useSignedUrl } from '../hooks/useSignedUrl'
import { formatMeetingDate, getMeetingAccessDetails, getMeetingAccessLabel, getMeetingTypeLabel } from '../utils/meetingDisplay'

export const DashboardPage = () => {
  const navigate = useNavigate()
  const { user, token, logout } = useAuthStore()
  const { activeWorkspace } = useWorkspaceStore()
  const queryClient = useQueryClient()
  const [meetingId, setMeetingId] = useState('')
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showInstantModal, setShowInstantModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => { document.title = 'Dashboard — IntellMeet' }, [])

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

  const handleJoinMeeting = () => {
    if (!meetingId.trim()) {
      toast.dismiss()
      toast.error('Please enter a meeting ID')
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
    <div className="relative min-h-screen overflow-x-hidden overflow-y-visible bg-gradient-to-br from-white via-[#FAF9F7] to-[#F3F0FF] text-[#1A1A1A]">
      <div className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-hidden">
        <div className="absolute -left-16 top-16 h-[34rem] w-[34rem] rounded-full bg-gradient-to-br from-[#C4B5FD] via-[#93C5FD] to-[#E0E7FF] blur-2xl opacity-70" />
        <div className="absolute right-[-4rem] top-[-2rem] h-[30rem] w-[36rem] rounded-[45%] bg-gradient-to-br from-[#C4B5FD] via-[#93C5FD] to-[#E0E7FF] blur-2xl opacity-65" />
        <div className="absolute bottom-0 right-[-2rem] h-[24rem] w-[30rem] rounded-[40%] bg-gradient-to-br from-[#93C5FD] via-[#BFDBFE] to-white blur-2xl opacity-60" />
      </div>

      <nav className="sticky top-0 z-50 w-full overflow-visible border-b border-white/10 bg-white/40 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="IntellMeet" className="mr-4 h-8 w-auto" />
            <WorkspaceSwitcher />
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigate('/workspace')}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-[#6B6560] transition-colors hover:bg-[#F5F2EE] hover:text-[#1A1A1A]"
            >
              <LayoutGrid size={15} />
              Workspace
            </button>
            <button
              type="button"
              onClick={() => navigate('/analytics')}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-[#6B6560] transition-colors hover:bg-[#F5F2EE] hover:text-[#1A1A1A]"
            >
              <BarChart2 size={15} />
              Analytics
            </button>
          </div>
          <div className="flex items-center gap-3">
            {resolvedAvatarUrl ? (
              <img src={resolvedAvatarUrl} alt={user.name} className="h-8 w-8 rounded-full object-cover bg-white" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7C3AED] text-sm font-medium text-white">
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
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[#6B6560] transition-colors hover:text-[#7C3AED]"
            >
              <Settings size={16} />
            </button>
            <button
              onClick={handleLogout}
              title="Logout"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[#6B6560] transition-colors hover:text-red-500"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </nav>

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-8">
        <header className="mb-8 mt-2">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm text-[#6B6560] mb-1">
                {(() => {
                  const hour = new Date().getHours();
                  if (hour < 12) return 'Good morning,';
                  if (hour < 17) return 'Good afternoon,';
                  return 'Good evening,';
                })()}
              </p>
              <h2 className="text-3xl font-semibold text-[#1A1A1A]">{user?.name || 'User'}</h2>
            </div>
            <div className="text-sm text-[#6B6560]">{currentDate}</div>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <button
            onClick={() => setShowInstantModal(true)}
            className="group relative rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#4C1D95] p-6 text-left text-white shadow-lg shadow-purple-900/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-purple-900/30"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <Video size={20} className="text-white" />
            </div>
            <div className="text-lg font-semibold text-white">Instant Meeting</div>
            <div className="mt-1 text-sm text-white/70">Start right now</div>
            <ArrowUpRight size={15} className="absolute right-5 top-5 text-white/60 transition-colors group-hover:text-white/90" />
          </button>

          <button
            onClick={() => setShowScheduleModal(true)}
            className="group relative rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#1E3A8A] p-6 text-left text-white shadow-lg shadow-blue-900/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-900/30"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <Plus size={20} className="text-white" />
            </div>
            <div className="text-lg font-semibold text-white">Schedule Meeting</div>
            <div className="mt-1 text-sm text-white/70">Plan for later</div>
            <ArrowUpRight size={15} className="absolute right-5 top-5 text-white/60 transition-colors group-hover:text-white/90" />
          </button>

          <button
            onClick={() => setShowJoinModal(true)}
            className="group relative rounded-2xl bg-gradient-to-br from-[#6D28D9] to-[#2563EB] p-6 text-left text-white shadow-lg shadow-indigo-900/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-900/30"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <Video size={20} className="text-white" />
            </div>
            <div className="text-lg font-semibold text-white">Join Meeting</div>
            <div className="mt-1 text-sm text-white/70">Enter with a meeting ID</div>
            <ArrowUpRight size={15} className="absolute right-5 top-5 text-white/60 transition-colors group-hover:text-white/90" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => navigate('/workspace')}
            className="group relative rounded-2xl border border-[#E8E4DD] bg-white p-6 text-left shadow-sm transition-all duration-200 hover:shadow-[0_0_0_1px_rgba(124,58,237,0.1),0_10px_30px_rgba(124,58,237,0.06)]"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#059669]/10 to-[#7C3AED]/10">
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
            className="group relative rounded-2xl border border-[#E8E4DD] bg-white p-6 text-left shadow-sm transition-all duration-200 hover:shadow-[0_0_0_1px_rgba(124,58,237,0.1),0_10px_30px_rgba(124,58,237,0.06)]"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#D97706]/10 to-[#2563EB]/10">
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

        <div className="mb-8 grid grid-cols-3 gap-4">
          <div className="rounded-2xl border border-[#E8E4DD] bg-white p-5 shadow-sm">
            <div className="h-0.5 w-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#2563EB]" />
            <div className="mt-4 text-2xl font-semibold text-[#1A1A1A]">{meetings.length}</div>
            <div className="mt-1 text-xs text-[#6B6560]">Total meetings</div>
          </div>
          <div className="rounded-2xl border border-[#E8E4DD] bg-white p-5 shadow-sm">
            <div className="h-0.5 w-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#2563EB]" />
            <div className="mt-4 text-2xl font-semibold text-[#1A1A1A]">
              {meetings.reduce((acc, m) => acc + (m.participants?.length || 1), 0)}
            </div>
            <div className="mt-1 text-xs text-[#6B6560]">Total participants</div>
          </div>
          <div className="rounded-2xl border border-[#E8E4DD] bg-white p-5 shadow-sm">
            <div className="h-0.5 w-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#2563EB]" />
            <div className="mt-4 text-2xl font-semibold text-[#1A1A1A]">0h</div>
            <div className="mt-1 text-xs text-[#6B6560]">Hours this week</div>
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
          const ONE_DAY = 24 * 60 * 60 * 1000;
          const now = new Date().getTime();

          const upcomingMeetings = filteredMeetings.filter((m) => {
            if (m.status === 'completed') return false
            if (m.status === 'ongoing') return true
            const meetingDate = new Date(m.scheduledAt || m.createdAt).getTime()
            return meetingDate >= now - ONE_DAY
          })

          const pastMeetings = filteredMeetings.filter((m) => {
            if (m.status === 'completed') return true
            if (m.status === 'ongoing') return false
            const meetingDate = new Date(m.scheduledAt || m.createdAt).getTime()
            return meetingDate < now - ONE_DAY
          })

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
                              {formatMeetingDate(meeting.scheduledAt || meeting.createdAt)}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="bg-[#F5F2EE] text-[#6B6560] text-[11px] px-2 py-1 rounded-full">
                                {getMeetingTypeLabel(meeting.meetingType)}
                              </span>
                              <span className="bg-[#EEF2FF] text-[#4338CA] text-[11px] px-2 py-1 rounded-full">
                                {getMeetingAccessLabel(meeting)}
                              </span>
                              {getMeetingAccessDetails(meeting).teams.map((teamName) => (
                                <span key={`${meeting._id}-team-${teamName}`} className="bg-[#ECFDF5] text-[#059669] text-[11px] px-2 py-1 rounded-full">
                                  Team: {teamName}
                                </span>
                              ))}
                              {getMeetingAccessDetails(meeting).people.length > 0 && (
                                <span className="bg-[#FEF3C7] text-[#D97706] text-[11px] px-2 py-1 rounded-full">
                                  {getMeetingAccessDetails(meeting).people.length} people
                                </span>
                              )}
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
                              {formatMeetingDate(meeting.scheduledAt || meeting.createdAt)}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="bg-[#F5F2EE] text-[#6B6560] text-[11px] px-2 py-1 rounded-full">
                                {getMeetingTypeLabel(meeting.meetingType)}
                              </span>
                              <span className="bg-[#EEF2FF] text-[#4338CA] text-[11px] px-2 py-1 rounded-full">
                                {getMeetingAccessLabel(meeting)}
                              </span>
                              {getMeetingAccessDetails(meeting).teams.map((teamName) => (
                                <span key={`${meeting._id}-past-team-${teamName}`} className="bg-[#ECFDF5] text-[#059669] text-[11px] px-2 py-1 rounded-full">
                                  Team: {teamName}
                                </span>
                              ))}
                              {getMeetingAccessDetails(meeting).people.length > 0 && (
                                <span className="bg-[#FEF3C7] text-[#D97706] text-[11px] px-2 py-1 rounded-full">
                                  {getMeetingAccessDetails(meeting).people.length} people
                                </span>
                              )}
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
          key={`scheduled-${activeWorkspace}-${showScheduleModal ? 'open' : 'closed'}`}
          isOpen={showScheduleModal} 
          onClose={() => setShowScheduleModal(false)}
          mode="scheduled"
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['meetings', activeWorkspace] })
            toast.success('Meeting scheduled')
          }}
        />

        <ScheduleMeetingModal
          key={`instant-${activeWorkspace}-${showInstantModal ? 'open' : 'closed'}`}
          isOpen={showInstantModal}
          onClose={() => setShowInstantModal(false)}
          mode="instant"
          onCreated={(meeting) => {
            queryClient.invalidateQueries({ queryKey: ['meetings', activeWorkspace] })
            navigate(`/meeting/${meeting.roomId}`)
          }}
        />
      </div>
    </div>
  )
}
