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
  const shouldFetch = !!s3Key && !!token && !s3Key.startsWith('http://') && !s3Key.startsWith('https://')
  const directUrl = s3Key && (s3Key.startsWith('http://') || s3Key.startsWith('https://')) ? s3Key : null

  useEffect(() => {
    if (!shouldFetch) {
      return
    }

    let cancelled = false

    const fetchUrl = async () => {
      try {
        setLoading(true)
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
  }, [shouldFetch, s3Key, token])

  return { url: directUrl ?? (shouldFetch ? url : null), loading: shouldFetch && loading }
}
