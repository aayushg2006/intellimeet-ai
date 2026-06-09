import { useEffect, useRef, useState } from 'react'

export const useWebRTC = () => {
  const [localStream, setLocalStream] = useState(null)
  const [remoteStreams, setRemoteStreams] = useState({})
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [error, setError] = useState(null)

  const peerConnectionsRef = useRef({})
  const localStreamRef = useRef(null)

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
  }

  // Toggle audio
  const toggleAudio = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled
      })
      setIsAudioEnabled(!isAudioEnabled)
    }
  }

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled
      })
      setIsVideoEnabled(!isVideoEnabled)
    }
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
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop())
      }

      const constraints = {
        audio: kind === 'audioinput' ? { deviceId } : true,
        video: kind === 'videoinput' ? { deviceId } : true,
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      setLocalStream(stream)
      localStreamRef.current = stream

      return stream
    } catch (err) {
      setError('Failed to switch device')
      return null
    }
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
    error,
    initializeMedia,
    stopMedia,
    toggleAudio,
    toggleVideo,
    getDevices,
    switchDevice,
  }
}
