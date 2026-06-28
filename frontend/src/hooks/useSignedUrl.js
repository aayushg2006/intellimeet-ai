import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import axios from 'axios'

/**
 * React hook that resolves an S3 key into a temporary pre-signed URL.
 * Returns null if the key is empty, undefined, or is already a full URL (Google avatar, etc.).
 * Re-fetches automatically when the key changes.
 */
export const useSignedUrl = (s3Key) => {
  const [url, setUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const { token } = useAuthStore()

  useEffect(() => {
    if (!s3Key || !token) {
      setUrl(null)
      return
    }

    // If the key is already a full URL (e.g., Google profile pic), use it directly
    if (s3Key.startsWith('http://') || s3Key.startsWith('https://')) {
      setUrl(s3Key)
      return
    }

    let cancelled = false
    setLoading(true)

    const fetchUrl = async () => {
      try {
        const res = await axios.get('/api/uploads/signed-url', {
          params: { key: s3Key },
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!cancelled) {
          setUrl(res.data.url)
        }
      } catch (err) {
        console.error('Failed to resolve signed URL:', err)
        if (!cancelled) setUrl(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchUrl()

    return () => { cancelled = true }
  }, [s3Key, token])

  return { url, loading }
}
