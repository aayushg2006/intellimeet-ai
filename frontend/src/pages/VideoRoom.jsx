import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useWebRTC } from '../hooks/useWebRTC'
import { useMeetingStore } from '../store/meetingStore'
import {
  Mic,
  Volume,
  Video,
  Volume2,
  PhoneOff,
  Share2,
  Users,
  Clock,
} from 'lucide-react'

export const VideoRoom = () => {
  const navigate = useNavigate()
  const { meetingId } = useParams()
  const videoRef = useRef(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [showParticipants, setShowParticipants] = useState(false)

  const {
    localStream,
    isAudioEnabled,
    isVideoEnabled,
    toggleAudio,
    toggleVideo,
  } = useWebRTC()

  const { participantName, participants } = useMeetingStore()

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Connect video stream
  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream
    }
  }, [localStream])

  const handleEndCall = () => {
    if (confirm('End the meeting?')) {
      navigate('/dashboard')
    }
  }

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  // Mock participants for demo
  const mockParticipants = [
    {
      id: '2',
      name: 'Alice Johnson',
      isAudio: true,
      isVideo: true,
      avatar: 'AJ',
    },
    {
      id: '3',
      name: 'Bob Smith',
      isAudio: false,
      isVideo: true,
      avatar: 'BS',
    },
  ]

  const allParticipants = [
    { id: '1', name: participantName, isHost: true },
    ...mockParticipants,
  ]

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-black bg-opacity-50 backdrop-blur-md border-b border-gray-700 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">IntellMeet</h1>
          <div className="flex items-center gap-2 text-gray-400">
            <Clock size={16} />
            <span>{formatTime(elapsedTime)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-full">
            LIVE
          </span>
          <span className="text-gray-300">Meeting ID: {meetingId}</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-65px)]">
        {/* Video Grid */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
            {/* Video Grid Container */}
            <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Local Video (Large) */}
              <div className="col-span-1 md:col-span-2 lg:col-span-2 bg-black rounded-lg overflow-hidden shadow-2xl relative group">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />

                {/* Name Badge */}
                <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 px-4 py-2 rounded-lg backdrop-blur-md">
                  <p className="font-bold text-sm">{participantName}</p>
                  <p className="text-xs text-gray-300">You</p>
                </div>

                {/* Audio/Video Status */}
                <div className="absolute bottom-4 right-4 flex gap-2">
                  {!isAudioEnabled && (
                    <div className="bg-red-600 text-white p-2 rounded-full">
                      <Volume size={18} />
                    </div>
                  )}
                  {!isVideoEnabled && (
                    <div className="bg-red-600 text-white p-2 rounded-full">
                      <Volume2 size={18} />
                    </div>
                  )}
                </div>
              </div>

              {/* Remote Videos */}
              {mockParticipants.map((participant) => (
                <div
                  key={participant.id}
                  className="bg-gray-800 rounded-lg overflow-hidden shadow-lg relative group"
                >
                  {/* Video Placeholder */}
                  <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mb-2">
                      <span className="text-2xl font-bold">
                        {participant.avatar}
                      </span>
                    </div>
                    <p className="font-bold text-center px-2">
                      {participant.name}
                    </p>
                  </div>

                  {/* Name Badge */}
                  <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 px-3 py-1 rounded-lg backdrop-blur-md">
                    <p className="text-xs font-bold">{participant.name}</p>
                  </div>

                  {/* Audio/Video Status */}
                  <div className="absolute bottom-4 right-4 flex gap-2">
                    {!participant.isAudio && (
                      <div className="bg-red-600 text-white p-2 rounded-full">
                        <Volume size={16} />
                      </div>
                    )}
                    {!participant.isVideo && (
                      <div className="bg-red-600 text-white p-2 rounded-full">
                        <Volume2 size={16} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Participants Sidebar */}
        {showParticipants && (
          <div className="w-64 bg-gray-800 border-l border-gray-700 overflow-y-auto">
            <div className="p-4 border-b border-gray-700 sticky top-0 bg-gray-800">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Users size={20} />
                Participants ({allParticipants.length})
              </h2>
            </div>

            <div className="divide-y divide-gray-700">
              {allParticipants.map((participant) => (
                <div key={participant.id} className="p-3 hover:bg-gray-700 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold">
                        {participant.name.split(' ').map((n) => n[0]).join('')}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {participant.name}
                      </p>
                      {participant.isHost && (
                        <p className="text-xs text-purple-400">Host</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="bg-black bg-opacity-70 backdrop-blur-md border-t border-gray-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-4">
          {/* Microphone Toggle */}
          <button
            onClick={toggleAudio}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
              isAudioEnabled
                ? 'bg-gray-700 text-white hover:bg-gray-600'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
            title={isAudioEnabled ? 'Mute' : 'Unmute'}
          >
            {isAudioEnabled ? (
              <Mic size={20} />
            ) : (
              <Volume size={20} />
            )}
          </button>

          {/* Video Toggle */}
          <button
            onClick={toggleVideo}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
              isVideoEnabled
                ? 'bg-gray-700 text-white hover:bg-gray-600'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
            title={isVideoEnabled ? 'Stop Video' : 'Start Video'}
          >
            <Video size={20} />
          </button>

          {/* Screen Share */}
          <button
            className="w-12 h-12 rounded-full bg-gray-700 text-white hover:bg-gray-600 flex items-center justify-center transition"
            title="Share Screen"
          >
            <Share2 size={20} />
          </button>

          {/* Participants Toggle */}
          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className="w-12 h-12 rounded-full bg-gray-700 text-white hover:bg-gray-600 flex items-center justify-center transition relative"
            title="Show Participants"
          >
            <Users size={20} />
            <span className="absolute top-0 right-0 -mt-1 -mr-1 bg-blue-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {allParticipants.length}
            </span>
          </button>

          {/* End Call */}
          <button
            onClick={handleEndCall}
            className="w-12 h-12 rounded-full bg-red-600 text-white hover:bg-red-700 flex items-center justify-center transition ml-4"
            title="End Call"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}
