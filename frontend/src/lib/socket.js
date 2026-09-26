import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (socket) return socket;
  const token = localStorage.getItem('token');
  const url = import.meta.env.VITE_SOCKET_URL || '';
  socket = io(url || undefined, {
    auth: { token },
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
