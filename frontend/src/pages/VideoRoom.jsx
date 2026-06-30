import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useWebRTC } from '../hooks/useWebRTC'
import { useMeetingStore } from '../store/meetingStore'
import { useAuthStore } from '../store/authStore'
import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'
import axios from 'axios'
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
  Copy,
  Check,
  Circle,
  Paperclip,
  FileIcon,
  FileText,
  CheckSquare,
  Plus
} from 'lucide-react'
import { io } from 'socket.io-client'

const VideoTile = ({ tile, large = false, pinnedId, setPinnedId, localStream, remoteStreams, videoRef }) => {
  const internalRef = useRef(null)
  const tileRef = tile.isLocal ? videoRef : internalRef

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

  // Attach remote stream
  useEffect(() => {
    if (!tile.isLocal && tileRef.current && remoteStreams && remoteStreams[tile.id]) {
      tileRef.current.srcObject = remoteStreams[tile.id]
    }
  }, [tile.isLocal, tile.id, remoteStreams, tileRef])

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
        ) : remoteStreams && remoteStreams[tile.id] ? (
          <>
            <video
              ref={tileRef}
              autoPlay
              playsInline
              className={`w-full h-full ${tile.isScreenShare ? 'object-contain bg-black' : 'object-cover'}`}
            />
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

      {tile.reaction && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl animate-bounce pointer-events-none">
          {tile.reaction}
        </div>
      )}

      {tile.raisedHand && (
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
  const [showNotes, setShowNotes] = useState(false)
  const [showTasks, setShowTasks] = useState(false)
  const [sharedNotes, setSharedNotes] = useState('')
  const [tasks, setTasks] = useState([])
  const [newTaskTitle, setNewTaskTitle] = useState('')
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
  const [copied, setCopied] = useState(false)
  const [captions, setCaptions] = useState([])
  const [interimCaption, setInterimCaption] = useState('')
  const [speechUnsupported, setSpeechUnsupported] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [sharedFiles, setSharedFiles] = useState([])
  const mediaRecorderRef = useRef(null)
  const recordedChunksRef = useRef([])
  const recordingTimerRef = useRef(null)
  const fileInputRef = useRef(null)
  const recordingUploadPromiseRef = useRef(null)
  const [isEndingCall, setIsEndingCall] = useState(false)

  const {
    localStream,
    remoteStreams,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    screenStream,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    initializeMedia,
    stopMedia,
    handleUserConnected,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    handleUserDisconnected
  } = useWebRTC()

  const { participantName } = useMeetingStore()
  const { user } = useAuthStore()

  // Normalize user ID once
  const userId = user?._id || user?.id || null
  const displayName = participantName || user?.name || 'Guest'

  // Socket.io connection
  const socketRef = useRef(null)
  const [meetingInfo, setMeetingInfo] = useState(null)
  const [isHost, setIsHost] = useState(false)
  const isHostRef = useRef(false) // Stable ref for socket listeners
  const [waitingForHost, setWaitingForHost] = useState(false)
  const [joinRequests, setJoinRequests] = useState([])
  const [remoteParticipants, setRemoteParticipants] = useState([])
  const [remoteReactions, setRemoteReactions] = useState({}) // socketId -> emoji
  const [remoteHands, setRemoteHands] = useState({}) // socketId -> boolean
  const [remoteScreenSharer, setRemoteScreenSharer] = useState(null) // socketId of remote screen sharer
  const recognitionRef = useRef(null)
  const isAudioEnabledRef = useRef(isAudioEnabled)

  // Keep refs in sync
  useEffect(() => {
    isHostRef.current = isHost
  }, [isHost])

  useEffect(() => {
    isAudioEnabledRef.current = isAudioEnabled
  }, [isAudioEnabled])

  // ─── INITIALIZE MEDIA ON MOUNT ───
  useEffect(() => {
    initializeMedia()
  }, [initializeMedia])

  // ─── SINGLE STABLE SOCKET LIFECYCLE ───
  useEffect(() => {
    let cancelled = false

    const setup = async () => {
      // 1. Fetch meeting info to determine host
      let meetingData = null
      try {
        const tokenStore = localStorage.getItem('auth-storage')
        const token = tokenStore ? JSON.parse(tokenStore).state?.token : null
        const res = await axios.get(`/api/meetings/room/${meetingId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
        meetingData = res.data
      } catch (err) {
        console.error('[VideoRoom] Error fetching meeting:', err)
        if (err.response?.status === 404) {
          alert('Meeting not found!')
          navigate('/dashboard')
          return
        }
      }

      if (cancelled || !meetingData) return

      setMeetingInfo(meetingData)
      if (meetingData.notes) setSharedNotes(meetingData.notes)

      // 1.5 Fetch past messages and tasks
      try {
        const tokenStore = localStorage.getItem('auth-storage')
        const token = tokenStore ? JSON.parse(tokenStore).state?.token : null
        const [msgRes, taskRes] = await Promise.all([
          axios.get(`/api/messages/${meetingId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
          axios.get(`/api/tasks?meetingId=${meetingData._id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        ])
        
        const pastMessages = msgRes.data.map(msg => ({
          id: msg._id,
          sender: msg.sender?.name || 'Unknown',
          text: msg.text,
          type: msg.type || 'text',
          fileUrl: msg.fileUrl,
          fileName: msg.fileName,
          fileSize: msg.fileSize,
          time: new Date(msg.createdAt).toLocaleTimeString(),
          isOwn: String(msg.sender?._id) === String(userId),
        }))
        setMessages(pastMessages)
        setTasks(taskRes.data)
      } catch (err) {
        console.error('[VideoRoom] Error fetching history:', err)
      }

      // 2. Determine host status
      const hostId = meetingData.host?._id || meetingData.host
      const currentIsHost = !!(userId && hostId && String(hostId) === String(userId))
      setIsHost(currentIsHost)
      isHostRef.current = currentIsHost

      if (!currentIsHost) {
        setWaitingForHost(true)
      }

      // 3. Connect socket
      const socketUrl = import.meta.env.DEV ? 'http://localhost:5000' : '/'
      const socket = io(socketUrl, { 
        path: '/socket.io',
        auth: { token }
      })
      socketRef.current = socket

      socket.on('connect', () => {
        console.log('[VideoRoom] Socket connected:', socket.id)
        socket.emit('join-room', meetingId, {
          id: userId,
          name: displayName,
          avatar: displayName?.charAt(0)?.toUpperCase() || '?'
        })
      })

      socket.on('room-joined', (data) => {
        console.log('[VideoRoom] Room joined:', data)
      })

      socket.on('room-error', (msg) => {
        alert(msg)
        navigate('/dashboard')
      })

      // Host receives join requests
      socket.on('join-request', (data) => {
        // Use ref so this listener always has the latest isHost value
        if (isHostRef.current) {
          console.log('[VideoRoom] Join request from:', data.userObj?.name)
          setJoinRequests((prev) => {
            if (prev.find((r) => r.socketId === data.socketId)) return prev
            return [...prev, data]
          })
        }
      })

      // Guest accepted
      socket.on('join-accepted', () => {
        console.log('[VideoRoom] Join accepted!')
        setWaitingForHost(false)
      })

      // Guest rejected
      socket.on('join-rejected', () => {
        alert('The host declined your request to join.')
        navigate('/dashboard')
      })

      // Chat messages
      socket.on('chat-message', (msg) => {
        setMessages((prev) => [
          ...prev,
          {
            id: msg._id,
            sender: msg.sender?.name || 'Unknown',
            text: msg.text,
            type: msg.type || 'text',
            fileUrl: msg.fileUrl,
            fileName: msg.fileName,
            fileSize: msg.fileSize,
            time: new Date(msg.createdAt).toLocaleTimeString(),
            isOwn: String(msg.sender?._id) === String(userId),
          },
        ])
        setHasUnread(true)
      })

      // Shared notes
      socket.on('note-update', (newNotes) => {
        setSharedNotes(newNotes)
      })

      // WebRTC events
      socket.on('user-connected', (remoteSocketId, userObj) => {
        console.log('[VideoRoom] user-connected:', remoteSocketId, userObj?.name)
        setRemoteParticipants((prev) => {
          if (prev.find((p) => p.id === remoteSocketId)) return prev
          return [...prev, { id: remoteSocketId, name: userObj?.name || 'Guest', avatar: userObj?.avatar || '?', isAudio: true, isVideo: true }]
        })
        handleUserConnected(remoteSocketId, socketRef)
      })

      socket.on('webrtc-offer', (offer, senderSocketId, userObj) => {
        console.log('[VideoRoom] webrtc-offer from:', senderSocketId)
        setRemoteParticipants((prev) => {
          if (prev.find((p) => p.id === senderSocketId)) return prev
          return [...prev, { id: senderSocketId, name: userObj?.name || 'Guest', avatar: userObj?.avatar || '?', isAudio: true, isVideo: true }]
        })
        handleOffer(offer, senderSocketId, socketRef)
      })

      socket.on('webrtc-answer', (answer, senderSocketId) => {
        handleAnswer(answer, senderSocketId)
      })

      socket.on('ice-candidate', (candidate, senderSocketId) => {
        handleIceCandidate(candidate, senderSocketId)
      })

      socket.on('user-disconnected', (remoteSocketId) => {
        console.log('[VideoRoom] user-disconnected:', remoteSocketId)
        handleUserDisconnected(remoteSocketId)
        setRemoteParticipants((prev) => prev.filter((p) => p.id !== remoteSocketId))
        setRemoteReactions((prev) => { const u = { ...prev }; delete u[remoteSocketId]; return u })
        setRemoteHands((prev) => { const u = { ...prev }; delete u[remoteSocketId]; return u })
        if (remoteScreenSharer === remoteSocketId) setRemoteScreenSharer(null)
      })

      // ─── REACTIONS / HAND / SCREEN SHARE from remote ───
      socket.on('user-reaction', (data) => {
        setRemoteReactions((prev) => ({ ...prev, [data.socketId]: data.emoji }))
        setTimeout(() => {
          setRemoteReactions((prev) => { const u = { ...prev }; delete u[data.socketId]; return u })
        }, 3000)
      })

      socket.on('user-hand', (data) => {
        setRemoteHands((prev) => ({ ...prev, [data.socketId]: data.raised }))
      })

      socket.on('user-screen-share', (data) => {
        setRemoteScreenSharer(data.sharing ? data.socketId : null)
      })

      // When the host ends the meeting
      socket.on('meeting-ended', () => {
        // Stop recording if active before navigating away
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop()
        }
        alert('The host has ended the meeting.')
        stopMedia()
        navigate(`/meeting/${meetingId}/summary`)
      })

      // Live Transcripts
      socket.on('transcript-update', (line) => {
        setCaptions((prev) => [...prev, line].slice(-5))
      })

      // File shared by another participant
      socket.on('file-shared', (fileInfo) => {
        setSharedFiles((prev) => [...prev, fileInfo])
      })

      // Setup Speech Recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'

        recognition.onresult = (event) => {
          let currentInterim = ''
          let finalTranscripts = []

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscripts.push(event.results[i][0].transcript)
            } else {
              currentInterim += event.results[i][0].transcript
            }
          }

          if (finalTranscripts.length > 0 && socketRef.current) {
            finalTranscripts.forEach(text => {
              // Send final transcribed text to backend to be shared and saved
              socketRef.current.emit('audio-transcription', meetingId, text)
            })
          }
          setInterimCaption(currentInterim)
        }

        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error)
        }
        
        // Handle restarting if it stops unexpectedly (Chrome stops automatically after a while)
        recognition.onend = () => {
          if (!cancelled && isAudioEnabledRef.current) {
            // Need a slight delay to avoid InvalidStateError synchronous restarts
            setTimeout(() => {
              if (!cancelled && isAudioEnabledRef.current) {
                try { recognition.start() } catch (e) {}
              }
            }, 250)
          }
        }

        recognitionRef.current = recognition
        if (isAudioEnabledRef.current) {
          try { recognition.start() } catch (e) {}
        }
      } else {
        setSpeechUnsupported(true)
      }
    }

    setup()

    return () => {
      cancelled = true
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch (e) {}
      }
    }
  }, [meetingId])

  // ─── TIMER ───
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // ─── ATTACH LOCAL VIDEO ───
  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream
    }
  }, [localStream, layoutMode])

  // Re-attach video when layout changes (React may unmount/remount video elements)
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

  // ─── SCREEN SHARE VIDEO ───
  useEffect(() => {
    if (isScreenSharing && screenVideoRef.current && screenStream.current) {
      screenVideoRef.current.srcObject = screenStream.current
    } else if (!isScreenSharing && screenVideoRef.current) {
      screenVideoRef.current.srcObject = null
    }
  }, [isScreenSharing])

  // ─── HANDLERS ───
  const endMeeting = () => {
    if (socketRef.current) {
      socketRef.current.emit('end-meeting', meetingId)
    }
  }

  const handleEndCall = async () => {
    const msg = isHost ? 'End the meeting for everyone?' : 'Leave the meeting?'
    if (confirm(msg)) {
      if (isHost) {
        endMeeting()
      }

      setIsEndingCall(true)

      if (isRecording) {
        stopRecording();
      }
      
      // Wait for onstop to trigger and assign the promise
      await new Promise(resolve => setTimeout(resolve, 200));

      if (recordingUploadPromiseRef.current) {
        try {
          await recordingUploadPromiseRef.current;
        } catch (e) {
          console.error("Upload promise failed during end call", e);
        }
      }

      stopMedia()
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
    if (socketRef.current) socketRef.current.emit('send-reaction', emoji)
    setTimeout(() => setReaction(null), 3000)
  }

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const handleSendMessage = () => {
    if (!chatInput.trim() || !socketRef.current) return
    socketRef.current.emit('chat-message', {
      roomId: meetingId,
      sender: userId,
      text: chatInput.trim(),
    })
    setChatInput('')
  }

  useEffect(() => {
    if (showChat) setHasUnread(false)
  }, [showChat])

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleAcceptRequest = (request) => {
    socketRef.current.emit('accept-join', request.socketId, meetingId, request.userObj)
    setJoinRequests((prev) => prev.filter((r) => r.socketId !== request.socketId))
  }

  const handleRejectRequest = (request) => {
    socketRef.current.emit('reject-join', request.socketId, meetingId)
    setJoinRequests((prev) => prev.filter((r) => r.socketId !== request.socketId))
  }

  const recordingStreamRef = useRef(null)

  // ─── RECORDING ───
  const startRecording = async () => {
    try {
      // Prompt user to select screen to record (preferably the current tab)
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' },
        audio: true,
        preferCurrentTab: true
      });

      // Try to mix local microphone with the tab audio
      let mixedStream;
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const dest = audioCtx.createMediaStreamDestination();

        if (displayStream.getAudioTracks().length > 0) {
          const displayAudioSource = audioCtx.createMediaStreamSource(displayStream);
          displayAudioSource.connect(dest);
        }

        if (localStream && localStream.getAudioTracks().length > 0) {
          const localAudioSource = audioCtx.createMediaStreamSource(localStream);
          localAudioSource.connect(dest);
        }

        const tracks = [...displayStream.getVideoTracks()];
        if (dest.stream.getAudioTracks().length > 0) {
          tracks.push(...dest.stream.getAudioTracks());
        }
        mixedStream = new MediaStream(tracks);
      } catch (err) {
        console.error('AudioContext mixing failed, falling back to basic displayStream', err);
        mixedStream = displayStream;
      }

      recordingStreamRef.current = displayStream;
      recordedChunksRef.current = [];

      // Fallback mime types for browser compatibility
      const mimeTypes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
      let selectedMime = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || ''

      const recorder = new MediaRecorder(mixedStream, selectedMime ? { mimeType: selectedMime } : {})

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data)
        }
      }

      recorder.onstop = () => {
        clearInterval(recordingTimerRef.current)
        setRecordingTime(0)

        // Force strict MIME type for the backend Multer validation
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
        recordedChunksRef.current = []

        if (blob.size === 0) {
          alert('Recording failed: No media data was captured. Please ensure your microphone or camera was active.');
          return;
        }

        recordingUploadPromiseRef.current = (async () => {
          // Upload recording to S3
          try {
            const formData = new FormData()
            formData.append('file', blob, `recording-${meetingId}-${Date.now()}.webm`)
            formData.append('meetingId', meetingId)

            const { token } = useAuthStore.getState()
            await axios.post('/api/uploads/recording', formData, {
              headers: {
                Authorization: `Bearer ${token}`
              },
            })
            console.log('[Recording] Uploaded successfully')
          } catch (err) {
            console.error('[Recording] Upload failed:', err)
            const errorMsg = err.response?.data?.message || err.message;
            alert('Failed to upload recording: ' + errorMsg);
            throw err;
          } finally {
            if (recordingStreamRef.current) {
              recordingStreamRef.current.getTracks().forEach(t => t.stop());
              recordingStreamRef.current = null;
            }
          }
        })();
      }

      recorder.start(1000)
      mediaRecorderRef.current = recorder
      setIsRecording(true)

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('Error starting recording:', err)
      setIsRecording(false)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
    setIsRecording(false)
  }

  const formatRecordingTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  // ─── FILE SHARING ───
  const handleFileShare = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('meetingId', meetingId)

      const { token } = useAuthStore.getState()
      const res = await axios.post('/api/uploads/meeting-file', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      })

      // Emit as a chat message of type 'file'
      if (socketRef.current) {
        socketRef.current.emit('chat-message', {
          roomId: meetingId,
          sender: userId,
          text: `Shared a file: ${res.data.fileName}`,
          type: 'file',
          fileUrl: res.data.url,
          fileName: res.data.fileName,
          fileSize: res.data.fileSize,
        })
      }
    } catch (err) {
      console.error('[File Share] Upload failed:', err)
      alert('Failed to share file: ' + (err.response?.data?.message || err.message))
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ─── COMPUTED ───
  const allParticipants = [
    { id: '1', name: displayName, isHost },
    ...remoteParticipants.map((p) => ({ ...p, isHost: false })),
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
      name: displayName || 'You',
      isLocal: true,
      isAudio: isAudioEnabled,
      isVideo: isVideoEnabled,
      reaction: reaction,
      raisedHand: raisedHand,
    },
    ...remoteParticipants.map((p) => ({
      ...p,
      isLocal: false,
      reaction: remoteReactions[p.id] || null,
      raisedHand: remoteHands[p.id] || false,
    })),
  ]

  const getGridColumns = () => {
    if (allTiles.length <= 2) return 1
    if (allTiles.length <= 4) return 2
    if (allTiles.length <= 9) return 3
    return 4
  }

  if (waitingForHost) {
    return (
      <div className="h-screen bg-[#111113] text-white flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-full border-4 border-[#7C3AED] border-t-transparent animate-spin mb-6" />
        <h2 className="text-2xl font-semibold mb-2">Waiting for the host...</h2>
        <p className="text-white/50">The meeting host will let you in soon.</p>
      </div>
    )
  }

  if (isEndingCall) {
    return (
      <div className="h-screen bg-[#111113] text-white flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-full border-4 border-[#7C3AED] border-t-transparent animate-spin mb-6" />
        <h2 className="text-2xl font-semibold mb-2">Saving meeting...</h2>
        <p className="text-white/50">Please wait while we secure your recording.</p>
      </div>
    )
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
                    localStream={localStream}
                    remoteStreams={remoteStreams}
                    videoRef={videoRef}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }

    // Remote screen sharing layout — show remote sharer's video tile as main content
    if (remoteScreenSharer) {
      const sharerTile = tiles.find((t) => t.id === remoteScreenSharer)
      const otherTiles = tiles.filter((t) => t.id !== remoteScreenSharer)
      const sharerName = sharerTile?.name || 'Participant'

      return (
        <div className={`h-full flex ${GAP}`}>
          {/* Main: remote screen share (their video track now contains screen content) */}
          <div className="flex-1 relative bg-[#1C1C1E] rounded-2xl overflow-hidden">
            {sharerTile && (
              <VideoTile
                tile={{ ...sharerTile, isVideo: true, isScreenShare: true }}
                large
                pinnedId={pinnedId}
                setPinnedId={setPinnedId}
                localStream={localStream}
                remoteStreams={remoteStreams}
                videoRef={videoRef}
              />
            )}
            <div className="absolute bottom-3 left-3 bg-black/60 px-2.5 py-1 rounded-lg z-10">
              <p className="text-white text-xs">{sharerName}&apos;s Screen</p>
            </div>
          </div>
          {/* Sidebar: all other tiles */}
          <div className="w-56 flex flex-col overflow-y-auto">
            <div className={`flex flex-col ${GAP}`}>
              {otherTiles.map((tile) => (
                <div key={tile.id} className="h-40 flex-shrink-0 aspect-video">
                  <VideoTile
                    tile={tile}
                    pinnedId={pinnedId}
                    setPinnedId={setPinnedId}
                    localStream={localStream}
                    remoteStreams={remoteStreams}
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
              localStream={localStream}
              remoteStreams={remoteStreams}
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
                    localStream={localStream}
                    remoteStreams={remoteStreams}
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
              localStream={localStream}
              remoteStreams={remoteStreams}
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
                    localStream={localStream}
                    remoteStreams={remoteStreams}
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
                localStream={localStream}
                remoteStreams={remoteStreams}
                videoRef={videoRef}
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-[#111113] text-white flex flex-col overflow-hidden relative">
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
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full p-1 pl-3">
            <span className="text-xs text-white/40 font-mono">{meetingId}</span>
            <button
              onClick={handleCopyLink}
              className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition"
              title="Copy invite link"
            >
              {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
            </button>
          </div>

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
        <div className="flex-1 min-h-0 flex flex-col relative">
          <div className="flex-1 min-h-0 overflow-hidden p-4">
            {renderLayoutContent()}
          </div>
          
          {/* Speech Recognition Unsupported Warning */}
          {speechUnsupported && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-amber-500/90 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg backdrop-blur-sm flex items-center gap-2">
              ⚠️ Live transcription is not supported in this browser. Use Chrome for best results.
              <button onClick={() => setSpeechUnsupported(false)} className="ml-2 text-white/80 hover:text-white">✕</button>
            </div>
          )}

          {/* Live Captions Overlay */}
          {(captions.length > 0 || interimCaption) && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none z-10 w-full px-12">
              {captions.map((cap, idx) => (
                <div key={idx} className="bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-xl text-lg font-medium text-center shadow-lg border border-white/10 max-w-2xl w-max animate-in fade-in slide-in-from-bottom-2">
                  {cap}
                </div>
              ))}
              {interimCaption && (
                <div className="bg-black/40 backdrop-blur-sm text-white/80 px-4 py-2 rounded-xl text-lg font-medium text-center shadow-lg border border-white/10 max-w-2xl w-max italic animate-pulse">
                  {interimCaption}
                </div>
              )}
            </div>
          )}
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
                <div className="text-sm text-white/30 text-center mt-8">No messages or files yet. Say hello!</div>
              ) : (
                <>
                  {messages.map((message) => (
                    <div key={message.id} className={`flex flex-col max-w-full ${message.isOwn ? 'items-end' : 'items-start'}`}>
                      <div className={`${message.isOwn ? 'bg-[#7C3AED] text-white rounded-2xl rounded-br-sm' : 'bg-white/10 text-white rounded-2xl rounded-bl-sm'} px-3 py-2 text-sm max-w-full`}>
                        <p className="text-xs text-white/40 mb-1">{message.sender}</p>
                        {message.type === 'file' ? (
                          <div className="flex items-center gap-3 bg-black/20 rounded-xl p-2 mt-1">
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                              <FileIcon size={18} className="text-white" />
                            </div>
                            <div className="flex-1 min-w-0 pr-2">
                              <p className="text-sm font-medium truncate" title={message.fileName}>{message.fileName}</p>
                              <p className="text-xs text-white/40">{(message.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                            <a
                              href={message.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                            >
                              View
                            </a>
                          </div>
                        ) : (
                          <p className="break-words">{message.text}</p>
                        )}
                      </div>
                      <span className="text-xs text-white/30 mt-1">{message.time}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
            <div className="p-3 border-t border-white/10 flex gap-2 items-center">
              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="text-white/40 hover:text-white transition p-2 bg-white/5 rounded-xl flex-shrink-0"
                title="Share file"
              >
                <Paperclip size={18} />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileShare}
                className="hidden"
                accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              />
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
                className="flex-1 min-w-0 bg-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:bg-white/15 placeholder-white/30"
                placeholder="Type a message..."
              />
              <button onClick={handleSendMessage} className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl p-2.5 transition flex-shrink-0" title="Send Message">
                <Send size={18} />
              </button>
            </div>
          </div>
        )}

        {showNotes && (
          <div className="w-[400px] bg-[#1C1C1E] border-l border-white/10 flex flex-col flex-shrink-0">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Shared Notes</h2>
                <p className="text-xs text-white/40">Collaborate with everyone</p>
              </div>
              <button onClick={() => setShowNotes(false)} className="text-white/40 hover:text-white transition">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 p-4 min-h-0 bg-white notes-container overflow-y-auto">
              <ReactQuill 
                theme="snow"
                value={sharedNotes}
                onChange={(content, delta, source, editor) => {
                  setSharedNotes(content)
                  if (source === 'user' && socketRef.current) {
                    socketRef.current.emit('note-update', meetingId, content)
                  }
                }}
                className="h-full text-black"
                placeholder="Type notes here... everyone in the room will see them live."
              />
            </div>
          </div>
        )}

        {showTasks && (
          <div className="w-80 bg-[#1C1C1E] border-l border-white/10 flex flex-col flex-shrink-0">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Action Items</h2>
                <p className="text-xs text-white/40">Track tasks from this meeting</p>
              </div>
              <button onClick={() => setShowTasks(false)} className="text-white/40 hover:text-white transition">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {tasks.length === 0 ? (
                <div className="text-sm text-white/30 text-center mt-8">No tasks created yet.</div>
              ) : (
                tasks.map((task) => (
                  <div key={task._id} className="bg-white/5 border border-white/10 rounded-xl p-3">
                    <p className="text-sm font-medium text-white mb-1">{task.title}</p>
                    <p className="text-xs text-white/50">Status: {task.status}</p>
                  </div>
                ))
              )}
            </div>
            <div className="p-3 border-t border-white/10 flex gap-2">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (!newTaskTitle.trim()) return
                    try {
                      const tokenStore = localStorage.getItem('auth-storage')
                      const token = tokenStore ? JSON.parse(tokenStore).state?.token : null
                      const res = await axios.post('/api/tasks', {
                        title: newTaskTitle,
                        meetingId: meetingInfo?._id,
                        organizationId: meetingInfo?.organizationId
                      }, {
                        headers: token ? { Authorization: `Bearer ${token}` } : {}
                      })
                      setTasks(prev => [...prev, res.data])
                      setNewTaskTitle('')
                    } catch (err) {
                      console.error('Failed to create task:', err)
                    }
                  }
                }}
                className="flex-1 bg-white/10 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:bg-white/15 placeholder-white/30"
                placeholder="New task..."
              />
              <button
                onClick={async () => {
                  if (!newTaskTitle.trim()) return
                  try {
                    const tokenStore = localStorage.getItem('auth-storage')
                    const token = tokenStore ? JSON.parse(tokenStore).state?.token : null
                    const res = await axios.post('/api/tasks', {
                      title: newTaskTitle,
                      meetingId: meetingInfo?._id,
                      organizationId: meetingInfo?.organizationId
                    }, {
                      headers: token ? { Authorization: `Bearer ${token}` } : {}
                    })
                    setTasks(prev => [...prev, res.data])
                    setNewTaskTitle('')
                  } catch (err) {
                    console.error('Failed to create task:', err)
                  }
                }}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl p-2.5 transition flex-shrink-0"
                title="Create Task"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Host admit/deny requests overlay */}
      {isHost && joinRequests.length > 0 && (
        <div className="absolute bottom-24 right-6 flex flex-col gap-3 z-50">
          {joinRequests.map(req => (
            <div key={req.socketId} className="bg-[#1C1C1E] border border-[#7C3AED]/30 rounded-2xl p-4 shadow-2xl flex flex-col gap-2 w-72 animate-in slide-in-from-right-8">
              <p className="text-sm text-white"><span className="font-semibold text-white">{req.userObj?.name || 'Guest'}</span> wants to join.</p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => handleRejectRequest(req)} className="flex-1 px-3 py-2 rounded-xl bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-white text-xs font-semibold transition">Deny</button>
                <button onClick={() => handleAcceptRequest(req)} className="flex-1 px-3 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold transition">Admit</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Toolbar */}
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
          onClick={async () => {
            if (isScreenSharing) {
              stopScreenShare(socketRef)
              if (socketRef.current) socketRef.current.emit('screen-share-stopped')
            } else {
              const stream = await startScreenShare(socketRef)
              if (stream && socketRef.current) socketRef.current.emit('screen-share-started')
            }
          }}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            isScreenSharing ? 'bg-[#7C3AED] text-white hover:bg-[#6D28D9]' : 'bg-white/10 text-white hover:bg-white/20'
          }`}
          title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
        >
          <Share2 size={20} />
        </button>

        {isHost && (
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isRecording ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            title={isRecording ? 'Stop Recording' : 'Start Recording'}
          >
            {isRecording ? <div className="flex flex-col items-center"><Circle size={12} fill="currentColor" className="mb-0.5" /><span className="text-[9px] font-bold">{formatRecordingTime(recordingTime)}</span></div> : <Circle size={20} />}
          </button>
        )}

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
          onClick={() => {
            const newVal = !raisedHand
            setRaisedHand(newVal)
            if (socketRef.current) socketRef.current.emit('raise-hand', newVal)
          }}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            raisedHand ? 'bg-yellow-400 text-black hover:bg-yellow-300' : 'bg-white/10 text-white hover:bg-white/20'
          }`}
          title="Raise hand"
        >
          <Hand size={20} />
        </button>

        <button
          onClick={() => {
            setShowParticipants(!showParticipants)
            setShowChat(false)
            setShowNotes(false)
            setShowTasks(false)
          }}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all relative ${showParticipants ? 'bg-[#7C3AED] text-white hover:bg-[#6D28D9]' : 'bg-white/10 text-white hover:bg-white/20'}`}
          title="Show Participants"
        >
          <Users size={20} />
          <span className="absolute top-0 right-0 -mt-1 -mr-1 bg-[#7C3AED] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {allParticipants.length}
          </span>
        </button>

        <button
          onClick={() => {
            setShowChat(!showChat)
            setShowParticipants(false)
            setShowNotes(false)
            setShowTasks(false)
          }}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all relative ${showChat ? 'bg-[#7C3AED] text-white hover:bg-[#6D28D9]' : 'bg-white/10 text-white hover:bg-white/20'}`}
          title="Toggle Chat"
        >
          <MessageSquare size={20} />
          {!showChat && hasUnread && <span className="absolute top-0 right-0 -mt-1 -mr-1 bg-red-500 w-3 h-3 rounded-full" />}
        </button>

        <button
          onClick={() => {
            setShowNotes(!showNotes)
            setShowChat(false)
            setShowParticipants(false)
            setShowTasks(false)
          }}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all relative ${showNotes ? 'bg-[#7C3AED] text-white hover:bg-[#6D28D9]' : 'bg-white/10 text-white hover:bg-white/20'}`}
          title="Shared Notes"
        >
          <FileText size={20} />
        </button>

        <button
          onClick={() => {
            setShowTasks(!showTasks)
            setShowChat(false)
            setShowParticipants(false)
            setShowNotes(false)
          }}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all relative ${showTasks ? 'bg-[#7C3AED] text-white hover:bg-[#6D28D9]' : 'bg-white/10 text-white hover:bg-white/20'}`}
          title="Tasks"
        >
          <CheckSquare size={20} />
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
                    className={`p-3 rounded-xl text-left transition ${
                      active ? 'bg-[#7C3AED]/20 border border-[#7C3AED] ring-1 ring-[#7C3AED]' : 'bg-white/5 border border-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className={`w-full h-14 mb-2 rounded-lg overflow-hidden flex items-center justify-center p-1 ${active ? 'bg-[#7C3AED]/10' : 'bg-white/5'}`}>
                      {layout.id === 'auto' && (
                        <div className="grid grid-cols-2 gap-1 w-full h-full">
                          <div className="bg-white/20 rounded" />
                          <div className="bg-white/20 rounded" />
                        </div>
                      )}
                      {layout.id === 'grid' && (
                        <div className="grid grid-cols-2 gap-1 w-full h-full">
                          <div className="bg-white/20 rounded" />
                          <div className="bg-white/20 rounded" />
                          <div className="bg-white/20 rounded" />
                          <div className="bg-white/20 rounded" />
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
