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
  MessageSquare,
  Send,
} from 'lucide-react'

export const VideoRoom = () => {
  const navigate = useNavigate()
  const { meetingId } = useParams()
  const videoRef = useRef(null)
  const screenVideoRef = useRef(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [showParticipants, setShowParticipants] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [hasUnread, setHasUnread] = useState(false)

  const {
    localStream,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    screenStream,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    initializeMedia,
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

  useEffect(() => {
    const init = async () => {
      await initializeMedia()
    }
    init()
    return () => {
      // cleanup handled by useWebRTC hook
    }
  }, [])

  useEffect(() => {
    if (isScreenSharing && screenVideoRef.current && screenStream.current) {
      screenVideoRef.current.srcObject = screenStream.current
    } else if (!isScreenSharing && screenVideoRef.current) {
      screenVideoRef.current.srcObject = null
    }
  }, [isScreenSharing, screenStream.current])

  useEffect(() => {
    if (isScreenSharing) {
      const timer = setTimeout(() => {
        if (screenVideoRef.current && screenStream.current) {
          screenVideoRef.current.srcObject = screenStream.current
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isScreenSharing])

  const handleEndCall = () => {
    if (confirm('End the meeting?')) {
      navigate(`/meeting/${meetingId}/summary`)
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

  const handleSendMessage = () => {
    if (!chatInput.trim()) return

    const newMessage = {
      id: Date.now(),
      sender: participantName,
      text: chatInput.trim(),
      time: new Date().toLocaleTimeString(),
      isOwn: true,
    }

    setMessages((prev) => [...prev, newMessage])
    setChatInput('')
  }

  useEffect(() => {
    if (showChat) {
      setHasUnread(false)
    }
  }, [showChat])

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

  const videoGridColumns = allParticipants.length <= 1 ? '1fr' : '2fr 1fr'
  const largeTileStyle = {
    minHeight: 320,
    ...(allParticipants.length >= 3 ? { gridRow: '1 / 3' } : {}),
  }

  return (
    <div className="h-screen bg-[#FAF9F7] text-[#1A1A1A] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-[#E8E4DD] px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 text-[#1A1A1A] font-semibold">
          <span className="text-[#7C3AED]">●</span>
          IntellMeet
          <div className="flex items-center gap-2 text-sm text-[#6B6560]">
            <Clock size={16} />
            <span>{formatTime(elapsedTime)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-red-500 text-white text-xs font-semibold">
            LIVE
          </span>
          <span className="text-sm text-[#6B6560] font-mono">{meetingId}</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 min-h-0 overflow-hidden bg-[#F5F2EE]">
        {/* Video Grid */}
        <div className="flex-1 min-h-0 overflow-hidden p-4">
          <div className="h-full grid gap-3" style={{ gridTemplateColumns: videoGridColumns }}>
              {/* Screen Share or Local Video (Large) */}
              <div
                className="relative bg-[#1A1A1A] rounded-2xl overflow-hidden"
                style={largeTileStyle}
              >
                {isScreenSharing ? (
                  <>
                    <video
                      ref={screenVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-contain bg-black"
                    />
                    <div className="absolute bottom-4 left-4 bg-black/70 px-4 py-2 rounded-xl">
                      <p className="font-bold text-sm">Your Screen</p>
                    </div>
                  </>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800/0">
                      {(!isVideoEnabled || !localStream) && (
                        <div className="absolute inset-0 bg-gray-800/90 flex items-center justify-center">
                          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-3xl font-bold">
                            {participantName
                              ? participantName
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .toUpperCase()
                              : '?'}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-4 left-4 bg-black/70 px-4 py-2 rounded-xl">
                      <p className="font-bold text-sm">{participantName}</p>
                      <p className="text-xs text-gray-300">You</p>
                    </div>
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
                  </>
                )}
              </div>

              {isScreenSharing && (
                <div className="relative bg-[#1A1A1A] rounded-2xl overflow-hidden" style={{ minHeight: 220 }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  {!isVideoEnabled && (
                    <div className="absolute inset-0 bg-gray-800/90 flex items-center justify-center">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-3xl font-bold">
                        {participantName.split(' ').map((n) => n[0]).join('')}
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-1 rounded-xl">
                    <p className="font-bold text-xs">{participantName}</p>
                    <p className="text-[10px] text-gray-300">You</p>
                  </div>
                </div>
              )}

              {/* Remote Videos */}
              {mockParticipants.map((participant) => (
                <div
                  key={participant.id}
                  className="relative bg-[#1A1A1A] rounded-2xl overflow-hidden shadow-lg"
                  style={{ minHeight: 220 }}
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

        {/* Participants Sidebar */}
        {showParticipants && (
          <div className="w-64 bg-white border-l border-[#E8E4DD] overflow-y-auto flex-shrink-0">
            <div className="p-4 border-b border-[#E8E4DD] sticky top-0 bg-white">
              <h2 className="text-sm font-semibold text-[#1A1A1A]">
                Participants ({allParticipants.length})
              </h2>
            </div>

            <div className="divide-y divide-[#E8E4DD]">
              {allParticipants.map((participant) => (
                <div key={participant.id} className="p-3 hover:bg-[#F5F2EE] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#F5F2EE] text-[#1A1A1A] flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold">
                        {participant.name.split(' ').map((n) => n[0]).join('')}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate text-[#1A1A1A]">
                        {participant.name}
                      </p>
                      {participant.isHost && (
                        <p className="text-xs text-[#7C3AED]">Host</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat Sidebar */}
        {showChat && (
          <div className="w-80 flex-shrink-0 bg-white border-l border-[#E8E4DD] flex flex-col h-full">
            <div className="p-4 border-b border-[#E8E4DD] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#1A1A1A]">Meeting Chat</h2>
                <p className="text-xs text-[#6B6560]">Stay connected with the room</p>
              </div>
              <button
                onClick={() => setShowChat(false)}
                className="text-[#6B6560] hover:text-[#1A1A1A]"
                title="Close Chat"
              >
                X
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {messages.length === 0 ? (
                <div className="text-center text-sm text-[#6B6560]">
                  No messages yet. Say hello!
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex flex-col max-w-full ${message.isOwn ? 'items-end' : 'items-start'}`}
                  >
                    <div className={`${message.isOwn ? 'bg-[#7C3AED] text-white' : 'bg-[#F5F2EE] text-[#1A1A1A]'} rounded-2xl px-3 py-2 text-sm`}>
                      <p className="text-xs text-[#6B6560] mb-1">
                        {message.sender}
                      </p>
                      <p>{message.text}</p>
                    </div>
                    <span className="text-xs text-[#6B6560] mt-1">
                      {message.time}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="flex-shrink-0 border-t border-[#E8E4DD] p-3 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                className="flex-1 bg-[#FAF9F7] border border-[#E8E4DD] text-[#1A1A1A] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#7C3AED]"
                placeholder="Type a message..."
              />
              <button
                onClick={handleSendMessage}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl p-2 transition"
                title="Send Message"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="bg-white border-t border-[#E8E4DD] px-4 py-3 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
          {/* Microphone Toggle */}
          <button
            onClick={toggleAudio}
            disabled={!localStream}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              isAudioEnabled
                ? 'bg-[#F5F2EE] text-[#1A1A1A] hover:bg-[#E8E4DD]'
                : 'bg-red-500 text-white hover:bg-red-600'
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
            disabled={!localStream}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              isVideoEnabled
                ? 'bg-[#F5F2EE] text-[#1A1A1A] hover:bg-[#E8E4DD]'
                : 'bg-red-500 text-white hover:bg-red-600'
            }`}
            title={isVideoEnabled ? 'Stop Video' : 'Start Video'}
          >
            <Video size={20} />
          </button>

          {/* Screen Share */}
          <button
            onClick={isScreenSharing ? stopScreenShare : startScreenShare}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              isScreenSharing
                ? 'bg-[#7C3AED] text-white hover:bg-[#6D28D9]'
                : 'bg-[#F5F2EE] text-[#1A1A1A] hover:bg-[#E8E4DD]'
            }`}
            title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
          >
            <Share2 size={20} />
          </button>

          {/* Participants Toggle */}
          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className="w-12 h-12 rounded-full bg-[#F5F2EE] text-[#1A1A1A] hover:bg-[#E8E4DD] flex items-center justify-center transition-colors relative"
            title="Show Participants"
          >
            <Users size={20} />
            <span className="absolute top-0 right-0 -mt-1 -mr-1 bg-[#7C3AED] text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {allParticipants.length}
            </span>
          </button>

          {/* Chat Toggle */}
          <button
            onClick={() => setShowChat((prev) => !prev)}
            className="w-12 h-12 rounded-full bg-[#F5F2EE] text-[#1A1A1A] hover:bg-[#E8E4DD] flex items-center justify-center transition-colors relative"
            title="Toggle Chat"
          >
            <MessageSquare size={20} />
            {!showChat && hasUnread && (
              <span className="absolute top-0 right-0 -mt-1 -mr-1 bg-red-500 w-3 h-3 rounded-full" />
            )}
          </button>

          {/* End Call */}
          <button
            onClick={handleEndCall}
            className="w-12 h-12 rounded-full bg-red-500 text-white hover:bg-red-600 flex items-center justify-center transition-colors ml-4"
            title="End Call"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}
