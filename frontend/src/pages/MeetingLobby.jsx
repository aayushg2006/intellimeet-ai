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
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Accessing camera and microphone...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">IntellMeet Lobby</h1>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-white hover:text-gray-200"
          >
            <ArrowLeft size={20} />
            Back
          </button>
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left - Video Preview */}
          <div className="lg:col-span-2">
            <div className="bg-black rounded-lg overflow-hidden shadow-2xl">
              {/* Video Element */}
              <div className="relative">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-96 object-cover bg-black"
                />

                {/* Status Badges */}
                <div className="absolute top-4 right-4 flex gap-2">
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium ${
                      isAudioEnabled
                        ? 'bg-green-500 text-white'
                        : 'bg-red-500 text-white'
                    }`}
                  >
                    {isAudioEnabled ? (
                      <Mic size={16} />
                    ) : (
                      <Volume size={16} />
                    )}
                    {isAudioEnabled ? 'Microphone On' : 'Microphone Off'}
                  </div>

                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium ${
                      isVideoEnabled
                        ? 'bg-green-500 text-white'
                        : 'bg-red-500 text-white'
                    }`}
                  >
                    {isVideoEnabled ? (
                      <Video size={16} />
                    ) : (
                      <Video size={16} className="line-through" />
                    )}
                    {isVideoEnabled ? 'Camera On' : 'Camera Off'}
                  </div>
                </div>

                {/* Control Buttons */}
                <div className="absolute bottom-4 left-4 right-4 flex gap-3 justify-center">
                  <button
                    onClick={toggleAudio}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
                      isAudioEnabled
                        ? 'bg-white text-gray-900 hover:bg-gray-100'
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    {isAudioEnabled ? (
                      <Mic size={20} />
                    ) : (
                      <Volume size={20} />
                    )}
                  </button>

                  <button
                    onClick={toggleVideo}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
                      isVideoEnabled
                        ? 'bg-white text-gray-900 hover:bg-gray-100'
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    <Video size={20} />
                  </button>
                </div>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="bg-red-600 text-white p-4 text-center">
                  ⚠️ {error}
                </div>
              )}
            </div>
          </div>

          {/* Right - Settings */}
          <div className="space-y-6">
            {/* Participant Name */}
            <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-lg p-6 text-white">
              <h3 className="font-bold text-lg mb-4">Participant Name</h3>
              <input
                type="text"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-2 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>

            {/* Audio Device */}
            <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-lg p-6 text-white">
              <h3 className="font-bold text-lg mb-4">🎤 Microphone</h3>
              <select
                value={selectedAudio}
                onChange={(e) => handleDeviceSwitch(e.target.value, 'audio')}
                className="w-full px-4 py-2 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
              >
                {audioDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Video Device */}
            <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-lg p-6 text-white">
              <h3 className="font-bold text-lg mb-4">📹 Camera</h3>
              <select
                value={selectedVideo}
                onChange={(e) => handleDeviceSwitch(e.target.value, 'video')}
                className="w-full px-4 py-2 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
              >
                {videoDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${device.deviceId.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Join Button */}
            <button
              onClick={handleJoinMeeting}
              disabled={!participantName.trim() || !localStream}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 rounded-lg font-bold hover:from-green-600 hover:to-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Play size={20} />
              Start Meeting
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
