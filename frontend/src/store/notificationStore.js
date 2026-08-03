import { create } from 'zustand'

/**
 * Only the unread badge count and panel visibility live here.
 *
 * The notification *list* is owned by TanStack Query (see useNotifications),
 * so there is exactly one source of truth for it — duplicating the list into
 * zustand would mean two caches to keep in sync.
 *
 * Not persisted: the count is authoritative from the server on every connect.
 */
export const useNotificationStore = create((set) => ({
  unreadCount: 0,
  isOpen: false,

  setUnread: (count) => set({ unreadCount: Math.max(0, count) }),
  incUnread: (delta = 1) => set((state) => ({ unreadCount: Math.max(0, state.unreadCount + delta) })),
  decUnread: (delta = 1) => set((state) => ({ unreadCount: Math.max(0, state.unreadCount - delta) })),

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}))
