import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useWebRTC } from '../hooks/useWebRTC'
import { useMeetingStore } from '../store/meetingStore'
import { Video, Mic, Volume2, Volume, ArrowLeft, Play } from 'lucide-react'

export const MeetingLobby = () => {
  const navigate = useNavigate()
  const { meetingId } = useParams()
  const [participantName, setParticipantName] = useState('')
  const [loading, setLoading] = useState(true)
  const [audioDevices, setAudioDevices] = useState([])
  const [videoDevices, setVideoDevices] = useState([])
  const [selectedAudio, setSelectedAudio] = useState('')
  const [selectedVideo, setSelectedVideo] = useState('')

  const participantInitial = participantName?.trim()?.charAt(0)?.toUpperCase() || 'U'

  const videoRef = useRef(null)

  const {
    localStream,
    isAudioEnabled,
    isVideoEnabled,
    error,
    initializeMedia,
    toggleAudio,
    toggleVideo,
    getDevices,
    switchDevice,
  } = useWebRTC()

  const { setMeetingId, setParticipantName: setStoreName } = useMeetingStore()

  // Initialize media on mount
  useEffect(() => {
    const init = async () => {
      await initializeMedia()
      const devices = await getDevices()
      setAudioDevices(devices.audioDevices)
      setVideoDevices(devices.videoDevices)
      if (devices.audioDevices.length > 0) {
        setSelectedAudio(devices.audioDevices[0].deviceId)
      }
      if (devices.videoDevices.length > 0) {
        setSelectedVideo(devices.videoDevices[0].deviceId)
      }
      setLoading(false)
    }

    init()
  }, [])

  // Connect video stream to ref
  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream
    }
  }, [localStream])

  // Handle device switch
  const handleDeviceSwitch = async (deviceId, kind) => {
    if (kind === 'audio') {
      setSelectedAudio(deviceId)
      await switchDevice(deviceId, 'audioinput')
    } else {
      setSelectedVideo(deviceId)
      await switchDevice(deviceId, 'videoinput')
    }
  }

  const handleJoinMeeting = () => {
    if (!participantName.trim()) {
      alert('Please enter your name first')
      return
    }

    setMeetingId(meetingId)
    setStoreName(participantName)
    navigate(`/meeting/${meetingId}/room`)
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
          <span className="bg-[#F5F2EE] border border-[#E8E4DD] text-[#6B6560] text-xs px-3 py-1.5 rounded-full font-mono">
            {meetingId}
          </span>
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
                  {isAudioEnabled ? <Mic size={20} /> : <Volume size={20} />}
                </button>
                <button
                  onClick={toggleVideo}
                  className={`w-11 h-11 rounded-full flex items-center justify-center transition ${
                    isVideoEnabled
                      ? 'bg-white/20 backdrop-blur-sm text-white hover:bg-white/30'
                      : 'bg-red-500/80 hover:bg-red-600 text-white'
                  }`}
                >
                  <Video size={20} />
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
              disabled={!participantName.trim() || !localStream}
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
