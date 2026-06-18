import { useEffect, useRef, useState } from 'react'

export const useWebRTC = () => {
  const [localStream, setLocalStream] = useState(null)
  const [remoteStreams, setRemoteStreams] = useState({})
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [error, setError] = useState(null)

  const peerConnectionsRef = useRef({})
  const localStreamRef = useRef(null)
  const screenStream = useRef(null)
  const allVideoTracksRef = useRef([])
  const allAudioTracksRef = useRef([])

  // Initialize local media stream
  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })

      setLocalStream(stream)
      localStreamRef.current = stream

      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        // Add onended handler to clean up when track naturally ends
        videoTrack.onended = () => {
          setError('Camera disconnected')
        }
        allVideoTracksRef.current.push(videoTrack)
      }

      const audioTrack = stream.getAudioTracks()[0]
      if (audioTrack) {
        // Add onended handler to clean up when track naturally ends
        audioTrack.onended = () => {
          setError('Microphone disconnected')
        }
        allAudioTracksRef.current.push(audioTrack)
      }

      return stream
    } catch (err) {
      setError(
        err.name === 'NotAllowedError'
          ? 'Camera/microphone permission denied'
          : 'Failed to access media devices'
      )
      return null
    }
  }

  // Stop media stream
  const stopMedia = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
      setLocalStream(null)
      localStreamRef.current = null
    }
    allVideoTracksRef.current.forEach((track) => track.stop())
    allVideoTracksRef.current = []
    allAudioTracksRef.current.forEach((track) => track.stop())
    allAudioTracksRef.current = []
  }

  // Toggle audio — stop and restart microphone so hardware light turns off when disabled
  const toggleAudio = async () => {
    if (!localStreamRef.current) return

    if (isAudioEnabled) {
      // Turn OFF: stop ALL audio tracks completely
      const currentTracks = localStreamRef.current.getAudioTracks()
      currentTracks.forEach((track) => {
        track.stop() // This stops the hardware stream
        try {
          localStreamRef.current.removeTrack(track)
        } catch (e) {
          // ignore if removeTrack fails
        }
      })
      // Also clear all tracked audio tracks
      allAudioTracksRef.current.forEach((track) => {
        if (track.readyState !== 'ended') {
          track.stop()
        }
      })
      setIsAudioEnabled(false)
    } else {
      // Turn ON: get a fresh audio track
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })
        const newAudioTrack = newStream.getAudioTracks()[0]
        if (newAudioTrack) {
          // Add onended handler to clean up when track naturally ends
          newAudioTrack.onended = () => {
            setError('Microphone disconnected')
          }
          allAudioTracksRef.current.push(newAudioTrack)
          localStreamRef.current.addTrack(newAudioTrack)
          setIsAudioEnabled(true)
          setLocalStream(null)
          setTimeout(() => setLocalStream(localStreamRef.current), 0)
        }
      } catch (err) {
        setError('Failed to restart microphone')
      }
    }
  }

  // Toggle video — stop and restart camera so hardware light turns off when disabled
  const toggleVideo = async () => {
    if (!localStreamRef.current) return

    if (isVideoEnabled) {
      // Turn OFF: stop ALL video tracks completely
      const currentTracks = localStreamRef.current.getVideoTracks()
      currentTracks.forEach((track) => {
        track.stop() // This stops the hardware stream
        try {
          localStreamRef.current.removeTrack(track)
        } catch (e) {
          // ignore if removeTrack fails
        }
      })
      // Also clear all tracked video tracks
      allVideoTracksRef.current.forEach((track) => {
        if (track.readyState !== 'ended') {
          track.stop()
        }
      })
      setIsVideoEnabled(false)
    } else {
      // Turn ON: get a fresh video track
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        const newVideoTrack = newStream.getVideoTracks()[0]
        if (newVideoTrack) {
          // Add onended handler to clean up when track naturally ends
          newVideoTrack.onended = () => {
            setError('Camera disconnected')
          }
          allVideoTracksRef.current.push(newVideoTrack)
          localStreamRef.current.addTrack(newVideoTrack)
          setIsVideoEnabled(true)
          setLocalStream(null)
          setTimeout(() => setLocalStream(localStreamRef.current), 0)
        }
      } catch (err) {
        setError('Failed to restart camera')
      }
    }
  }

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })

      screenStream.current = stream
      setIsScreenSharing(true)

      const [videoTrack] = stream.getVideoTracks()
      if (videoTrack) {
        videoTrack.onended = () => {
          stopScreenShare()
        }
      }

      return stream
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        setError('Failed to share screen')
      }
      return null
    }
  }

  const stopScreenShare = () => {
    if (screenStream.current) {
      screenStream.current.getTracks().forEach((track) => track.stop())
      screenStream.current = null
    }
    setIsScreenSharing(false)
  }

  // Get available devices
  const getDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioDevices = devices.filter((d) => d.kind === 'audioinput')
      const videoDevices = devices.filter((d) => d.kind === 'videoinput')

      return {
        audioDevices,
        videoDevices,
      }
    } catch (err) {
      setError('Failed to enumerate devices')
      return { audioDevices: [], videoDevices: [] }
    }
  }

  // Switch camera/microphone
  const switchDevice = async (deviceId, kind) => {
    try {
      // Stop only the relevant tracks
      if (localStreamRef.current) {
        if (kind === 'videoinput') {
          const videoTracks = localStreamRef.current.getVideoTracks()
          videoTracks.forEach((track) => {
            track.stop()
            try {
              localStreamRef.current.removeTrack(track)
            } catch (e) {
              // ignore if removeTrack fails
            }
          })
        } else if (kind === 'audioinput') {
          const audioTracks = localStreamRef.current.getAudioTracks()
          audioTracks.forEach((track) => {
            track.stop()
            try {
              localStreamRef.current.removeTrack(track)
            } catch (e) {
              // ignore if removeTrack fails
            }
          })
        }
      }

      // Use correct constraint syntax with exact deviceId
      const constraints = {
        audio: kind === 'audioinput' ? { deviceId: { exact: deviceId } } : isAudioEnabled,
        video: kind === 'videoinput' ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } : isVideoEnabled,
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      
      // Merge new tracks with existing stream
      if (kind === 'videoinput') {
        const newVideoTrack = stream.getVideoTracks()[0]
        if (newVideoTrack && localStreamRef.current) {
          newVideoTrack.onended = () => {
            setError('Camera disconnected')
          }
          allVideoTracksRef.current.push(newVideoTrack)
          localStreamRef.current.addTrack(newVideoTrack)
        }
        // Stop all tracks from the temporary stream except video
        stream.getAudioTracks().forEach((track) => track.stop())
      } else if (kind === 'audioinput') {
        const newAudioTrack = stream.getAudioTracks()[0]
        if (newAudioTrack && localStreamRef.current) {
          newAudioTrack.onended = () => {
            setError('Microphone disconnected')
          }
          allAudioTracksRef.current.push(newAudioTrack)
          localStreamRef.current.addTrack(newAudioTrack)
        }
        // Stop all tracks from the temporary stream except audio
        stream.getVideoTracks().forEach((track) => track.stop())
      }

      setLocalStream(localStreamRef.current)
      return stream
    } catch (err) {
      setError('Failed to switch device')
      return null
    }
  }

  const createPeerConnection = (socketId, socketRef) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    })

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('ice-candidate', event.candidate, socketId)
      }
    }

    pc.ontrack = (event) => {
      setRemoteStreams((prev) => ({
        ...prev,
        [socketId]: event.streams[0]
      }))
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current)
      })
    }

    if (screenStream.current) {
      screenStream.current.getTracks().forEach((track) => {
        pc.addTrack(track, screenStream.current)
      })
    }

    peerConnectionsRef.current[socketId] = pc
    return pc
  }

  const handleUserConnected = async (socketId, socketRef) => {
    const pc = createPeerConnection(socketId, socketRef)
    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socketRef.current.emit('webrtc-offer', offer, socketId)
    } catch (err) {
      console.error('Error creating offer', err)
    }
  }

  const handleOffer = async (offer, senderSocketId, socketRef) => {
    const pc = createPeerConnection(senderSocketId, socketRef)
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      socketRef.current.emit('webrtc-answer', answer, senderSocketId)
    } catch (err) {
      console.error('Error handling offer', err)
    }
  }

  const handleAnswer = async (answer, senderSocketId) => {
    const pc = peerConnectionsRef.current[senderSocketId]
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer))
      } catch (err) {
        console.error('Error handling answer', err)
      }
    }
  }

  const handleIceCandidate = async (candidate, senderSocketId) => {
    const pc = peerConnectionsRef.current[senderSocketId]
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (err) {
        console.error('Error handling ice candidate', err)
      }
    }
  }

  const handleUserDisconnected = (socketId) => {
    if (peerConnectionsRef.current[socketId]) {
      peerConnectionsRef.current[socketId].close()
      delete peerConnectionsRef.current[socketId]
    }
    setRemoteStreams((prev) => {
      const newStreams = { ...prev }
      delete newStreams[socketId]
      return newStreams
    })
  }

  // Cleanup
  useEffect(() => {
    return () => {
      stopMedia()
      Object.values(peerConnectionsRef.current).forEach((pc) => {
        if (pc) {
          pc.onicecandidate = null
          pc.ontrack = null
          pc.close()
        }
      })
    }
  }, [])

  return {
    localStream,
    remoteStreams,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    screenStream,
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
    handleUserDisconnected
  }
}
