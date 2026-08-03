import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Bell } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useNotificationStore } from '../store/notificationStore'
import { getAppSocket, closeAppSocket } from '../lib/appSocket'
import { api } from '../lib/api'

/**
 * Keeps notification state live.
 *
 * Must render inside the Router, because notification toasts navigate on click.
 */
export const NotificationProvider = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setUnread = useNotificationStore((s) => s.setUnread)
  const incUnread = useNotificationStore((s) => s.incUnread)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated) {
      closeAppSocket()
      setUnread(0)
      return
    }

    const socket = getAppSocket()

    const handleNew = (notification) => {
      incUnread(1)

      // Prepend into the cached first page so the panel is correct even if it
      // is already open.
      queryClient.setQueryData(['notifications', 'all'], (old) => {
        if (!old?.pages?.length) return old
        const [first, ...rest] = old.pages
        return {
          ...old,
          pages: [{ ...first, items: [notification, ...first.items] }, ...rest],
        }
      })

      toast(
        (t) => (
          <button
            type="button"
            onClick={() => {
              toast.dismiss(t.id)
              if (notification.link) navigate(notification.link)
            }}
            className="flex items-start gap-3 text-left"
          >
            <Bell size={16} className="mt-0.5 shrink-0 text-[#7C3AED]" aria-hidden="true" />
            <span>
              <span className="block text-sm font-semibold">{notification.title}</span>
              {notification.body && (
                <span className="block text-xs text-white/70">{notification.body}</span>
              )}
            </span>
          </button>
        ),
        { duration: 5000 }
      )
    }

    const handleUnread = ({ count }) => setUnread(count)

    socket.on('notification:new', handleNew)
    socket.on('notification:unread', handleUnread)

    // Authoritative count on mount and whenever the tab becomes visible again,
    // which also covers any socket events missed while disconnected.
    const syncCount = () => {
      api
        .get('/api/notifications/unread-count')
        .then(({ data }) => setUnread(data.count))
        .catch(() => {})
    }

    syncCount()
    socket.on('connect', syncCount)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') syncCount()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      socket.off('notification:new', handleNew)
      socket.off('notification:unread', handleUnread)
      socket.off('connect', syncCount)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [isAuthenticated, setUnread, incUnread, queryClient, navigate])

  return children
}

export default NotificationProvider
