import { io, Socket } from 'socket.io-client';
import { BASE_URL } from '../api/auth';

let socket: Socket | null = null;

export function connectSocket(accessToken: string): Socket {
  if (socket?.connected) return socket;
  socket = io(`${BASE_URL}/ws`, {
    auth: { token: accessToken },
    reconnection: true,
    reconnectionDelay: 2000,
  });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
