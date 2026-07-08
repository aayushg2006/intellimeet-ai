import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { FileText, ArrowLeft, Clock, Users, CheckSquare, ChevronDown, ChevronUp, Copy, Check, Download, Loader, RefreshCw, Sparkles, Video, Paperclip, FileIcon, Maximize } from 'lucide-react'
import axios from 'axios'
import { useSignedUrl } from '../hooks/useSignedUrl'
import { formatMeetingDate } from '../utils/meetingDisplay'

const RecordingPlayer = ({ recordingKey }) => {
  const { url, loading } = useSignedUrl(recordingKey)
  const videoRef = useRef(null)
  const [copied, setCopied] = useState(false)

  const handleCopyLink = () => {
    if (url) {
      navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen()
      } else if (videoRef.current.webkitRequestFullscreen) {
        videoRef.current.webkitRequestFullscreen()
      } else if (videoRef.current.msRequestFullscreen) {
        videoRef.current.msRequestFullscreen()
      }
    }
  }

  if (!recordingKey) return null

  return (
    <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#1A1A1A]">
          <Video size={16} className="text-[#7C3AED]" />
          Meeting Recording
        </div>
        <div className="flex items-center gap-2">
          {url && (
            <>
              <button 
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 text-xs text-[#6B6560] hover:text-[#1A1A1A] transition bg-[#F5F2EE] px-2.5 py-1.5 rounded-lg"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy Link'}
              </button>
              <button 
                onClick={handleFullscreen}
                className="flex items-center gap-1.5 text-xs text-[#6B6560] hover:text-[#1A1A1A] transition bg-[#F5F2EE] px-2.5 py-1.5 rounded-lg"
              >
                <Maximize size={14} />
                Fullscreen
              </button>
            </>
          )}
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center p-8 bg-[#F5F2EE] rounded-xl text-[#6B6560]">
          <Loader size={20} className="animate-spin mr-2" />
          Loading recording...
        </div>
      ) : url ? (
        <div className="rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center relative group">
          <video 
            ref={videoRef}
            src={url} 
            controls 
            className="w-full h-full object-contain"
            controlsList="nodownload"
          />
        </div>
      ) : (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm">Failed to load recording</div>
      )}
    </div>
  )
}

