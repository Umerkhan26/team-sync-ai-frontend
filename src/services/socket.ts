import { io, type Socket } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000'

let socket: Socket | null = null

export function getSocket() {
  return socket
}

export function connectSocket(accessToken: string) {
  if (socket?.connected) {
    return socket
  }

  if (socket) {
    socket.auth = { token: accessToken }
    socket.connect()
    return socket
  }

  socket = io(SOCKET_URL, {
    path: '/socket.io',
    autoConnect: true,
    withCredentials: true,
    auth: { token: accessToken },
    transports: ['websocket', 'polling'],
  })

  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export function joinOrgRoom(organizationId: string) {
  socket?.emit('org:join', organizationId)
}

export function leaveOrgRoom(organizationId: string) {
  socket?.emit('org:leave', organizationId)
}

export function joinChannelRoom(
  organizationId: string,
  channelId: string,
  cb?: (result: { success: boolean; error?: string }) => void,
) {
  socket?.emit('channel:join', { organizationId, channelId }, cb)
}

export function leaveChannelRoom(channelId: string) {
  socket?.emit('channel:leave', channelId)
}

export function emitTypingStart(channelId: string) {
  socket?.emit('typing:start', { channelId })
}

export function emitTypingStop(channelId: string) {
  socket?.emit('typing:stop', { channelId })
}
