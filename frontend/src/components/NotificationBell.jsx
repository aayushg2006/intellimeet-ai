import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, Loader, CalendarPlus, ListTodo, Sparkles, AtSign } from 'lucide-react'
import { useNotificationStore } from '../store/notificationStore'
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../hooks/useNotifications'

const ICONS = {
  task_assigned: ListTodo,
  meeting_invite: CalendarPlus,
  summary_ready: Sparkles,
  mention: AtSign,
}

const relativeTime = (value) => {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return new Date(value).toLocaleDateString()
}

export const NotificationBell = () => {
  const navigate = useNavigate()
  const { unreadCount, isOpen, toggle, close } = useNotificationStore()
  const containerRef = useRef(null)

  // Only fetch once the panel has been opened — no reason to pull the list for
  // every page load when the badge count alone drives the UI.
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useNotifications('all', isOpen)
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) close()
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') close()
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, close])

  const items = data?.pages.flatMap((page) => page.items) || []

  const handleOpenItem = (item) => {
    if (!item.read) markRead.mutate(item._id)
    close()
    if (item.link) navigate(item.link)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="relative rounded-xl border border-[#E8E4DD] bg-white p-2.5 text-[#1A1A1A] transition hover:bg-[#F5F2EE] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] focus-visible:ring-offset-2"
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#7C3AED] px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 flex max-h-[28rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-[#E8E4DD] bg-white shadow-xl shadow-black/10"
        >
          <div className="flex items-center justify-between border-b border-[#E8E4DD] px-4 py-3">
            <h2 className="text-sm font-semibold text-[#1A1A1A]">Notifications</h2>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-[#6B6560] transition hover:bg-[#F5F2EE] hover:text-[#1A1A1A]"
              >
                <CheckCheck size={14} aria-hidden="true" />
                Mark all read
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader size={20} className="animate-spin text-[#6B6560]" aria-label="Loading" />
              </div>
            ) : items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-[#6B6560]">
                You&apos;re all caught up.
              </p>
            ) : (
              <ul>
                {items.map((item) => {
                  const Icon = ICONS[item.type] || Bell
                  return (
                    <li key={item._id}>
                      <button
                        type="button"
                        onClick={() => handleOpenItem(item)}
                        className={`flex w-full gap-3 border-b border-[#F5F2EE] px-4 py-3 text-left transition hover:bg-[#FAF9F7] ${
                          item.read ? '' : 'bg-[#7C3AED]/[0.04]'
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            item.read ? 'bg-[#F5F2EE] text-[#6B6560]' : 'bg-[#7C3AED]/10 text-[#7C3AED]'
                          }`}
                        >
                          <Icon size={15} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium text-[#1A1A1A]">{item.title}</span>
                            {!item.read && (
                              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#7C3AED]" aria-label="Unread" />
                            )}
                          </span>
                          {item.body && (
                            <span className="mt-0.5 block truncate text-xs text-[#6B6560]">{item.body}</span>
                          )}
                          <span className="mt-1 block text-[11px] text-[#9A9490]">
                            {relativeTime(item.createdAt)}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {hasNextPage && (
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="border-t border-[#E8E4DD] px-4 py-2.5 text-xs font-medium text-[#7C3AED] transition hover:bg-[#FAF9F7] disabled:opacity-50"
            >
              {isFetchingNextPage ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationBell
