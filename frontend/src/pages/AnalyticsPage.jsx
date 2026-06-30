import { useState } from 'react'
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

  const totalMeetings = analyticsData?.totalMeetings || 1

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

      <div className="max-w-6xl mx-auto px-6 pt-6 pb-0 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A1A1A]">Analytics</h1>
          <p className="text-sm text-[#6B6560] mt-1">Your meeting insights</p>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={selectedRange} 
            onChange={(e) => setSelectedRange(e.target.value)}
            className="px-4 py-2 border border-[#E8E4DD] rounded-xl text-sm font-medium text-[#1A1A1A] outline-none hover:bg-[#F5F2EE] transition cursor-pointer"
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
            className="px-4 py-2 bg-[#1A1A1A] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition shadow-sm"
          >
            Export as CSV
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {loading || !analyticsData ? (
          <div className="flex items-center justify-center py-20 text-[#6B6560]">
            <Loader className="animate-spin mr-2" />
            Loading analytics...
          </div>
        ) : (
          <>
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-[#7C3AED]/10 text-[#7C3AED]">
              <Video size={18} />
            </div>
            <div className="text-2xl font-semibold text-[#1A1A1A]">{analyticsData.totalMeetings}</div>
            <div className="text-xs text-[#6B6560] mt-1">Total meetings</div>
          </div>
          <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-[#2563EB]/10 text-[#2563EB]">
              <Clock size={18} />
            </div>
            <div className="text-2xl font-semibold text-[#1A1A1A]">{analyticsData.totalHours}h</div>
            <div className="text-xs text-[#6B6560] mt-1">Total hours</div>
          </div>
          <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-[#059669]/10 text-[#059669]">
              <Users size={18} />
            </div>
            <div className="text-2xl font-semibold text-[#1A1A1A]">{analyticsData.totalParticipants}</div>
            <div className="text-xs text-[#6B6560] mt-1">Participants</div>
          </div>
          <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-[#D97706]/10 text-[#D97706]">
              <TrendingUp size={18} />
            </div>
            <div className="text-2xl font-semibold text-[#1A1A1A]">{analyticsData.avgDuration}m</div>
            <div className="text-xs text-[#6B6560] mt-1">Avg duration</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-[#1A1A1A]">Participation Rate</div>
              <div className="text-xs text-[#6B6560] mt-1">Meetings attended</div>
            </div>
            <div className="text-3xl font-bold text-[#059669]">{analyticsData.participationRate}%</div>
          </div>
          <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-[#1A1A1A]">Task Completion</div>
              <div className="text-xs text-[#6B6560] mt-1">{analyticsData.completedTasks} of {analyticsData.totalTasks} tasks done</div>
            </div>
            <div className="text-3xl font-bold text-[#7C3AED]">{analyticsData.taskCompletionRate}%</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-5 mt-4">
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
              <div className="flex items-end justify-between gap-2 h-48 mt-4">
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

            <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5">
              <div className="text-sm font-semibold text-[#1A1A1A]">Meeting types</div>
              <p className="text-xs text-[#6B6560] mt-0.5 mb-4">Distribution by category</p>
              <div className="flex items-center gap-6 mt-4">
                <div className="w-32 h-32 flex-shrink-0">
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
                    <div key={type.name} className="flex items-center justify-between mb-3 last:mb-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
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

          <div className="col-span-1 space-y-5">
            <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-[#1A1A1A] mb-4">Top participants</h2>
              <div>
                {analyticsData.topParticipants.length === 0 && (
                  <p className="text-xs text-[#6B6560]">No participants yet.</p>
                )}
                {analyticsData.topParticipants.map((participant) => (
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
                {analyticsData.recentActivity.length === 0 && (
                  <p className="text-xs text-[#6B6560]">No recent activity.</p>
                )}
                {analyticsData.recentActivity.map((activity) => (
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
        </>
        )}
      </div>
    </div>
  )
}
