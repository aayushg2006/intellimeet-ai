import { io } from 'socket.io-client'
import { getFreshToken } from './api'

/**
 * A single app-wide socket for things that aren't tied to a meeting —
 * notifications, workspace refreshes.
 *
 * VideoRoom keeps its own connection for the meeting itself; one extra socket
 * per tab is much cheaper than restructuring that page's connection lifecycle.
 */
let socket = null

export const getAppSocket = () => {
  if (socket) return socket

  socket = io(import.meta.env.VITE_API_URL || '/', {
    path: '/socket.io',
    // Callback form so reconnects pick up a refreshed access token rather than
    // replaying an expired one.
    auth: (cb) => {
      getFreshToken().then((token) => cb({ token }))
    },
  })

  return socket
}

export const closeAppSocket = () => {
  socket?.disconnect()
  socket = null
}

export default getAppSocket
