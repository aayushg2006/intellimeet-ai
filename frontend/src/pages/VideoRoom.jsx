import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useWebRTC } from '../hooks/useWebRTC'
import { useMeetingStore } from '../store/meetingStore'
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Share2,
  Users,
  Clock,
  MessageSquare,
  Send,
  MoreVertical,
  Maximize,
  Grid,
  Sidebar,
  Focus,
  Hand,
  Smile,
  X,
} from 'lucide-react'

const VideoTile = ({ tile, large = false, pinnedId, setPinnedId, reaction, raisedHand, localStream, videoRef }) => {
  const tileRef = tile.isLocal ? videoRef : null
  const internalRef = useRef(null)

  // Re-attach video when tile becomes visible
  useEffect(() => {
    if (tile.isLocal && tileRef && localStream) {
      const timer = setTimeout(() => {
        if (tileRef.current) {
          tileRef.current.srcObject = localStream
        }
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [tile.isLocal, localStream, tileRef])

  return (
    <div
      className={`relative bg-[#1C1C1E] rounded-2xl overflow-hidden group transition-all duration-300 w-full h-full`}
    >
      <div className="w-full h-full flex items-center justify-center bg-[#2C2C2E]">
        {tile.isLocal ? (
          <>
            <video
              ref={tileRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
            {(!tile.isVideo || !localStream) && (
              <div className="absolute inset-0 bg-[#2C2C2E] flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-[#7C3AED]/30 text-[#7C3AED] text-2xl font-bold flex items-center justify-center">
                  {tile.name?.split(' ').map((n) => n[0]).join('').toUpperCase() || '?'}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-[#2C2C2E] flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mb-2">
              <span className="text-xl font-bold text-white">{tile.avatar}</span>
            </div>
            <p className="text-white/70 text-sm">{tile.name}</p>
          </div>
        )}
      </div>

      {tile.isLocal && reaction && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl animate-bounce pointer-events-none">
          {reaction}
        </div>
      )}

      {tile.isLocal && raisedHand && (
        <div className="absolute top-3 left-3 bg-yellow-400 text-black text-xs px-2 py-1 rounded-full font-semibold flex items-center gap-1">
          ✋ Hand raised
        </div>
      )}

      <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
        <div className="bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-lg flex items-center gap-1.5">
          {!tile.isAudio && <MicOff size={11} className="text-red-400" />}
          <p className="text-white text-xs font-medium">
            {tile.name}
            {tile.isLocal ? ' (You)' : ''}
          </p>
        </div>
      </div>

      <button
        onClick={() => setPinnedId(pinnedId === tile.id ? null : tile.id)}
        className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
        title={pinnedId === tile.id ? 'Unpin' : 'Pin'}
      >
        <Focus size={12} />
      </button>
    </div>
  )
}

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
  const [layoutMode, setLayoutMode] = useState('auto')
  const [showLayoutModal, setShowLayoutModal] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [raisedHand, setRaisedHand] = useState(false)
  const [reaction, setReaction] = useState(null)
  const [showReactions, setShowReactions] = useState(false)
  const [pinnedId, setPinnedId] = useState(null)

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
  }, [localStream, layoutMode])

  // Re-attach video when layout or pinnedId changes
  useEffect(() => {
    if (videoRef.current && localStream) {
      const timer = setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = localStream
        }
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [layoutMode, pinnedId, isScreenSharing, localStream])

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

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const sendReaction = (emoji) => {
    setReaction(emoji)
    setShowReactions(false)
    setTimeout(() => setReaction(null), 3000)
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
    { id: '2', name: 'Alice Johnson', avatar: 'AJ', isAudio: true, isVideo: true },
    { id: '3', name: 'Bob Smith', avatar: 'BS', isAudio: false, isVideo: true },
    { id: '4', name: 'Carol White', avatar: 'CW', isAudio: true, isVideo: false },
    { id: '5', name: 'David Lee', avatar: 'DL', isAudio: true, isVideo: true },
    { id: '6', name: 'Emma Davis', avatar: 'ED', isAudio: false, isVideo: true },
    { id: '7', name: 'Frank Wilson', avatar: 'FW', isAudio: true, isVideo: true },
    { id: '8', name: 'Grace Kim', avatar: 'GK', isAudio: true, isVideo: false },
    { id: '9', name: 'Henry Brown', avatar: 'HB', isAudio: false, isVideo: true },
    { id: '10', name: 'Iris Chen', avatar: 'IC', isAudio: true, isVideo: true },
    { id: '11', name: 'James Park', avatar: 'JP', isAudio: true, isVideo: true },
    { id: '12', name: 'Karen White', avatar: 'KW', isAudio: false, isVideo: false },
  ]

  const allParticipants = [
    { id: '1', name: participantName, isHost: true },
    ...mockParticipants,
  ]

  const layouts = [
    { id: 'auto', label: 'Auto', desc: 'Dynamic layout', icon: '▦' },
    { id: 'grid', label: 'Tiled', desc: 'Equal size tiles', icon: '⊞' },
    { id: 'spotlight', label: 'Spotlight', desc: 'One large tile', icon: '▬' },
    { id: 'sidebar', label: 'Sidebar', desc: 'Main + strip', icon: '▥' },
  ]

  const allTiles = [
    {
      id: '1',
      name: participantName || 'You',
      isLocal: true,
      isAudio: isAudioEnabled,
      isVideo: isVideoEnabled,
    },
    ...mockParticipants.map((p) => ({ ...p, isLocal: false })),
  ]

  // Calculate columns based on participant count
  const getGridColumns = () => {
    if (allTiles.length <= 2) return 1
    if (allTiles.length <= 4) return 2
    if (allTiles.length <= 9) return 3
    return 4
  }

  // Render different layouts based on mode
  const renderLayoutContent = () => {
    const GAP = 'gap-3'
    const tiles = allTiles

    // Screen sharing layout
    if (isScreenSharing) {
      return (
        <div className={`h-full flex ${GAP}`}>
          <div className="flex-1 relative bg-[#1C1C1E] rounded-2xl overflow-hidden">
            <video ref={screenVideoRef} autoPlay playsInline className="w-full h-full object-contain" />
            <div className="absolute bottom-3 left-3 bg-black/60 px-2.5 py-1 rounded-lg">
              <p className="text-white text-xs">Your Screen</p>
            </div>
          </div>
          <div className="w-56 flex flex-col overflow-y-auto">
            <div className={`flex flex-col ${GAP}`}>
              {tiles.map((tile) => (
                <div key={tile.id} className="h-40 flex-shrink-0 aspect-video">
                  <VideoTile
                    tile={tile}
                    pinnedId={pinnedId}
                    setPinnedId={setPinnedId}
                    reaction={reaction}
                    raisedHand={raisedHand}
                    localStream={localStream}
                    videoRef={videoRef}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }

    // Spotlight layout - main tile on top, thumbnails below
    if (layoutMode === 'spotlight') {
      return (
        <div className="h-full flex flex-col gap-3">
          <div className="flex-1 min-h-0 max-h-[calc(100%-140px)]">
            <VideoTile
              tile={tiles[0]}
              large
              pinnedId={pinnedId}
              setPinnedId={setPinnedId}
              reaction={reaction}
              raisedHand={raisedHand}
              localStream={localStream}
              videoRef={videoRef}
            />
          </div>
          {tiles.length > 1 && (
            <div className="h-32 flex flex-shrink-0 overflow-x-auto gap-3 pb-2">
              {tiles.slice(1).map((tile) => (
                <div key={tile.id} className="w-48 h-full flex-shrink-0">
                  <VideoTile
                    tile={tile}
                    pinnedId={pinnedId}
                    setPinnedId={setPinnedId}
                    reaction={reaction}
                    raisedHand={raisedHand}
                    localStream={localStream}
                    videoRef={videoRef}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    // Sidebar layout - large tile on left, grid on right
    if (layoutMode === 'sidebar') {
      return (
        <div className="h-full grid gap-3" style={{ gridTemplateColumns: '2fr 1fr' }}>
          <div className="overflow-hidden">
            <VideoTile
              tile={tiles[0]}
              large
              pinnedId={pinnedId}
              setPinnedId={setPinnedId}
              reaction={reaction}
              raisedHand={raisedHand}
              localStream={localStream}
              videoRef={videoRef}
            />
          </div>
          <div className="overflow-y-auto">
            <div className={`grid grid-cols-1 gap-3`}>
              {tiles.slice(1).map((tile) => (
                <div key={tile.id} className="h-28">
                  <VideoTile
                    tile={tile}
                    pinnedId={pinnedId}
                    setPinnedId={setPinnedId}
                    reaction={reaction}
                    raisedHand={raisedHand}
                    localStream={localStream}
                    videoRef={videoRef}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }

    // Grid/Auto layout - uniform grid with consistent sizing
    const cols = getGridColumns()
    const minTileHeight = 180
    
    return (
      <div className="h-full w-full">
        <div className="grid gap-3 w-full h-full" style={{ 
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridAutoRows: `minmax(${minTileHeight}px, 1fr)`
        }}>
          {tiles.map((tile) => (
            <div key={tile.id} className="w-full h-full overflow-hidden rounded-2xl">
              <VideoTile
                tile={tile}
                pinnedId={pinnedId}
                setPinnedId={setPinnedId}
                reaction={reaction}
                raisedHand={raisedHand}
                localStream={localStream}
                videoRef={videoRef}
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-[#111113] text-white flex flex-col overflow-hidden">
      <div className="px-5 py-3 flex items-center justify-between flex-shrink-0 bg-[#111113] relative">
        <div className="flex items-center gap-3">
          <span className="text-[#7C3AED]">●</span>
          <span className="text-white font-semibold text-sm">IntellMeet</span>
          <span className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2 text-sm text-white/40">
            <Clock size={14} />
            <span>{formatTime(elapsedTime)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs px-2.5 py-1 rounded-full font-semibold">
            LIVE
          </span>
          <span className="text-xs text-white/40 font-mono">{meetingId}</span>

          <button
            onClick={() => setShowMoreMenu((prev) => !prev)}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition relative"
            title="More options"
          >
            <MoreVertical size={16} />
          </button>

          {showMoreMenu && (
            <div className="absolute top-full right-5 mt-2 w-52 bg-[#1C1C1E] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
              <button
                onClick={() => {
                  setShowLayoutModal(true)
                  setShowMoreMenu(false)
                }}
                className="flex items-center gap-3 px-4 py-3 text-sm text-white/80 hover:bg-white/5 transition-colors w-full text-left"
              >
                <Grid size={16} className="text-white/50" />
                Change layout
              </button>
              <button
                onClick={handleFullscreen}
                className="flex items-center gap-3 px-4 py-3 text-sm text-white/80 hover:bg-white/5 transition-colors w-full text-left"
              >
                <Maximize size={16} className="text-white/50" />
                {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              </button>
              <div className="border-t border-white/10 my-1" />
              <button
                onClick={() => setShowMoreMenu(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm text-white/40 cursor-not-allowed"
              >
                <Sidebar size={16} className="text-white/30" />
                Settings
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-hidden p-4">
            {renderLayoutContent()}
          </div>
        </div>

        {showParticipants && (
          <div className="w-64 bg-[#1C1C1E] border-l border-white/10 flex flex-col flex-shrink-0">
            <div className="px-4 py-3 border-b border-white/10">
              <h2 className="text-sm font-semibold text-white">Participants</h2>
              <p className="text-xs text-white/40">{allParticipants.length} in room</p>
            </div>
            <div className="divide-y divide-white/10 overflow-y-auto">
              {allParticipants.map((participant) => (
                <div key={participant.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-[#7C3AED]/20 text-[#7C3AED] text-xs font-semibold flex items-center justify-center">
                    {participant.name?.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-white/80 truncate">{participant.name}</p>
                    {participant.isHost && <p className="text-xs text-[#7C3AED]">Host</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {showChat && (
          <div className="w-80 bg-[#1C1C1E] border-l border-white/10 flex flex-col flex-shrink-0">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Meeting Chat</h2>
                <p className="text-xs text-white/40">Stay connected with the room</p>
              </div>
              <button onClick={() => setShowChat(false)} className="text-white/40 hover:text-white transition">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {messages.length === 0 ? (
                <div className="text-sm text-white/30 text-center mt-8">No messages yet. Say hello!</div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className={`flex flex-col max-w-full ${message.isOwn ? 'items-end' : 'items-start'}`}>
                    <div className={`${message.isOwn ? 'bg-[#7C3AED] text-white rounded-2xl rounded-br-sm' : 'bg-white/10 text-white rounded-2xl rounded-bl-sm'} px-3 py-2 text-sm`}>
                      <p className="text-xs text-white/40 mb-1">{message.sender}</p>
                      <p>{message.text}</p>
                    </div>
                    <span className="text-xs text-white/30 mt-1">{message.time}</span>
                  </div>
                ))
              )}
            </div>
            <div className="p-3 border-t border-white/10 flex gap-2">
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
                className="flex-1 bg-white/10 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:bg-white/15 placeholder-white/30"
                placeholder="Type a message..."
              />
              <button onClick={handleSendMessage} className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl p-2 transition" title="Send Message">
                <Send size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="px-6 py-4 flex items-center justify-center gap-2 flex-shrink-0 bg-[#111113]">
        <button
          onClick={toggleAudio}
          disabled={!localStream}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            isAudioEnabled ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-red-500 text-white hover:bg-red-600'
          }`}
          title={isAudioEnabled ? 'Mute' : 'Unmute'}
        >
          {isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
        </button>

        <button
          onClick={toggleVideo}
          disabled={!localStream}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            isVideoEnabled ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-red-500 text-white hover:bg-red-600'
          }`}
          title={isVideoEnabled ? 'Stop Video' : 'Start Video'}
        >
          {isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
        </button>

        <button
          onClick={isScreenSharing ? stopScreenShare : startScreenShare}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            isScreenSharing ? 'bg-[#7C3AED] text-white hover:bg-[#6D28D9]' : 'bg-white/10 text-white hover:bg-white/20'
          }`}
          title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
        >
          <Share2 size={20} />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowReactions((prev) => !prev)}
            className="w-12 h-12 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all"
            title="Reactions"
          >
            <Smile size={20} />
          </button>
          {showReactions && (
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-[#1C1C1E] border border-white/10 rounded-2xl px-3 py-2 flex gap-2 shadow-2xl">
              {['👍', '❤️', '😂', '😮', '👏', '🎉'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  className="text-2xl hover:scale-125 transition-transform"
                  type="button"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setRaisedHand((prev) => !prev)}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            raisedHand ? 'bg-yellow-400 text-black hover:bg-yellow-300' : 'bg-white/10 text-white hover:bg-white/20'
          }`}
          title="Raise hand"
        >
          <Hand size={20} />
        </button>

        <button
          onClick={() => setShowParticipants(!showParticipants)}
          className="w-12 h-12 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all relative"
          title="Show Participants"
        >
          <Users size={20} />
          <span className="absolute top-0 right-0 -mt-1 -mr-1 bg-[#7C3AED] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {allParticipants.length}
          </span>
        </button>

        <button
          onClick={() => setShowChat((prev) => !prev)}
          className="w-12 h-12 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all relative"
          title="Toggle Chat"
        >
          <MessageSquare size={20} />
          {!showChat && hasUnread && <span className="absolute top-0 right-0 -mt-1 -mr-1 bg-red-500 w-3 h-3 rounded-full" />}
        </button>

        <button
          onClick={handleEndCall}
          className="w-12 h-12 rounded-full bg-red-500 text-white hover:bg-red-600 flex items-center justify-center transition-all ml-2"
          title="End Call"
        >
          <PhoneOff size={20} />
        </button>
      </div>

      {showLayoutModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowLayoutModal(false)}
        >
          <div
            className="relative bg-[#1C1C1E] border border-white/10 rounded-2xl p-6 w-96 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowLayoutModal(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white"
            >
              <X size={18} />
            </button>
            <h2 className="text-lg font-semibold text-white mb-1">Change layout</h2>
            <p className="text-sm text-white/40 mb-6">Layout preference saved for this meeting.</p>
            <div className="grid grid-cols-2 gap-3">
              {layouts.map((layout) => {
                const active = layoutMode === layout.id
                return (
                  <button
                    key={layout.id}
                    onClick={() => {
                      setLayoutMode(layout.id)
                      setShowLayoutModal(false)
                      setPinnedId(null)
                    }}
                    className={`relative cursor-pointer rounded-xl border-2 p-4 text-left transition-all ${
                      active
                        ? 'border-[#7C3AED] bg-[#7C3AED]/10'
                        : 'border-white/10 bg-white/5 hover:border-white/30'
                    }`}
                    type="button"
                  >
                    <div className={`absolute top-3 right-3 w-4 h-4 rounded-full border-2 ${active ? 'border-[#7C3AED] bg-[#7C3AED]' : 'border-white/30'} flex items-center justify-center`}>
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div className="mb-3 h-12 rounded-lg bg-white/5 overflow-hidden flex gap-1 p-1.5">
                      {layout.id === 'auto' && (
                        <div className="grid grid-cols-2 gap-1 w-full h-full">
                          <div className="bg-white/20 rounded" />
                          <div className="bg-white/20 rounded" />
                          <div className="bg-white/20 rounded" />
                          <div className="bg-white/20 rounded" />
                        </div>
                      )}
                      {layout.id === 'grid' && (
                        <div className="flex gap-1 w-full h-full">
                          <div className="bg-white/20 rounded flex-1" />
                          <div className="bg-white/20 rounded flex-1" />
                          <div className="bg-white/20 rounded flex-1" />
                        </div>
                      )}
                      {layout.id === 'spotlight' && (
                        <div className="flex flex-col gap-1 w-full h-full">
                          <div className="bg-white/20 rounded flex-1" />
                          <div className="flex gap-1 h-4">
                            <div className="bg-white/10 rounded flex-1" />
                            <div className="bg-white/10 rounded flex-1" />
                          </div>
                        </div>
                      )}
                      {layout.id === 'sidebar' && (
                        <div className="flex gap-1 w-full h-full">
                          <div className="bg-white/20 rounded flex-[2]" />
                          <div className="flex flex-col gap-1 flex-1">
                            <div className="bg-white/10 rounded flex-1" />
                            <div className="bg-white/10 rounded flex-1" />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-medium text-white">{layout.label}</div>
                    <div className="text-xs text-white/40">{layout.desc}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
