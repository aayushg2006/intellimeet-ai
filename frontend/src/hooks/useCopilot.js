import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Holds live copilot insights for a meeting.
 *
 * The handlers are exposed through a ref so VideoRoom can wire them into its
 * single large socket effect without adding dependencies to it — that effect is
 * keyed on [meetingId], and re-running it would tear down every socket
 * listener and the peer connections along with them.
 */
export const useCopilot = () => {
  const [items, setItems] = useState([])
  const [status, setStatus] = useState('idle')

  const handlersRef = useRef(null)

  const mergeItems = useCallback((incoming) => {
    setItems((prev) => {
      const seen = new Set(prev.map((item) => item.id))
      const fresh = (incoming || []).filter((item) => item && !seen.has(item.id))
      return fresh.length ? [...prev, ...fresh] : prev
    })
  }, [])

  // Populated in an effect rather than during render — writing to a ref while
  // rendering is not safe under concurrent rendering.
  useEffect(() => {
    handlersRef.current = {
      insights: (payload) => mergeItems(payload?.items),
      snapshot: (payload) => {
        setItems(payload?.items || [])
        setStatus(payload?.status || 'idle')
      },
      status: (payload) => setStatus(payload?.state || 'idle'),
    }
  }, [mergeItems])

  const reset = useCallback(() => {
    setItems([])
    setStatus('idle')
  }, [])

  return { items, status, handlersRef, reset }
}

export default useCopilot
