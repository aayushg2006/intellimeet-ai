import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMeetingStore } from '../store/meetingStore'
import { Video, Mic, MicOff, VideoOff, ArrowLeft, Play, Copy, Check } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'

export const MeetingLobby = () => {
  const navigate = useNavigate()
  const { meetingId } = useParams()
  const [participantName, setParticipantName] = useState('')
  const [loading, setLoading] = useState(true)
  const [audioDevices, setAudioDevices] = useState([])
  const [videoDevices, setVideoDevices] = useState([])
  const [selectedAudio, setSelectedAudio] = useState('')
  const [selectedVideo, setSelectedVideo] = useState('')
  const [copied, setCopied] = useState(false)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { document.title = `Lobby: ${meetingId} — IntellMeet` }, [meetingId])

  const participantInitial = participantName?.trim()?.charAt(0)?.toUpperCase() || 'U'
  const videoRef = useRef(null)
  const previewStreamRef = useRef(null)

  const { setMeetingId, setParticipantName: setStoreName, setJoinPreferences } = useMeetingStore()

  // Initialize preview media on mount
  useEffect(() => {
    const init = async () => {
      try {
        // Validate room exists
        const token = localStorage.getItem('auth-storage') ? JSON.parse(localStorage.getItem('auth-storage')).state.token : null
        await axios.get(`/api/meetings/room/${meetingId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })

        // Get preview stream
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: { width: { ideal: 1280 }, height: { ideal: 720 } }
          })
          previewStreamRef.current = stream
          if (videoRef.current) videoRef.current.srcObject = stream
        } catch (mediaErr) {
          setError(mediaErr.name === 'NotAllowedError'
            ? 'Camera/microphone permission denied'
            : 'Failed to access media devices')
        }

        // Enumerate devices
        const devices = await navigator.mediaDevices.enumerateDevices()
        const audio = devices.filter(d => d.kind === 'audioinput')
        const video = devices.filter(d => d.kind === 'videoinput')
        setAudioDevices(audio)
        setVideoDevices(video)
        if (audio.length > 0) setSelectedAudio(audio[0].deviceId)
        if (video.length > 0) setSelectedVideo(video[0].deviceId)
        setLoading(false)
      } catch (err) {
        if (err.response && err.response.status === 404) {
          toast.error('Meeting not found! Please check the link.')
          navigate('/dashboard')
        } else {
          setLoading(false)
        }
      }
    }
    init()

    // Cleanup: stop preview stream on unmount (but this does NOT affect VideoRoom's stream)
    return () => {
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach(t => t.stop())
        previewStreamRef.current = null
      }
    }
  }, [meetingId, navigate])

  // Connect video stream to ref
  useEffect(() => {
    if (videoRef.current && previewStreamRef.current) {
      videoRef.current.srcObject = previewStreamRef.current
    }
  }, [isVideoEnabled, loading])

  const toggleAudio = () => {
    if (previewStreamRef.current) {
      previewStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
      setIsAudioEnabled(prev => !prev)
    }
  }

  const toggleVideo = () => {
    if (previewStreamRef.current) {
      previewStreamRef.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
      setIsVideoEnabled(prev => !prev)
    }
  }

  const handleDeviceSwitch = async (deviceId, kind) => {
    try {
      // Stop existing preview tracks of this kind
      if (previewStreamRef.current) {
        const trackKind = kind === 'audio' ? 'audio' : 'video'
        previewStreamRef.current.getTracks()
          .filter(t => t.kind === trackKind)
          .forEach(t => { t.stop(); previewStreamRef.current.removeTrack(t) })
      }

      // Acquire new stream with the selected device
      const constraints = kind === 'audio'
        ? { audio: { deviceId: { exact: deviceId } } }
        : { video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } }

      const newStream = await navigator.mediaDevices.getUserMedia(constraints)
      const newTrack = newStream.getTracks()[0]

      if (newTrack && previewStreamRef.current) {
        newTrack.enabled = kind === 'audio' ? isAudioEnabled : isVideoEnabled
        previewStreamRef.current.addTrack(newTrack)
        // Re-attach to video element
        if (videoRef.current) {
          videoRef.current.srcObject = previewStreamRef.current
        }
      }

      if (kind === 'audio') {
        setSelectedAudio(deviceId)
      } else {
        setSelectedVideo(deviceId)
      }
    } catch (err) {
      console.error('[Lobby] Device switch error:', err)
      setError('Failed to switch device')
    }
  }

  const handleJoinMeeting = () => {
    if (!participantName.trim()) {
      toast.error('Please enter your name first')
      return
    }
    // Stop the preview stream before navigating — VideoRoom will acquire its own
    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach(t => t.stop())
      previewStreamRef.current = null
    }
    setMeetingId(meetingId)
    setStoreName(participantName)
    setJoinPreferences({
      audioEnabled: isAudioEnabled,
      videoEnabled: isVideoEnabled,
      audioDeviceId: selectedAudio,
      videoDeviceId: selectedVideo,
    })
    navigate(`/meeting/${meetingId}/room`)
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-white via-[#FAF9F7] to-[#F3F0FF] text-[#1A1A1A]">
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <div className="absolute left-[-3rem] top-12 h-[20rem] w-[20rem] rounded-full bg-gradient-to-br from-[#C4B5FD] via-[#93C5FD] to-[#E0E7FF] blur-3xl opacity-45" />
          <div className="absolute bottom-[-2rem] right-[-2rem] h-[18rem] w-[24rem] rounded-[45%] bg-gradient-to-br from-[#C4B5FD] via-[#93C5FD] to-[#E0E7FF] blur-3xl opacity-40" />
        </div>
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#E8E4DD] border-t-[#7C3AED]"></div>
            <p className="mt-3 text-sm text-[#6B6560]">Setting up your camera...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-white via-[#FAF9F7] to-[#F3F0FF] text-[#1A1A1A]">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute left-[-3rem] top-12 h-[24rem] w-[24rem] rounded-full bg-gradient-to-br from-[#C4B5FD] via-[#93C5FD] to-[#E0E7FF] blur-3xl opacity-45" />
        <div className="absolute right-[-2rem] top-[-2rem] h-[20rem] w-[26rem] rounded-[45%] bg-gradient-to-br from-[#C4B5FD] via-[#93C5FD] to-[#E0E7FF] blur-3xl opacity-40" />
      </div>

      <div className="relative z-10">
        <div className="sticky top-0 z-50 border-b border-white/10 bg-white/60 px-6 py-4 backdrop-blur-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-semibold text-[#1A1A1A]">
              <img src="/logo.png" alt="IntellMeet" className="h-8 w-auto" />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 rounded-full border border-[#E8E4DD] bg-white/80 p-1 pl-3 shadow-sm">
                <span className="text-xs font-mono text-[#6B6560]">{meetingId}</span>
                <button
                  onClick={handleCopyLink}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#6B6560] shadow-sm transition hover:bg-[#7C3AED]/10 hover:text-[#7C3AED]"
                  title="Copy link"
                  aria-label="Copy meeting link"
                >
                  {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                </button>
              </div>
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-1.5 text-sm text-[#6B6560] transition hover:text-[#1A1A1A]"
              >
                <ArrowLeft size={16} />
                Back to dashboard
              </button>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="mb-8">
            <h1 className="mb-1 text-2xl font-semibold text-[#1A1A1A]">Ready to join?</h1>
            <p className="text-sm text-[#6B6560]">Check your camera and microphone before joining</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <div className="relative aspect-video overflow-hidden rounded-3xl border border-[#E8E4DD] bg-[#1C1C1E] shadow-[0_20px_45px_-30px_rgba(15,23,42,0.35)]">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />

                {!isVideoEnabled && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#1C1C1E]">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#7C3AED]/20 text-3xl font-semibold text-[#7C3AED]">
                      {participantInitial}
                    </div>
                  </div>
                )}

                <div className="absolute right-3 top-3 flex gap-2">
                  <div className="flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-xs text-white backdrop-blur-sm">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${isAudioEnabled ? 'bg-green-400' : 'bg-red-400'}`}
                    />
                    {isAudioEnabled ? 'Audio On' : 'Audio Off'}
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-xs text-white backdrop-blur-sm">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${isVideoEnabled ? 'bg-green-400' : 'bg-red-400'}`}
                    />
                    {isVideoEnabled ? 'Video On' : 'Video Off'}
                  </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-3 bg-gradient-to-t from-black/60 to-transparent px-4 pb-4 pt-8">
                  <button
                    onClick={toggleAudio}
                    className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
                      isAudioEnabled
                        ? 'bg-white/20 text-white backdrop-blur-sm hover:bg-white/30'
                        : 'bg-red-50 text-red-500 hover:bg-red-100'
                    }`}
                    aria-label={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
                  >
                    {isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                  </button>
                  <button
                    onClick={toggleVideo}
                    className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
                      isVideoEnabled
                        ? 'bg-white/20 text-white backdrop-blur-sm hover:bg-white/30'
                        : 'bg-red-50 text-red-500 hover:bg-red-100'
                    }`}
                    aria-label={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                  >
                    {isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="mt-2 flex items-center gap-1.5 text-sm text-red-500">
                  ⚠️ {error}
                </div>
              )}
            </div>

            <div className="space-y-4 lg:col-span-2">
              <div className="rounded-2xl border border-[#E8E4DD] bg-white/90 p-5 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.25)] backdrop-blur-sm">
                <label className="mb-2 inline-block text-xs font-medium uppercase tracking-wider text-[#6B6560]">
                  Your name
                </label>
                <input
                  type="text"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  placeholder="Enter your display name"
                  className="w-full rounded-xl border border-[#E8E4DD] bg-[#FAF9F7] px-4 py-2.5 text-sm text-[#1A1A1A] placeholder-[#C4BDB5] transition focus:border-[#7C3AED] focus:outline-none"
                />
              </div>

              <div className="space-y-4 rounded-2xl border border-[#E8E4DD] bg-white/90 p-5 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.25)] backdrop-blur-sm">
                <div>
                  <div className="mb-1.5 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#6B6560]">
                    <Mic size={13} className="text-[#6B6560]" />
                    Microphone
                  </div>
                  <select
                    value={selectedAudio}
                    onChange={(e) => handleDeviceSwitch(e.target.value, 'audio')}
                    className="w-full rounded-xl border border-[#E8E4DD] bg-[#FAF9F7] px-3 py-2 text-sm text-[#1A1A1A] transition focus:border-[#7C3AED] focus:outline-none"
                  >
                    {audioDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#6B6560]">
                    <Video size={13} className="text-[#6B6560]" />
                    Camera
                  </div>
                  <select
                    value={selectedVideo}
                    onChange={(e) => handleDeviceSwitch(e.target.value, 'video')}
                    className="w-full rounded-xl border border-[#E8E4DD] bg-[#FAF9F7] px-3 py-2 text-sm text-[#1A1A1A] transition focus:border-[#7C3AED] focus:outline-none"
                  >
                    {videoDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera ${device.deviceId.slice(0, 5)}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleJoinMeeting}
                disabled={!participantName.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] py-3 text-sm font-semibold text-white transition hover:from-[#6D28D9] hover:to-[#5B21B6] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Play size={16} />
                Join Meeting
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