const SharedFile = ({ file }) => {
  // If S3 key is provided, use signed URL, otherwise fallback to direct URL
  const { url, loading } = useSignedUrl(file.s3Key)
  const downloadUrl = url || file.url
  const sizeMB = file.fileSize ? (file.fileSize / 1024 / 1024).toFixed(2) : 0

  return (
    <div className="flex items-center justify-between p-3 bg-white border border-[#E8E4DD] rounded-xl mb-2 hover:bg-[#F5F2EE] transition">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-[#F5F2EE] flex items-center justify-center flex-shrink-0">
          <FileIcon size={18} className="text-[#6B6560]" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#1A1A1A] truncate" title={file.fileName}>{file.fileName}</p>
          <p className="text-xs text-[#6B6560]">{sizeMB} MB</p>
        </div>
      </div>
      {loading ? (
        <Loader size={16} className="text-[#6B6560] animate-spin" />
      ) : (
        <a 
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-8 h-8 flex items-center justify-center rounded-full bg-[#7C3AED]/10 text-[#7C3AED] hover:bg-[#7C3AED] hover:text-white transition"
          title="Download"
        >
          <Download size={14} />
        </a>
      )}
    </div>
  )
}

const SECTION_TITLES = [
  'Transcript Summary',
  'Chat Summary',
  'Notes Summary',
  'Conclusions / Decisions',
  'Conclusions',
  'Decisions',
  'Action Items',
]

const normalizeSectionTitle = (title = '') => {
  const cleaned = String(title).trim()
  if (/^conclusions?(\s*\/\s*decisions?)?$/i.test(cleaned)) {
    return 'Conclusions / Decisions'
  }
  return cleaned
}

const normalizeHeading = (line) => line.replace(/^#{1,6}\s*/, '').replace(/\s+/g, ' ').trim()

const isHeadingLine = (line) => /^#{1,6}\s+/.test(line.trim())

const isBulletLine = (line) => /^(\*|-|\+|\d+[.)])\s+/.test(line.trim())

const stripBulletPrefix = (line) => line.trim().replace(/^(\*|-|\+|\d+[.)])\s+/, '').trim()

const splitOutConclusions = (content = '') => {
  const text = String(content || '').replace(/\r\n/g, '\n').trim()
  if (!text) {
    return { body: '', conclusions: '' }
  }

  const match = text.match(/(?:^|\n)\s*(CONCLUSIONS?(?:\s*\/\s*DECISIONS?)?|DECISIONS?)\s*:\s*([\s\S]*)/i)
  if (!match) {
    return { body: text, conclusions: '' }
  }

  const headingIndex = text.search(/(?:^|\n)\s*(CONCLUSIONS?(?:\s*\/\s*DECISIONS?)?|DECISIONS?)\s*:\s*/i)
  const body = headingIndex > 0 ? text.slice(0, headingIndex).trim() : ''
  const conclusions = match[2] ? match[2].trim() : ''

  return {
    body,
    conclusions,
  }
}

const parseSummarySections = (summaryText, conclusionsText) => {
  const rawText = typeof summaryText === 'string' ? summaryText.replace(/\r\n/g, '\n').trim() : ''
  const sections = []

  if (rawText) {
    const lines = rawText.split('\n')
    let current = null

    const pushCurrent = () => {
      if (!current) return
      const content = current.lines.join('\n').trim()
      if (content) {
        sections.push({
          title: current.title,
          content,
        })
      }
    }

    for (const line of lines) {
      if (isHeadingLine(line)) {
        pushCurrent()
        current = {
          title: normalizeHeading(line),
          lines: [],
        }
        continue
      }

      const trimmed = line.trim()
      if (!current && trimmed) {
        current = {
          title: 'Summary',
          lines: [],
        }
      }

      if (current) {
        current.lines.push(line)
      }
    }

    pushCurrent()

    if (!sections.length) {
      sections.push({
        title: 'Summary',
        content: rawText,
      })
    }
  }

  if (conclusionsText && conclusionsText.trim()) {
    const hasDedicatedConclusions = sections.some((section) =>
      ['Conclusions / Decisions', 'Conclusions', 'Decisions'].includes(section.title)
    )

    if (!hasDedicatedConclusions) {
      sections.push({
        title: 'Conclusions / Decisions',
        content: conclusionsText.replace(/\r\n/g, '\n').trim(),
      })
    }
  }

  return sections
}

const SummaryBody = ({ content }) => {
  const paragraphs = []
  const bulletGroups = []
  let currentBullets = []

  const flushBullets = () => {
    if (currentBullets.length) {
      bulletGroups.push([...currentBullets])
      currentBullets = []
    }
  }

  for (const line of content.replace(/\r\n/g, '\n').split('\n').map((value) => value.trim())) {
    if (!line) {
      flushBullets()
      continue
    }

    if (isHeadingLine(line)) {
      continue
    }

    if (isBulletLine(line)) {
      currentBullets.push(stripBulletPrefix(line))
      continue
    }

    flushBullets()
    paragraphs.push(line)
  }

  flushBullets()

  return (
    <div className="space-y-3">
      {paragraphs.map((paragraph, index) => (
        <p key={`${paragraph}-${index}`} className="text-sm text-[#6B6560] leading-relaxed whitespace-pre-wrap">
          {paragraph}
        </p>
      ))}
      {bulletGroups.map((group, index) => (
        <ul key={`bullets-${index}`} className="space-y-2">
          {group.map((bullet, bulletIndex) => (
            <li key={`${bullet}-${bulletIndex}`} className="text-sm text-[#6B6560] leading-relaxed flex gap-2">
              <span className="text-[#7C3AED] mt-1">-</span>
              <span className="whitespace-pre-wrap">{bullet}</span>
            </li>
          ))}
        </ul>
      ))}
    </div>
  )
}

export const MeetingSummary = () => {
  const navigate = useNavigate()
  const { meetingId } = useParams()
  const { token } = useAuthStore()

  const [summaryData, setSummaryData] = useState(null)
  const [actionItems, setActionItems] = useState([])
  const [showTranscript, setShowTranscript] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { document.title = 'Meeting Summary — IntellMeet' }, [])

  const summarySections = useMemo(() => {
    if (!summaryData) return []

    const notesSplit = splitOutConclusions(summaryData.notesSummary || '')
    const structuredSections = [
      summaryData.transcriptSummary ? { title: 'Transcript Summary', content: summaryData.transcriptSummary } : null,
      summaryData.chatSummary ? { title: 'Chat Summary', content: summaryData.chatSummary } : null,
      notesSplit.body ? { title: 'Notes Summary', content: notesSplit.body } : null,
    ].filter(Boolean)

    const parsed = parseSummarySections(summaryData.summary, '')
    const preferredOrder = SECTION_TITLES

    const parsedSections = parsed
      .filter((section) => section.title !== 'Action Items')
      .filter((section) => !['Conclusions / Decisions', 'Conclusions', 'Decisions'].includes(section.title))

    const merged = [...structuredSections]
    parsedSections.forEach((section) => {
      if (!merged.some((item) => normalizeSectionTitle(item.title) === normalizeSectionTitle(section.title))) {
        merged.push(section)
      }
    })

    return merged.sort((a, b) => {
      const aIndex = preferredOrder.indexOf(normalizeSectionTitle(a.title))
      const bIndex = preferredOrder.indexOf(normalizeSectionTitle(b.title))
      const normalizedA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex
      const normalizedB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex
      return normalizedA - normalizedB
    })
  }, [summaryData])

  const resolvedConclusions = useMemo(() => {
    if (!summaryData) return ''
    const notesSplit = splitOutConclusions(summaryData.notesSummary || '')
    return summaryData.conclusions || notesSplit.conclusions || ''
  }, [summaryData])

  const summaryCopyText = useMemo(() => {
    if (!summaryData) return ''

    const sections = summarySections.length
      ? summarySections
      : summaryData.summary
        ? parseSummarySections(summaryData.summary, '')
        : []

    const parts = sections
      .filter((section) => !['Conclusions / Decisions', 'Conclusions', 'Decisions'].includes(section.title))
      .map((section) => `${section.title}\n${section.content.trim()}`)

    if (resolvedConclusions) {
      parts.push(`Conclusions / Decisions\n${resolvedConclusions.trim()}`)
    }

    return parts.join('\n\n').trim()
  }, [summaryData, summarySections, resolvedConclusions])

  const fetchSummary = useCallback(async () => {
    try {
      const res = await axios.get(`/api/summaries/${meetingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = res.data
      if (data) {
        setSummaryData(data)
        setActionItems(data.actionItems || [])
      }
      return data
    } catch (error) {
      console.error('Error fetching summary:', error)
      return null
    } finally {
      setLoading(false)
    }
  }, [meetingId, token])

  useEffect(() => {
    let pollingInterval;

    const poll = async () => {
      const data = await fetchSummary()
      // Keep polling if transcript exists but summary hasn't been generated yet
      if (data && 
          (!data.summary || 
           data.summary === 'No AI summary generated yet.' || 
           data.summary.includes('Failed to generate summary')) && 
          data.transcript?.length > 0) {
        if (!pollingInterval) {
          pollingInterval = setInterval(poll, 3000);
        }
      } else {
        if (pollingInterval) clearInterval(pollingInterval);
      }
    }

    poll()

    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    }
  }, [fetchSummary])

  const toggleAction = async (id) => {
    setActionItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item
      )
    )

    const item = actionItems.find(i => i.id === id);
    const taskId = item?.taskId || (typeof id === 'string' && id.length === 24 ? id : null)
    if (taskId) {
      try {
        await axios.put(`/api/tasks/${taskId}`, {
          status: !item.done ? 'Done' : 'Todo'
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (error) {
        console.error("Failed to update task", error);
      }
    }
  }

  const handleCopy = async () => {
    try {
      if (summaryCopyText) {
        await navigator.clipboard.writeText(summaryCopyText)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      }
    } catch (error) {
      console.error('Copy failed', error)
    }
  }

  const handleGenerateSummary = async () => {
    try {
      setIsGenerating(true)
      await axios.post(`/api/summaries/${meetingId}/generate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      await fetchSummary()
    } catch (err) {
      console.error(err)
      alert('Failed to generate summary: ' + (err.response?.data?.message || err.message))
    } finally {
      setIsGenerating(false)
    }
  }

  const handleBack = () => {
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#FAF9F7]">
      <div className="border-b border-[#E8E4DD] bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[#1A1A1A] font-semibold">
          <img src="/logo.png" alt="IntellMeet" className="h-8 w-auto" />
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={fetchSummary}
            className="flex items-center gap-1.5 text-sm text-[#6B6560] hover:text-[#7C3AED] transition"
            title="Refresh summary data (fetches latest recordings/attachments)"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-sm text-[#6B6560] hover:text-[#1A1A1A] transition"
          >
            <ArrowLeft size={16} />
            Back to dashboard
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pt-6 pb-10">
        {loading || !summaryData ? (
          <div className="flex items-center justify-center py-20 text-[#6B6560]">
            <Loader className="animate-spin mr-2" />
            Loading summary...
          </div>
        ) : (
          <>
            <div className="pb-6 border-b border-[#E8E4DD]">
              <h1 className="text-2xl font-semibold text-[#1A1A1A]">{summaryData.title}</h1>
          <div className="flex flex-wrap gap-4 mt-3">
            <span className="bg-white border border-[#E8E4DD] text-[#6B6560] text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
              {formatMeetingDate(summaryData.date)}
            </span>
            <span className="bg-white border border-[#E8E4DD] text-[#6B6560] text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <Clock size={14} />
              {summaryData.duration || '0 minutes'}
            </span>
            <span className="bg-white border border-[#E8E4DD] text-[#6B6560] text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <Users size={14} />
              {summaryData.participants?.length || 0} participants
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
              {isGenerating ? (
                <div className="pt-3 pb-2 space-y-3">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-full"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-5/6"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-4/6"></div>
                  <p className="text-sm text-[#7C3AED] font-medium flex items-center gap-2 pt-2">
                    <RefreshCw size={14} className="animate-spin" /> Generating AI Summary...
                  </p>
                </div>
              ) : (
                <div className="pt-3 space-y-4">
                  {summarySections.length > 0 ? (
                    summarySections.map((section) => (
                      <div key={section.title} className="rounded-2xl border border-[#E8E4DD] bg-[#FAF9F7] p-4">
                        <div className="flex items-center justify-between gap-3 pb-2 border-b border-[#E8E4DD]">
                          <h3 className="text-sm font-semibold text-[#1A1A1A]">{section.title}</h3>
                        </div>
                        <div className="pt-3">
                          <SummaryBody content={section.content} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[#6B6560] leading-relaxed whitespace-pre-wrap">
                      {summaryData.summary}
                    </p>
                  )}
                </div>
              )}
              
              {!isGenerating && 
               (!summaryData.summary || 
                summaryData.summary === 'No AI summary generated yet.' || 
                summaryData.summary.includes('Failed to generate summary')) && 
               summaryData.transcript?.length > 0 && (
                <div className="mt-4">
                  <button 
                    onClick={handleGenerateSummary} 
                    disabled={isGenerating}
                    className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Sparkles size={16} /> Generate AI Summary
                  </button>
                </div>
              )}

              <div className="bg-[#7C3AED]/8 text-[#7C3AED] text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1 mt-4">
                ✦ Generated by AI
              </div>
            </div>

            {resolvedConclusions && resolvedConclusions.trim() !== '' && (
              <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#1A1A1A] pb-3 border-b border-[#E8E4DD]">
                  <Sparkles size={16} className="text-[#7C3AED]" />
                  Conclusions / Decisions
                </div>
                <SummaryBody content={resolvedConclusions} />
              </div>
            )}

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
                        {item.assignee || 'Unassigned'} · {item.status || 'pending'}
                      </p>
                      {summaryData.title && (
                        <p className="text-[11px] text-[#7C3AED] mt-1">
                          From meeting: {summaryData.title}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        item.done
                          ? 'bg-[#F5F2EE] text-[#6B6560]'
                          : 'bg-[#FEF3C7] text-[#D97706]'
                      }`}
                    >
                      {item.status || 'pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {summaryData.notes && summaryData.notes.trim() !== '' && summaryData.notes !== '<p><br></p>' && (
              <div className="bg-white border border-[#E8E4DD] rounded-2xl overflow-hidden mb-6">
                <div className="px-5 py-4 border-b border-[#E8E4DD] flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[#1A1A1A] flex items-center gap-2">
                    <FileText size={18} className="text-[#7C3AED]" />
                    Shared Notes
                  </h2>
                </div>
                <div 
                  className="p-6 text-sm text-[#1A1A1A] whitespace-pre-wrap ql-editor"
                  dangerouslySetInnerHTML={{ __html: summaryData.notes }} 
                />
              </div>
            )}

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
                  {summaryData.transcript?.map((line, index) => {
                    const separatorIndex = line.indexOf(':')
                    const speaker = separatorIndex !== -1 ? line.substring(0, separatorIndex) : 'Unknown'
                    const text = separatorIndex !== -1 ? line.substring(separatorIndex + 1).trim() : line

                    return (
                      <div key={index}>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xs font-semibold text-[#7C3AED]">
                            {speaker}
                          </span>
                        </div>
                        <p className="text-sm text-[#1A1A1A]">{text}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="col-span-1 space-y-4 sticky top-4">
            
            {/* Recording */}
            {summaryData.recordingKey && (
              <RecordingPlayer recordingKey={summaryData.recordingKey} />
            )}

            {/* Shared Files */}
            {summaryData.attachments && summaryData.attachments.length > 0 && (
              <div className="bg-white border border-[#E8E4DD] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-[#1A1A1A] flex items-center gap-2">
                    <Paperclip size={16} className="text-[#7C3AED]" />
                    Shared Files
                  </h2>
                  <span className="bg-[#F5F2EE] text-[#6B6560] text-xs px-2 py-0.5 rounded-full">
                    {summaryData.attachments.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {summaryData.attachments.map((file, idx) => (
                    <SharedFile key={idx} file={file} />
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white border border-[#E8E4DD] rounded-2xl p-4">
              <h2 className="text-sm font-semibold text-[#1A1A1A] mb-3">Participants</h2>
              <div className="space-y-3">
                {summaryData.participants?.map((participant) => (
                  <div key={participant} className="flex items-center gap-3 py-2">
                    <div className="w-8 h-8 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] text-xs font-semibold flex items-center justify-center">
                      {participant
                        .split(' ')
                        .map((item) => item[0])
                        .join('')}
                    </div>
                    <div>
                      <p className="text-sm text-[#1A1A1A]">{participant}</p>
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
                  <p className="font-medium text-[#1A1A1A]">{formatMeetingDate(summaryData.date)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#6B6560]">Duration</p>
                  <p className="font-medium text-[#1A1A1A]">{summaryData.duration || '0 minutes'}</p>
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
        </>
        )}
      </div>
    </div>
  )
}
