import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  ArrowLeft,
  Clock,
  Users,
  FileText,
  CheckSquare,
  Download,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react'

export const MeetingSummary = () => {
  const navigate = useNavigate()
  const { meetingId } = useParams()
  const { user } = useAuthStore()

  const mockSummary = {
    title: 'Weekly Sync',
    date: new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    duration: '45 minutes',
    participants: ['Alice Johnson', 'Bob Smith', 'Carol White', 'You'],
    summary:
      'The team discussed Q3 progress and identified key blockers. Frontend development is on track with the new dashboard design approved. Backend API integration is delayed by one week due to WebRTC complexity. The team agreed to extend the sprint by 3 days.',
    actionItems: [
      {
        id: 1,
        task: 'Fix WebRTC peer connection logic',
        assignee: 'Bob Smith',
        due: 'Tomorrow',
        done: false,
      },
      {
        id: 2,
        task: 'Deploy frontend to Vercel staging',
        assignee: 'You',
        due: 'Today',
        done: false,
      },
      {
        id: 3,
        task: 'Update API documentation',
        assignee: 'Carol White',
        due: 'Friday',
        done: true,
      },
      {
        id: 4,
        task: 'Review pull request #42',
        assignee: 'Alice Johnson',
        due: 'Today',
        done: false,
      },
    ],
    transcript: [
      {
        speaker: 'Alice Johnson',
        time: '0:01',
        text: "Good morning everyone, let's get started with the weekly sync.",
      },
      {
        speaker: 'Bob Smith',
        time: '0:45',
        text: "I've been working on the WebRTC integration, it's more complex than expected.",
      },
      {
        speaker: 'Carol White',
        time: '2:10',
        text: 'The API documentation needs to be updated before we can proceed with testing.',
      },
      {
        speaker: 'You',
        time: '3:30',
        text: 'I can handle the frontend deployment to staging by end of day.',
      },
      {
        speaker: 'Alice Johnson',
        time: '5:15',
        text: "Great, let's extend the sprint by 3 days to accommodate the delays.",
      },
    ],
  }

  const [actionItems, setActionItems] = useState(mockSummary.actionItems)
  const [showTranscript, setShowTranscript] = useState(false)
  const [copied, setCopied] = useState(false)

  const toggleAction = (id) => {
    setActionItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item
      )
    )
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mockSummary.summary)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Copy failed', error)
    }
  }

  const handleBack = () => {
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#FAF9F7]">
      <div className="border-b border-[#E8E4DD] bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[#1A1A1A] font-semibold">
          <span className="text-[#7C3AED]">●</span>
          IntellMeet
        </div>
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-sm text-[#6B6560] hover:text-[#1A1A1A] transition"
        >
          <ArrowLeft size={16} />
          Back to dashboard
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-6 pt-6 pb-10">
        <div className="pb-6 border-b border-[#E8E4DD]">
          <h1 className="text-2xl font-semibold text-[#1A1A1A]">{mockSummary.title}</h1>
          <div className="flex flex-wrap gap-4 mt-3">
            <span className="bg-white border border-[#E8E4DD] text-[#6B6560] text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
              {mockSummary.date}
            </span>
            <span className="bg-white border border-[#E8E4DD] text-[#6B6560] text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <Clock size={14} />
              {mockSummary.duration}
            </span>
            <span className="bg-white border border-[#E8E4DD] text-[#6B6560] text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <Users size={14} />
              {mockSummary.participants.length} participants
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-5 mt-6 items-start">
          <div className="col-span-2 space-y-5">
            <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5">
              <div className="flex items-center justify-between gap-4 pb-3 border-b border-[#E8E4DD] mb-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#1A1A1A]">
                  <span>AI Summary</span>
                  <FileText size={16} className="text-[#7C3AED]" />
                </div>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 text-xs text-[#6B6560] hover:text-[#1A1A1A] transition"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy summary'}
                </button>
              </div>
              <p className="text-sm text-[#6B6560] leading-relaxed pt-3">
                {mockSummary.summary}
              </p>
              <div className="bg-[#7C3AED]/8 text-[#7C3AED] text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1 mt-4">
                ✦ Generated by AI
              </div>
            </div>

            <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5">
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#E8E4DD]">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#1A1A1A]">
                  <CheckSquare size={16} className="text-[#7C3AED]" />
                  Action Items
                </div>
                <span className="bg-[#F5F2EE] text-[#6B6560] text-xs px-2 py-0.5 rounded-full">
                  {actionItems.length}
                </span>
              </div>
              <div className="mt-0 space-y-3">
                {actionItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 py-3 border-b border-[#E8E4DD] last:border-0"
                  >
                    <button
                      type="button"
                      onClick={() => toggleAction(item.id)}
                      className={`w-5 h-5 rounded-full flex-shrink-0 mt-0.5 cursor-pointer flex items-center justify-center ${
                        item.done
                          ? 'bg-[#7C3AED]'
                          : 'border-2 border-[#E8E4DD] hover:border-[#7C3AED]'
                      }`}
                    >
                      {item.done && <Check size={12} className="text-white" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${item.done ? 'line-through text-[#6B6560]' : 'text-[#1A1A1A]'}`}>
                        {item.task}
                      </p>
                      <p className="text-xs text-[#6B6560] mt-1">
                        {item.assignee} · Due {item.due}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        item.done
                          ? 'bg-[#F5F2EE] text-[#6B6560]'
                          : 'bg-[#FEF3C7] text-[#D97706]'
                      }`}
                    >
                      {item.due}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-[#E8E4DD] rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowTranscript((prev) => !prev)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#F5F2EE] transition"
              >
                <span className="text-sm font-semibold text-[#1A1A1A]">Transcript</span>
                {showTranscript ? (
                  <ChevronUp size={18} className="text-[#6B6560]" />
                ) : (
                  <ChevronDown size={18} className="text-[#6B6560]" />
                )}
              </button>
              {showTranscript && (
                <div className="px-6 pb-6 space-y-4">
                  {mockSummary.transcript.map((line, index) => (
                    <div key={index}>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-semibold text-[#7C3AED]">
                          {line.speaker}
                        </span>
                        <span className="text-xs text-[#6B6560]">{line.time}</span>
                      </div>
                      <p className="text-sm text-[#1A1A1A]">{line.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="col-span-1 space-y-4 sticky top-4">
            <div className="bg-white border border-[#E8E4DD] rounded-2xl p-4">
              <h2 className="text-sm font-semibold text-[#1A1A1A] mb-3">Participants</h2>
              <div className="space-y-3">
                {mockSummary.participants.map((participant) => (
                  <div key={participant} className="flex items-center gap-3 py-2">
                    <div className="w-8 h-8 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] text-xs font-semibold flex items-center justify-center">
                      {participant
                        .split(' ')
                        .map((item) => item[0])
                        .join('')}
                    </div>
                    <div>
                      <p className="text-sm text-[#1A1A1A]">{participant}</p>
                      {participant === 'You' ? (
                        <p className="text-xs text-[#6B6560]">You</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-[#E8E4DD] rounded-2xl p-4">
              <h2 className="text-sm font-semibold text-[#1A1A1A] mb-3">Meeting details</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-[#6B6560]">Meeting ID</p>
                  <p className="font-medium text-[#1A1A1A] font-mono">{meetingId}</p>
                </div>
                <div>
                  <p className="text-xs text-[#6B6560]">Date</p>
                  <p className="font-medium text-[#1A1A1A]">{mockSummary.date}</p>
                </div>
                <div>
                  <p className="text-xs text-[#6B6560]">Duration</p>
                  <p className="font-medium text-[#1A1A1A]">{mockSummary.duration}</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="w-full mt-1 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2"
            >
              <Download size={16} />
              Export Summary
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
