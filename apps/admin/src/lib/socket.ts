import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectSocket(accessToken: string): Socket {
  if (socket?.connected) return socket;
  socket = io(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/ws`, {
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
