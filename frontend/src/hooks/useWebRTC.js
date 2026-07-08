import { useEffect, useRef, useState, useCallback } from 'react'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
]

export const useWebRTC = () => {
  const [localStream, setLocalStream] = useState(null)
  const [remoteStreams, setRemoteStreams] = useState({})
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [error, setError] = useState(null)

  const peerConnectionsRef = useRef({})
  const localStreamRef = useRef(null)
  const screenStreamRef = useRef(null)
  const makingOfferRef = useRef({}) // Track per-peer offer-in-progress
  const socketRefForScreen = useRef(null) // Socket ref for screen share renegotiation
  const socketRefRef = useRef(null)

  // ─── INITIALIZE MEDIA ───
  const initializeMedia = useCallback(async (options = {}) => {
    try {
      // If we already have a stream, don't re-acquire
      if (localStreamRef.current) {
        setLocalStream(localStreamRef.current)
        return localStreamRef.current
      }

      const {
        audioEnabled = true,
        videoEnabled = true,
        audioDeviceId = '',
        videoDeviceId = '',
      } = options

      const audioConstraints = audioEnabled
        ? {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            ...(audioDeviceId ? { deviceId: { exact: audioDeviceId } } : {}),
          }
        : false

      const videoConstraints = videoEnabled
        ? {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            ...(videoDeviceId ? { deviceId: { exact: videoDeviceId } } : {}),
          }
        : false

      if (!audioConstraints && !videoConstraints) {
        const emptyStream = new MediaStream()
        localStreamRef.current = emptyStream
        setLocalStream(emptyStream)
        setIsAudioEnabled(false)
        setIsVideoEnabled(false)
        setError(null)
        return emptyStream
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: videoConstraints,
      })

      localStreamRef.current = stream
      setLocalStream(stream)
      setIsAudioEnabled(audioEnabled && stream.getAudioTracks().length > 0)
      setIsVideoEnabled(videoEnabled && stream.getVideoTracks().length > 0)
      setError(null)
      return stream
    } catch (err) {
      console.error('[WebRTC] initializeMedia error:', err)
      setError(
        err.name === 'NotAllowedError'
          ? 'Camera/microphone permission denied. Please allow access in your browser.'
          : err.name === 'NotFoundError'
            ? 'No camera or microphone found on this device.'
            : 'Failed to access media devices'
      )
      // Create a silent/black fallback stream so the app still works
      try {
        const fallback = await navigator.mediaDevices.getUserMedia({ audio: true })
        localStreamRef.current = fallback
        setLocalStream(fallback)
        setIsAudioEnabled(true)
        setIsVideoEnabled(false)
        return fallback
      } catch {
        return null
      }
    }
  }, [])

  // ─── STOP MEDIA ───
  const stopMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
      localStreamRef.current = null
      setLocalStream(null)
    }
  }, [])

  // ─── TOGGLE AUDIO ───
  const toggleAudio = useCallback(() => {
    if (!localStreamRef.current) return
    const audioTracks = localStreamRef.current.getAudioTracks()

    if (audioTracks.length === 0) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          const track = stream.getAudioTracks()[0]
          if (!track || !localStreamRef.current) return
          localStreamRef.current.addTrack(track)
          Object.entries(peerConnectionsRef.current).forEach(([peerId, pc]) => {
            if (pc.signalingState === 'closed') return
            pc.addTrack(track, localStreamRef.current)
            pc.createOffer()
              .then((offer) => pc.setLocalDescription(offer))
              .then(() => {
                if (socketRefRef.current?.current) {
                  socketRefRef.current.current.emit('webrtc-offer', pc.localDescription, peerId)
                }
              })
              .catch((err) => console.error('[WebRTC] Audio enable renegotiation error:', err))
          })
          setIsAudioEnabled(true)
          setLocalStream(null)
          setTimeout(() => setLocalStream(localStreamRef.current), 0)
        })
        .catch(() => {
          setError('Failed to enable audio')
        })
      return
    }

    audioTracks.forEach((track) => {
      track.enabled = !track.enabled
    })
    setIsAudioEnabled((prev) => !prev)
  }, [])

  // ─── TOGGLE VIDEO ───
  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return
    const videoTracks = localStreamRef.current.getVideoTracks()

    if (videoTracks.length === 0) {
      navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        }
      })
        .then((stream) => {
          const track = stream.getVideoTracks()[0]
          if (!track || !localStreamRef.current) return
          localStreamRef.current.addTrack(track)
          Object.entries(peerConnectionsRef.current).forEach(([peerId, pc]) => {
            if (pc.signalingState === 'closed') return
            pc.addTrack(track, localStreamRef.current)
            pc.createOffer()
              .then((offer) => pc.setLocalDescription(offer))
              .then(() => {
                if (socketRefRef.current?.current) {
                  socketRefRef.current.current.emit('webrtc-offer', pc.localDescription, peerId)
                }
              })
              .catch((err) => console.error('[WebRTC] Video enable renegotiation error:', err))
          })
          setIsVideoEnabled(true)
          setLocalStream(null)
          setTimeout(() => setLocalStream(localStreamRef.current), 0)
        })
        .catch(() => {
          setError('Failed to enable video')
        })
      return
    }

    videoTracks.forEach((track) => {
      track.enabled = !track.enabled
    })
    setIsVideoEnabled((prev) => !prev)
  }, [])

  // ─── SCREEN SHARE ───
  const screenAddedPeersRef = useRef(new Set()) // Track which peers used addTrack (need renegotiation on stop)

  const stopScreenShare = useCallback((socketRef) => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop())
      screenStreamRef.current = null
    }
    setIsScreenSharing(false)

    const cameraTrack = localStreamRef.current?.getVideoTracks()[0] || null
    Object.entries(peerConnectionsRef.current).forEach(([peerId, pc]) => {
      if (pc.signalingState === 'closed') return

      const videoSender = pc.getSenders().find(
        (s) => s.track === null || (s.track && s.track.kind === 'video')
      )
      if (videoSender) {
        videoSender.replaceTrack(cameraTrack)
      }

      // Only renegotiate for peers where we used addTrack
      if (screenAddedPeersRef.current.has(peerId)) {
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            if (socketRef?.current) {
              socketRef.current.emit('webrtc-offer', pc.localDescription, peerId)
            }
          })
          .catch((err) => console.error('[WebRTC] Screen share stop renegotiation error:', err))
      }
    })
    screenAddedPeersRef.current.clear()
  }, [])

  const startScreenShare = useCallback(async (socketRef) => {
    try {
      // Store socket ref for screen track's onended handler
      socketRefForScreen.current = socketRef
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      })

      screenStreamRef.current = stream
      setIsScreenSharing(true)
      screenAddedPeersRef.current.clear()

      const screenTrack = stream.getVideoTracks()[0]
      if (screenTrack) {
        screenTrack.onended = () => stopScreenShare(socketRefForScreen.current)

        Object.entries(peerConnectionsRef.current).forEach(([peerId, pc]) => {
          if (pc.signalingState === 'closed') return

          const videoSender = pc.getSenders().find((s) => s.track && s.track.kind === 'video')
          if (videoSender) {
            // Video sender exists (camera available but maybe disabled)
            // replaceTrack works WITHOUT renegotiation — remote receives new content immediately
            videoSender.replaceTrack(screenTrack)
            console.log(`[WebRTC] replaceTrack for screen share to ${peerId}`)
          } else {
            // No video sender (camera was unavailable) — need addTrack + renegotiate
            pc.addTrack(screenTrack, stream)
            screenAddedPeersRef.current.add(peerId)
            console.log(`[WebRTC] addTrack for screen share to ${peerId}, renegotiating...`)

            pc.createOffer()
              .then((offer) => pc.setLocalDescription(offer))
              .then(() => {
                if (socketRef?.current) {
                  socketRef.current.emit('webrtc-offer', pc.localDescription, peerId)
                }
              })
              .catch((err) => console.error('[WebRTC] Screen share renegotiation error:', err))
          }
        })
      }

      return stream
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        setError('Failed to share screen')
      }
      return null
    }
  }, [stopScreenShare])

  // ─── GET DEVICES ───
  const getDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return {
        audioDevices: devices.filter((d) => d.kind === 'audioinput'),
        videoDevices: devices.filter((d) => d.kind === 'videoinput'),
      }
    } catch {
      setError('Failed to enumerate devices')
      return { audioDevices: [], videoDevices: [] }
    }
  }, [])

  // ─── SWITCH DEVICE ───
  const switchDevice = useCallback(async (deviceId, kind) => {
    try {
      const constraints =
        kind === 'audioinput'
          ? { audio: { deviceId: { exact: deviceId } } }
          : { video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } }

      const newStream = await navigator.mediaDevices.getUserMedia(constraints)
      const newTrack = newStream.getTracks()[0]
      if (!newTrack || !localStreamRef.current) return null

      const trackKind = kind === 'audioinput' ? 'audio' : 'video'

      // Replace in local stream
      const oldTrack = localStreamRef.current.getTracks().find((t) => t.kind === trackKind)
      if (oldTrack) {
        localStreamRef.current.removeTrack(oldTrack)
        oldTrack.stop()
      }
      localStreamRef.current.addTrack(newTrack)

      // Replace in peer connections
      Object.values(peerConnectionsRef.current).forEach((pc) => {
        if (pc.signalingState !== 'closed') {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === trackKind)
          if (sender) sender.replaceTrack(newTrack)
        }
      })

      // Force React re-render
      setLocalStream(null)
      setTimeout(() => setLocalStream(localStreamRef.current), 0)

      return newStream
    } catch {
      setError('Failed to switch device')
      return null
    }
  }, [])

  // ─── CREATE PEER CONNECTION ───
  const createPeerConnection = useCallback((socketId, socketRef) => {
    // If one already exists, close it first
    if (peerConnectionsRef.current[socketId]) {
      peerConnectionsRef.current[socketId].close()
      delete peerConnectionsRef.current[socketId]
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', event.candidate, socketId)
      }
    }

    pc.ontrack = (event) => {
      console.log(`[WebRTC] Got remote track from ${socketId}:`, event.track.kind, 'readyState:', event.track.readyState)

      setRemoteStreams((prev) => {
        const existingStream = prev[socketId]
        if (existingStream) {
          // Renegotiation: add new track to existing stream if not already present
          const existingTrackIds = existingStream.getTracks().map((t) => t.id)
          if (!existingTrackIds.includes(event.track.id)) {
            existingStream.addTrack(event.track)
            console.log(`[WebRTC] Added ${event.track.kind} track to existing stream for ${socketId}`)
          }
          return { ...prev } // new object ref to trigger React re-render
        }
        // New connection — use provided stream or create one from track
        const stream = event.streams[0] || new MediaStream([event.track])
        return { ...prev, [socketId]: stream }
      })
    }

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE state for ${socketId}: ${pc.iceConnectionState}`)
      if (pc.iceConnectionState === 'failed') {
        console.warn(`[WebRTC] ICE failed for ${socketId}, restarting...`)
        pc.restartIce()
      }
    }

    // Add ALL local tracks to this peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current)
      })
    }

    peerConnectionsRef.current[socketId] = pc
    return pc
  }, [])

  // ─── HANDLE USER CONNECTED (we are the OFFERER) ───
  const handleUserConnected = useCallback(async (socketId, socketRef) => {
    console.log(`[WebRTC] User connected: ${socketId}, creating offer...`)
    socketRefRef.current = socketRef
    const pc = createPeerConnection(socketId, socketRef)

    try {
      makingOfferRef.current[socketId] = true
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socketRef.current.emit('webrtc-offer', pc.localDescription, socketId)
    } catch (err) {
      console.error('[WebRTC] Error creating offer:', err)
    } finally {
      makingOfferRef.current[socketId] = false
    }
  }, [createPeerConnection])

  // ─── HANDLE OFFER (we are the ANSWERER, or renegotiation) ───
  const handleOffer = useCallback(async (offer, senderSocketId, socketRef) => {
    // Check if we already have a connection (renegotiation case, e.g. screen share)
    socketRefRef.current = socketRef
    let pc = peerConnectionsRef.current[senderSocketId]
    if (pc && pc.signalingState !== 'closed') {
      console.log(`[WebRTC] Renegotiation offer from ${senderSocketId}`)
    } else {
      console.log(`[WebRTC] New offer from ${senderSocketId}, creating peer connection...`)
      pc = createPeerConnection(senderSocketId, socketRef)
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      socketRef.current.emit('webrtc-answer', pc.localDescription, senderSocketId)
    } catch (err) {
      console.error('[WebRTC] Error handling offer:', err)
    }
  }, [createPeerConnection])

  // ─── HANDLE ANSWER ───
  const handleAnswer = useCallback(async (answer, senderSocketId) => {
    const pc = peerConnectionsRef.current[senderSocketId]
    if (!pc) return

    try {
      if (pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(answer))
      } else {
        console.warn(`[WebRTC] Ignoring answer in state: ${pc.signalingState}`)
      }
    } catch (err) {
      console.error('[WebRTC] Error handling answer:', err)
    }
  }, [])

  // ─── HANDLE ICE CANDIDATE ───
  const handleIceCandidate = useCallback(async (candidate, senderSocketId) => {
    const pc = peerConnectionsRef.current[senderSocketId]
    if (!pc) return

    try {
      if (pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      }
    } catch (err) {
      // Non-critical: ICE candidates arriving out of order
      console.warn('[WebRTC] Error adding ICE candidate:', err.message)
    }
  }, [])

  // ─── HANDLE USER DISCONNECTED ───
  const handleUserDisconnected = useCallback((socketId) => {
    console.log(`[WebRTC] User disconnected: ${socketId}`)
    if (peerConnectionsRef.current[socketId]) {
      peerConnectionsRef.current[socketId].close()
      delete peerConnectionsRef.current[socketId]
    }
    delete makingOfferRef.current[socketId]
    setRemoteStreams((prev) => {
      const updated = { ...prev }
      delete updated[socketId]
      return updated
    })
  }, [])

  // ─── CLEANUP ───
  useEffect(() => {
    return () => {
      Object.values(peerConnectionsRef.current).forEach((pc) => {
        if (pc) {
          pc.onicecandidate = null
          pc.ontrack = null
          pc.oniceconnectionstatechange = null
          pc.close()
        }
      })
      peerConnectionsRef.current = {}
      // NOTE: We intentionally do NOT stop media here.
      // Media is stopped explicitly when the user leaves the meeting.
    }
  }, [])

  return {
    localStream,
    remoteStreams,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    screenStream: screenStreamRef,
    error,
    initializeMedia,
    stopMedia,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    getDevices,
    switchDevice,
    handleUserConnected,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    handleUserDisconnected,
  }
}
