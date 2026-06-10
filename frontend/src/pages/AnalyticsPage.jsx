import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, TrendingUp, Users, Clock, Video, BarChart2, Calendar } from 'lucide-react'

export const AnalyticsPage = () => {
  const navigate = useNavigate()
  const [selectedRange] = useState('This week')

  const mockData = {
    totalMeetings: 24,
    totalHours: 18.5,
    totalParticipants: 87,
    avgDuration: 46,
    meetingsThisWeek: [
      { day: 'Mon', count: 3 },
      { day: 'Tue', count: 5 },
      { day: 'Wed', count: 2 },
      { day: 'Thu', count: 7 },
      { day: 'Fri', count: 4 },
      { day: 'Sat', count: 1 },
      { day: 'Sun', count: 0 },
    ],
    topParticipants: [
      { name: 'Alice Johnson', initials: 'AJ', meetings: 18, hours: 14.2 },
      { name: 'Bob Smith', initials: 'BS', meetings: 15, hours: 11.8 },
      { name: 'Carol White', initials: 'CW', meetings: 12, hours: 9.5 },
      { name: 'You', initials: 'Y', meetings: 24, hours: 18.5 },
    ],
    recentActivity: [
      { title: 'Weekly Sync', date: 'Today, 10:00 AM', duration: '45 min', participants: 4 },
      { title: 'Design Review', date: 'Yesterday, 2:00 PM', duration: '30 min', participants: 6 },
      { title: 'Sprint Planning', date: 'Mon, 9:00 AM', duration: '60 min', participants: 8 },
      { title: 'Backend Sync', date: 'Last week', duration: '25 min', participants: 3 },
      { title: 'Client Demo', date: 'Last week', duration: '50 min', participants: 10 },
    ],
    meetingsByType: [
      { type: 'Team Sync', count: 10, color: '#7C3AED' },
      { type: 'Design Review', count: 6, color: '#2563EB' },
      { type: 'Planning', count: 5, color: '#D97706' },
      { type: 'Client', count: 3, color: '#059669' },
    ],
  }

  const maxCount = Math.max(...mockData.meetingsThisWeek.map((d) => d.count), 1)
  const totalMeetings = mockData.totalMeetings || 1

  return (
    <div className="min-h-screen bg-[#FAF9F7]">
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

      <div className="max-w-6xl mx-auto px-6 pt-6 pb-0">
        <h1 className="text-2xl font-semibold text-[#1A1A1A]">Analytics</h1>
        <p className="text-sm text-[#6B6560] mt-1">Your meeting insights</p>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-[#7C3AED]/10 text-[#7C3AED]">
              <Video size={18} />
            </div>
            <div className="text-2xl font-semibold text-[#1A1A1A]">{mockData.totalMeetings}</div>
            <div className="text-xs text-[#6B6560] mt-1">Total meetings</div>
          </div>
          <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-[#2563EB]/10 text-[#2563EB]">
              <Clock size={18} />
            </div>
            <div className="text-2xl font-semibold text-[#1A1A1A]">{mockData.totalHours}h</div>
            <div className="text-xs text-[#6B6560] mt-1">Total hours</div>
          </div>
          <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-[#059669]/10 text-[#059669]">
              <Users size={18} />
            </div>
            <div className="text-2xl font-semibold text-[#1A1A1A]">{mockData.totalParticipants}</div>
            <div className="text-xs text-[#6B6560] mt-1">Participants</div>
          </div>
          <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-[#D97706]/10 text-[#D97706]">
              <TrendingUp size={18} />
            </div>
            <div className="text-2xl font-semibold text-[#1A1A1A]">{mockData.avgDuration}m</div>
            <div className="text-xs text-[#6B6560] mt-1">Avg duration</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 space-y-5">
            <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#1A1A1A]">
                  <BarChart2 size={16} className="text-[#7C3AED]" />
                  Meetings this week
                </div>
                <span className="text-xs text-[#6B6560]">{selectedRange}</span>
              </div>
              <p className="text-xs text-[#6B6560] mt-0.5 mb-5">Daily meeting frequency</p>
              <div className="flex items-end justify-between gap-2 h-36">
                {mockData.meetingsThisWeek.map((day) => {
                  const height = day.count === 0 ? 6 : (day.count / maxCount) * 100
                  return (
                    <div key={day.day} className="flex flex-col items-center gap-2 flex-1">
                      {day.count > 0 ? (
                        <span className="text-xs font-medium text-[#6B6560] mb-1">{day.count}</span>
                      ) : (
                        <span className="text-xs text-transparent mb-1">0</span>
                      )}
                      <div
                        className={`w-full rounded-t-lg ${day.count === maxCount ? 'bg-[#7C3AED]' : 'bg-[#E8E4DD]'}`}
                        style={{ height: `${height}%` }}
                      />
                      <span className="text-xs text-[#6B6560]">{day.day}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5">
              <div className="text-sm font-semibold text-[#1A1A1A]">Meeting types</div>
              <p className="text-xs text-[#6B6560] mt-0.5 mb-4">Distribution by category</p>
              <div>
                {mockData.meetingsByType.map((type) => {
                  const width = `${(type.count / totalMeetings) * 100}%`
                  return (
                    <div key={type.type} className="flex items-center gap-3 mb-3 last:mb-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: type.color }}
                      />
                      <span className="text-sm text-[#1A1A1A] flex-1">{type.type}</span>
                      <div className="flex-1 bg-[#F5F2EE] rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-1.5 rounded-full"
                          style={{ width, backgroundColor: type.color }}
                        />
                      </div>
                      <span className="text-xs text-[#6B6560] ml-2">{type.count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="col-span-1 space-y-5">
            <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-[#1A1A1A] mb-4">Top participants</h2>
              <div>
                {mockData.topParticipants.map((participant) => (
                  <div
                    key={participant.name}
                    className="flex items-center gap-3 py-2 border-b border-[#E8E4DD] last:border-0"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] text-xs font-semibold flex items-center justify-center">
                      {participant.initials}
                    </div>
                    <div>
                      <p className="text-sm text-[#1A1A1A]">{participant.name}</p>
                      <p className="text-xs text-[#6B6560]">{participant.meetings} meetings</p>
                    </div>
                    <div className="ml-auto text-xs font-medium text-[#1A1A1A]">
                      {participant.hours}h
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-[#1A1A1A] mb-4">Recent activity</h2>
              <div>
                {mockData.recentActivity.map((activity) => (
                  <div
                    key={activity.title}
                    className="flex items-start gap-3 py-2 border-b border-[#E8E4DD] last:border-0"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED] mt-1.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-[#1A1A1A]">{activity.title}</p>
                      <p className="text-xs text-[#6B6560] mt-0.5">{activity.date}</p>
                    </div>
                    <span className="bg-[#F5F2EE] text-[#6B6560] text-xs px-2 py-0.5 rounded-full">
                      {activity.duration}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
