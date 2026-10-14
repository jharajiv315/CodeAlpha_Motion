import { io, Socket } from 'socket.io-client';
import { getStoredToken } from './api.ts';

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (!socketInstance) {
    const token = getStoredToken();
    socketInstance = io(window.location.origin, {
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      console.log('[Realtime] Socket connected to MOTION server');
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[Realtime] Socket disconnected:', reason);
    });
  }

  return socketInstance;
}

export function updateSocketAuthToken(token: string | null): void {
  if (socketInstance) {
    socketInstance.auth = { token };
    if (socketInstance.connected) {
      socketInstance.disconnect().connect();
    }
  }
}
