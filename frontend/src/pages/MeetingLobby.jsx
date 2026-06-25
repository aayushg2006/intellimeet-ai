import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMeetingStore } from '../store/meetingStore'
import { Video, Mic, MicOff, VideoOff, ArrowLeft, Play, Copy, Check } from 'lucide-react'
import axios from 'axios'

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

  const participantInitial = participantName?.trim()?.charAt(0)?.toUpperCase() || 'U'
  const videoRef = useRef(null)
  const previewStreamRef = useRef(null)

  const { setMeetingId, setParticipantName: setStoreName } = useMeetingStore()

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
          alert('Meeting not found! Please check the link.')
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
  }, [])

  // Connect video stream to ref
  useEffect(() => {
    if (videoRef.current && previewStreamRef.current) {
      videoRef.current.srcObject = previewStreamRef.current
    }
  }, [isVideoEnabled])

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
      alert('Please enter your name first')
      return
    }
    // Stop the preview stream before navigating — VideoRoom will acquire its own
    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach(t => t.stop())
      previewStreamRef.current = null
    }
    setMeetingId(meetingId)
    setStoreName(participantName)
    navigate(`/meeting/${meetingId}/room`)
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#E8E4DD] border-t-[#7C3AED] mx-auto"></div>
          <p className="text-sm text-[#6B6560] mt-3">Setting up your camera...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF9F7]">
      <div className="border-b border-[#E8E4DD] bg-[#FAF9F7] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[#1A1A1A] font-semibold">
          <span className="text-[#7C3AED]">●</span>
          IntellMeet
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-[#F5F2EE] border border-[#E8E4DD] rounded-full p-1 pl-3">
            <span className="text-[#6B6560] text-xs font-mono">{meetingId}</span>
            <button
              onClick={handleCopyLink}
              className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-[#6B6560] shadow-sm hover:text-[#7C3AED] hover:bg-[#7C3AED]/10 transition"
              title="Copy link"
            >
              {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
            </button>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 text-sm text-[#6B6560] hover:text-[#1A1A1A] transition"
          >
            <ArrowLeft size={16} />
            Back to dashboard
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold text-[#1A1A1A] mb-1">Ready to join?</h1>
        <p className="text-sm text-[#6B6560] mb-8">
          Check your camera and microphone before joining
        </p>

        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <div className="bg-[#1A1A1A] rounded-2xl overflow-hidden relative aspect-video">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />

              {!isVideoEnabled && (
                <div className="absolute inset-0 bg-[#1A1A1A] flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-[#7C3AED]/20 text-[#7C3AED] text-3xl font-semibold flex items-center justify-center">
                    {participantInitial}
                  </div>
                </div>
              )}

              <div className="absolute top-3 right-3 flex gap-2">
                <div className="bg-black/40 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${isAudioEnabled ? 'bg-green-400' : 'bg-red-400'}`}
                  />
                  {isAudioEnabled ? 'Audio On' : 'Audio Off'}
                </div>
                <div className="bg-black/40 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${isVideoEnabled ? 'bg-green-400' : 'bg-red-400'}`}
                  />
                  {isVideoEnabled ? 'Video On' : 'Video Off'}
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-4 pb-4 pt-8 flex items-center justify-center gap-3">
                <button
                  onClick={toggleAudio}
                  className={`w-11 h-11 rounded-full flex items-center justify-center transition ${
                    isAudioEnabled
                      ? 'bg-white/20 backdrop-blur-sm text-white hover:bg-white/30'
                      : 'bg-red-500/80 hover:bg-red-600 text-white'
                  }`}
                >
                  {isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                </button>
                <button
                  onClick={toggleVideo}
                  className={`w-11 h-11 rounded-full flex items-center justify-center transition ${
                    isVideoEnabled
                      ? 'bg-white/20 backdrop-blur-sm text-white hover:bg-white/30'
                      : 'bg-red-500/80 hover:bg-red-600 text-white'
                  }`}
                >
                  {isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-2 text-sm text-red-500 flex items-center gap-1.5">
                ⚠️ {error}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5">
              <label className="text-xs font-medium text-[#6B6560] uppercase tracking-wider mb-2 inline-block">
                Your name
              </label>
              <input
                type="text"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                placeholder="Enter your display name"
                className="w-full bg-[#FAF9F7] border border-[#E8E4DD] rounded-xl px-4 py-2.5 text-sm text-[#1A1A1A] placeholder-[#C4BDB5] focus:outline-none focus:border-[#7C3AED] transition"
              />
            </div>

            <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5 text-xs font-medium text-[#6B6560] uppercase tracking-wider">
                  <Mic size={13} className="text-[#6B6560]" />
                  Microphone
                </div>
                <select
                  value={selectedAudio}
                  onChange={(e) => handleDeviceSwitch(e.target.value, 'audio')}
                  className="w-full bg-[#FAF9F7] border border-[#E8E4DD] rounded-xl px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#7C3AED] transition"
                >
                  {audioDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1.5 text-xs font-medium text-[#6B6560] uppercase tracking-wider">
                  <Video size={13} className="text-[#6B6560]" />
                  Camera
                </div>
                <select
                  value={selectedVideo}
                  onChange={(e) => handleDeviceSwitch(e.target.value, 'video')}
                  className="w-full bg-[#FAF9F7] border border-[#E8E4DD] rounded-xl px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#7C3AED] transition"
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
              className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl py-3 text-sm font-semibold transition flex items-center justify-center gap-2"
            >
              <Play size={16} />
              Join Meeting
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
