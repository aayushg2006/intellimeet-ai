import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, TrendingUp, Users, Clock, Video, BarChart2, Loader } from 'lucide-react'
import axios from 'axios'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid
} from 'recharts'
import { useAuthStore } from '../store/authStore'
import { useWorkspaceStore } from '../store/workspaceStore'

export const AnalyticsPage = () => {
  const navigate = useNavigate()
  const [selectedRange, setSelectedRange] = useState('This week')

  useEffect(() => { document.title = 'Analytics — IntellMeet' }, [])

  const { token } = useAuthStore()
  const { activeWorkspace } = useWorkspaceStore()

  const { data: rawData = null, isLoading: loading } = useQuery({
    queryKey: ['analytics', activeWorkspace, selectedRange],
    queryFn: async () => {
      const res = await axios.get('/api/analytics', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          organizationId: activeWorkspace === 'personal' ? null : activeWorkspace,
          timeRange: selectedRange
        }
      })
      return res.data
    },
    enabled: !!token
  })

  const analyticsData = rawData ? {
    totalMeetings: rawData.totalMeetings || 0,
    totalHours: rawData.totalHours || 0,
    totalParticipants: rawData.totalParticipants || 0,
    avgDuration: rawData.avgDuration || 0,
    meetingsThisWeek: rawData.meetingsThisWeek || [],
    meetingsByType: rawData.meetingsByType || [],
    topParticipants: rawData.topParticipants || [],
    recentActivity: rawData.recentActivity || [],
    participationRate: rawData.participationRate || 0,
    taskCompletionRate: rawData.taskCompletionRate || 0,
    totalTasks: rawData.totalTasks || 0,
    completedTasks: rawData.completedTasks || 0
  } : null

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-white via-[#FAF9F7] to-[#F3F0FF] text-[#1A1A1A]">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute left-[-3rem] top-10 h-[24rem] w-[24rem] rounded-full bg-gradient-to-br from-[#C4B5FD] via-[#93C5FD] to-[#E0E7FF] blur-3xl opacity-50" />
        <div className="absolute right-[-2rem] top-[-2rem] h-[22rem] w-[28rem] rounded-[45%] bg-gradient-to-br from-[#C4B5FD] via-[#93C5FD] to-[#E0E7FF] blur-3xl opacity-45" />
        <div className="absolute bottom-0 right-[8%] h-[18rem] w-[22rem] rounded-[40%] bg-gradient-to-br from-[#93C5FD] via-[#BFDBFE] to-white blur-3xl opacity-40" />
      </div>

      <div className="relative z-10">
        <div className="sticky top-0 z-50 border-b border-white/10 bg-white/60 backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-2 font-semibold text-[#1A1A1A]">
              <img src="/logo.png" alt="IntellMeet" className="h-8 w-auto" />
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-sm text-[#6B6560] transition hover:text-[#1A1A1A]"
            >
              <ArrowLeft size={16} />
              Back to dashboard
            </button>
          </div>
        </div>

        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-6 pt-8 pb-0">
          <div>
            <h1 className="text-2xl font-semibold text-[#1A1A1A]">Analytics</h1>
            <p className="mt-1 text-sm text-[#6B6560]">Your meeting insights</p>
          </div>
          <div className="flex items-center gap-3">
            <select 
              value={selectedRange} 
              onChange={(e) => setSelectedRange(e.target.value)}
              className="cursor-pointer rounded-xl border border-[#E8E4DD] bg-white/80 px-4 py-2 text-sm font-medium text-[#1A1A1A] outline-none transition hover:bg-[#F5F2EE]"
            >
              <option value="This week">This week</option>
              <option value="This month">This month</option>
              <option value="All time">All time</option>
            </select>
            <button 
              onClick={() => {
                if (analyticsData) {
                  const csvRows = [
                    ['Metric', 'Value'],
                    ['Total Meetings', analyticsData.totalMeetings],
                    ['Total Hours', analyticsData.totalHours],
                    ['Total Participants', analyticsData.totalParticipants],
                    ['Average Duration (m)', analyticsData.avgDuration]
                  ];
                  const csvString = csvRows.map(r => r.join(',')).join('\n');
                  const blob = new Blob([csvString], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.setAttribute('hidden', '');
                  a.setAttribute('href', url);
                  a.setAttribute('download', `intellimeet_analytics_${activeWorkspace || 'personal'}.csv`);
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }
              }}
              className="rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:from-[#6D28D9] hover:to-[#5B21B6]"
            >
              Export as CSV
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-6xl space-y-6 px-6 py-6">
          {loading || !analyticsData ? (
            <div className="flex items-center justify-center py-20 text-[#6B6560]">
              <Loader className="mr-2 animate-spin" />
              Loading analytics...
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-[#E8E4DD] bg-white/90 p-5 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.25)] backdrop-blur-sm">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#7C3AED]/10 to-[#2563EB]/10 text-[#7C3AED]">
                    <Video size={18} />
                  </div>
                  <div className="text-2xl font-semibold text-[#1A1A1A]">{analyticsData.totalMeetings}</div>
                  <div className="mt-1 text-xs text-[#6B6560]">Total meetings</div>
                </div>
                <div className="rounded-2xl border border-[#E8E4DD] bg-white/90 p-5 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.25)] backdrop-blur-sm">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB]/10 to-[#7C3AED]/10 text-[#2563EB]">
                    <Clock size={18} />
                  </div>
                  <div className="text-2xl font-semibold text-[#1A1A1A]">{analyticsData.totalHours}h</div>
                  <div className="mt-1 text-xs text-[#6B6560]">Total hours</div>
                </div>
                <div className="rounded-2xl border border-[#E8E4DD] bg-white/90 p-5 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.25)] backdrop-blur-sm">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#059669]/10 to-[#2563EB]/10 text-[#059669]">
                    <Users size={18} />
                  </div>
                  <div className="text-2xl font-semibold text-[#1A1A1A]">{analyticsData.totalParticipants}</div>
                  <div className="mt-1 text-xs text-[#6B6560]">Participants</div>
                </div>
                <div className="rounded-2xl border border-[#E8E4DD] bg-white/90 p-5 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.25)] backdrop-blur-sm">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#D97706]/10 to-[#F59E0B]/10 text-[#D97706]">
                    <TrendingUp size={18} />
                  </div>
                  <div className="text-2xl font-semibold text-[#1A1A1A]">{analyticsData.avgDuration}m</div>
                  <div className="mt-1 text-xs text-[#6B6560]">Avg duration</div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-[#E8E4DD] bg-white/90 p-5 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.25)] backdrop-blur-sm">
                  <div className="text-sm font-semibold text-[#1A1A1A]">Participation Rate</div>
                  <div className="mt-1 text-xs text-[#6B6560]">Meetings attended</div>
                  <div className="mt-4 text-3xl font-bold text-[#059669]">{analyticsData.participationRate}%</div>
                </div>
                <div className="rounded-2xl border border-[#E8E4DD] bg-white/90 p-5 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.25)] backdrop-blur-sm">
                  <div className="text-sm font-semibold text-[#1A1A1A]">Task Completion</div>
                  <div className="mt-1 text-xs text-[#6B6560]">{analyticsData.completedTasks} of {analyticsData.totalTasks} tasks done</div>
                  <div className="mt-4 text-3xl font-bold text-[#7C3AED]">{analyticsData.taskCompletionRate}%</div>
                </div>
              </div>

              <div className="mt-4 grid gap-5 xl:grid-cols-[1.6fr_0.8fr]">
                <div className="space-y-5">
                  <div className="rounded-2xl border border-[#E8E4DD] bg-white/90 p-5 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.25)] backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#1A1A1A]">
                        <BarChart2 size={16} className="text-[#7C3AED]" />
                        Meetings this week
                      </div>
                      <span className="text-xs text-[#6B6560]">{selectedRange}</span>
                    </div>
                    <p className="mt-0.5 mb-5 text-xs text-[#6B6560]">Daily meeting frequency</p>
                    <div className="mt-4 flex h-48 items-end justify-between gap-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analyticsData.meetingsThisWeek}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8E4DD" />
                          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#6B6560', fontSize: 12}} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B6560', fontSize: 12}} dx={-10} allowDecimals={false} />
                          <RechartsTooltip cursor={{fill: '#F5F2EE'}} contentStyle={{borderRadius: '12px', border: '1px solid #E8E4DD', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                          <Bar dataKey="count" fill="#7C3AED" radius={[4, 4, 0, 0]} barSize={32} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#E8E4DD] bg-white/90 p-5 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.25)] backdrop-blur-sm">
                    <div className="text-sm font-semibold text-[#1A1A1A]">Meeting types</div>
                    <p className="mt-0.5 mb-4 text-xs text-[#6B6560]">Distribution by category</p>
                    <div className="mt-4 flex items-center gap-6">
                      <div className="h-32 w-32 flex-shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={analyticsData.meetingsByType}
                              innerRadius={30}
                              outerRadius={60}
                              paddingAngle={2}
                              dataKey="value"
                            >
                              {analyticsData.meetingsByType.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Pie>
                            <RechartsTooltip contentStyle={{borderRadius: '12px', border: '1px solid #E8E4DD'}} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      
                      <div className="flex-1">
                        {analyticsData.meetingsByType.length === 0 && (
                          <p className="text-xs text-[#6B6560]">No data available.</p>
                        )}
                        {analyticsData.meetingsByType.map((type) => (
                          <div key={type.name} className="mb-3 flex items-center justify-between last:mb-0">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: type.fill }}
                              />
                              <span className="text-sm text-[#1A1A1A]">{type.name}</span>
                            </div>
                            <span className="text-sm font-semibold text-[#1A1A1A]">{type.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-2xl border border-[#E8E4DD] bg-white/90 p-5 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.25)] backdrop-blur-sm">
                    <h2 className="mb-4 text-sm font-semibold text-[#1A1A1A]">Top participants</h2>
                    <div>
                      {analyticsData.topParticipants.length === 0 && (
                        <p className="text-xs text-[#6B6560]">No participants yet.</p>
                      )}
                      {analyticsData.topParticipants.map((participant) => (
                        <div
                          key={participant.name}
                          className="flex items-center gap-3 border-b border-[#E8E4DD] py-2 last:border-0"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7C3AED]/10 text-xs font-semibold text-[#7C3AED]">
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

                  <div className="rounded-2xl border border-[#E8E4DD] bg-white/90 p-5 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.25)] backdrop-blur-sm">
                    <h2 className="mb-4 text-sm font-semibold text-[#1A1A1A]">Recent activity</h2>
                    <div>
                      {analyticsData.recentActivity.length === 0 && (
                        <p className="text-xs text-[#6B6560]">No recent activity.</p>
                      )}
                      {analyticsData.recentActivity.map((activity) => (
                        <div
                          key={activity.title}
                          className="flex items-start gap-3 border-b border-[#E8E4DD] py-2 last:border-0"
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#7C3AED]" />
                          <div className="flex-1">
                            <p className="text-sm text-[#1A1A1A]">{activity.title}</p>
                            <p className="mt-0.5 text-xs text-[#6B6560]">{activity.date}</p>
                          </div>
                          <span className="rounded-full bg-[#F5F2EE] px-2 py-0.5 text-xs text-[#6B6560]">
                            {activity.duration}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
