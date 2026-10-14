import type { Server as HttpServer } from 'node:http';
import { Server, Socket } from 'socket.io';
import { verifyToken, type AuthUser } from '../middleware/auth.ts';

export interface MotionSocket extends Socket {
  user?: AuthUser;
}

let io: Server | null = null;
const activeProjectUsers = new Map<string, Map<string, { userId: string; name: string }>>();
const connectedUserSockets = new Map<string, Set<string>>(); // userId -> Set of socket IDs

export function isUserOnline(userId: string): boolean {
  return (connectedUserSockets.get(userId)?.size || 0) > 0;
}

export function getOnlineUserIds(): string[] {
  return Array.from(connectedUserSockets.entries())
    .filter(([_, set]) => set.size > 0)
    .map(([userId]) => userId);
}

export function initSocketIO(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // Authentication middleware for socket connections
  io.use((socket: MotionSocket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (typeof token === 'string') {
      const user = verifyToken(token);
      if (user) {
        socket.user = user;
        return next();
      }
    }
    // Allow guest or handle unauthenticated connection gracefully
    next();
  });

  io.on('connection', (socket: MotionSocket) => {
    const user = socket.user;
    if (user) {
      // Join personal user room for direct notifications
      socket.join(`user:${user.id}`);

      // Track global online status
      if (!connectedUserSockets.has(user.id)) {
        connectedUserSockets.set(user.id, new Set());
      }
      connectedUserSockets.get(user.id)!.add(socket.id);

      // Broadcast team pulse presence update to all clients
      io?.emit('presence:global', { onlineUserIds: getOnlineUserIds() });
      io?.emit('team:pulse:update', { userId: user.id, isOnline: true });
    }

    // Join project room
    socket.on('join:project', ({ projectId }) => {
      if (!projectId) return;
      socket.join(`project:${projectId}`);

      if (user) {
        if (!activeProjectUsers.has(projectId)) {
          activeProjectUsers.set(projectId, new Map());
        }
        activeProjectUsers.get(projectId)!.set(socket.id, { userId: user.id, name: user.name });

        // Broadcast presence
        const viewers = Array.from(activeProjectUsers.get(projectId)!.values());
        io?.to(`project:${projectId}`).emit('presence:update', { projectId, viewers });
      }
    });

    // Leave project room
    socket.on('leave:project', ({ projectId }) => {
      if (!projectId) return;
      socket.leave(`project:${projectId}`);
      if (user && activeProjectUsers.has(projectId)) {
        activeProjectUsers.get(projectId)!.delete(socket.id);
        const viewers = Array.from(activeProjectUsers.get(projectId)!.values());
        io?.to(`project:${projectId}`).emit('presence:update', { projectId, viewers });
      }
    });

    socket.on('disconnect', () => {
      if (user && connectedUserSockets.has(user.id)) {
        connectedUserSockets.get(user.id)!.delete(socket.id);
        if (connectedUserSockets.get(user.id)!.size === 0) {
          connectedUserSockets.delete(user.id);
        }
        io?.emit('presence:global', { onlineUserIds: getOnlineUserIds() });
        io?.emit('team:pulse:update', { userId: user.id, isOnline: false });
      }

      // Clean up presence across any project rooms
      for (const [projectId, userMap] of activeProjectUsers.entries()) {
        if (userMap.has(socket.id)) {
          userMap.delete(socket.id);
          const viewers = Array.from(userMap.values());
          io?.to(`project:${projectId}`).emit('presence:update', { projectId, viewers });
        }
      }
    });
  });

  return io;
}

export function getIO(): Server | null {
  return io;
}

// Helper broadcast functions ensuring real-time notification to all connected clients
export function broadcastToProject(projectId: string, event: string, payload: any): void {
  if (!io) return;
  io.to(`project:${projectId}`).emit(event, payload);
}

export function broadcastToUser(userId: string, event: string, payload: any): void {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}
