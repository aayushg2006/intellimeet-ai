import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useNotificationStore } from '../store/notificationStore'

/**
 * The notification list, paginated by cursor.
 *
 * TanStack Query owns the list; the zustand store owns only the badge count.
 */
export const useNotifications = (filter = 'all', enabled = true) =>
  useInfiniteQuery({
    queryKey: ['notifications', filter],
    queryFn: async ({ pageParam }) => {
      const { data } = await api.get('/api/notifications', {
        params: { filter, limit: 20, ...(pageParam ? { cursor: pageParam } : {}) },
      })
      return data
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled,
    staleTime: 30_000,
  })

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient()
  const decUnread = useNotificationStore((s) => s.decUnread)

  return useMutation({
    mutationFn: (id) => api.patch(`/api/notifications/${id}/read`),
    onMutate: async (id) => {
      // Optimistic: flipping the row and decrementing the badge should feel
      // instant, and the socket broadcast will reconcile other tabs.
      decUnread(1)

      queryClient.setQueriesData({ queryKey: ['notifications'] }, (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((item) => (item._id === id ? { ...item, read: true } : item)),
          })),
        }
      })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient()
  const setUnread = useNotificationStore((s) => s.setUnread)

  return useMutation({
    mutationFn: () => api.patch('/api/notifications/read-all'),
    onMutate: async () => {
      setUnread(0)
      queryClient.setQueriesData({ queryKey: ['notifications'] }, (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((item) => ({ ...item, read: true })),
          })),
        }
      })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}
