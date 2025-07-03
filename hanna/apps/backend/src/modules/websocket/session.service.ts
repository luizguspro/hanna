import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { randomUUID } from 'crypto';

export interface Session {
  id: string;
  deviceId: string;
  socketId: string;
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private sessions = new Map<string, Session>();
  private socketToSession = new Map<string, string>();

  createSession(socket: Socket, deviceId: string): Session {
    const sessionId = randomUUID();
    const session: Session = {
      id: sessionId,
      deviceId,
      socketId: socket.id,
      createdAt: new Date(),
      lastActivity: new Date(),
      isActive: true,
    };

    this.sessions.set(sessionId, session);
    this.socketToSession.set(socket.id, sessionId);
    
    this.logger.log(`Sessão criada: ${sessionId} para dispositivo: ${deviceId}`);
    return session;
  }

  getSessionBySocketId(socketId: string): Session | undefined {
    const sessionId = this.socketToSession.get(socketId);
    if (!sessionId) return undefined;
    return this.sessions.get(sessionId);
  }

  updateLastActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  endSession(socketId: string): void {
    const sessionId = this.socketToSession.get(socketId);
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.isActive = false;
        this.logger.log(`Sessão encerrada: ${sessionId}`);
      }
      this.socketToSession.delete(socketId);
      // Mantém a sessão no Map por histórico, mas marca como inativa
    }
  }

  getActiveSessions(): number {
    return Array.from(this.sessions.values()).filter(s => s.isActive).length;
  }
}