import { io, Socket } from 'socket.io-client';
import { Message } from '@/components/ChatTranscript/ChatTranscript';

export interface WebSocketEvents {
  onSessionStarted: (sessionId: string) => void;
  onUserTranscript: (transcript: string, isFinal: boolean) => void;
  onHannaSpeakingText: (text: string) => void;
  onHannaSpeakingAudio: (audioData: ArrayBuffer) => void;
  onError: (message: string, code: string) => void;
}

export class WebSocketService {
  private socket: Socket | null = null;
  private sessionId: string | null = null;
  private events: Partial<WebSocketEvents> = {};

  constructor() {
    // Singleton pattern
    if ((window as any).wsService) {
      return (window as any).wsService;
    }
    (window as any).wsService = this;
  }

  connect(url: string = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001'): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      this.socket = io(url, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => {
        console.log('WebSocket conectado:', this.socket?.id);
        resolve();
      });

      this.socket.on('disconnect', () => {
        console.log('WebSocket desconectado');
        this.sessionId = null;
      });

      this.socket.on('connect_error', (error) => {
        console.error('Erro de conexão:', error);
        reject(error);
      });

      // Configurar listeners dos eventos
      this.setupEventListeners();
    });
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('server:session_started', (data: { sessionId: string }) => {
      this.sessionId = data.sessionId;
      this.events.onSessionStarted?.(data.sessionId);
    });

    this.socket.on('server:user_transcript', (data: { transcript: string; is_final: boolean }) => {
      this.events.onUserTranscript?.(data.transcript, data.is_final);
    });

    this.socket.on('server:hanna_speaking_text', (data: { text_chunk: string }) => {
      this.events.onHannaSpeakingText?.(data.text_chunk);
    });

    this.socket.on('server:hanna_speaking_audio', (data: ArrayBuffer) => {
      this.events.onHannaSpeakingAudio?.(data);
    });

    this.socket.on('server:error', (data: { message: string; code: string }) => {
      this.events.onError?.(data.message, data.code);
    });
  }

  on<K extends keyof WebSocketEvents>(event: K, handler: WebSocketEvents[K]) {
    this.events[event] = handler;
  }

  startSession(deviceId: string): void {
    if (!this.socket?.connected) {
      throw new Error('WebSocket não conectado');
    }

    this.socket.emit('client:start_session', { deviceId });
  }

  sendAudioChunk(audioData: ArrayBuffer): void {
    if (!this.socket?.connected || !this.sessionId) {
      console.warn('Tentativa de enviar áudio sem sessão ativa');
      return;
    }

    this.socket.emit('client:audio_chunk', audioData);
  }

  endOfSpeech(): void {
    if (!this.socket?.connected || !this.sessionId) {
      return;
    }

    this.socket.emit('client:end_of_speech');
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.sessionId = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }
}