import { Injectable, Logger } from '@nestjs/common';

interface AudioSession {
  sessionId: string;
  buffers: Buffer[];
  totalSize: number;
  lastActivity: Date;
  isProcessing: boolean;
}

@Injectable()
export class AudioBufferService {
  private readonly logger = new Logger(AudioBufferService.name);
  private sessions = new Map<string, AudioSession>();
  
  // Configurações
  private readonly MIN_BUFFER_SIZE = 16000; // ~360ms a 44.1kHz
  private readonly MAX_BUFFER_SIZE = 441000; // ~10s a 44.1kHz
  private readonly SILENCE_THRESHOLD = 50; // ms de silêncio para processar

  /**
   * Adiciona um chunk de áudio ao buffer da sessão
   * @param sessionId - ID da sessão
   * @param audioData - Dados de áudio
   * @returns true se o buffer está pronto para processar
   */
  addChunk(sessionId: string, audioData: ArrayBuffer): boolean {
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      session = {
        sessionId,
        buffers: [],
        totalSize: 0,
        lastActivity: new Date(),
        isProcessing: false,
      };
      this.sessions.set(sessionId, session);
    }

    // Converter ArrayBuffer para Buffer
    const buffer = Buffer.from(audioData);
    session.buffers.push(buffer);
    session.totalSize += buffer.length;
    session.lastActivity = new Date();

    // Verificar se deve processar
    const shouldProcess = session.totalSize >= this.MIN_BUFFER_SIZE && !session.isProcessing;
    
    if (session.totalSize >= this.MAX_BUFFER_SIZE) {
      this.logger.warn(`Buffer máximo atingido para sessão ${sessionId}`);
      return true;
    }

    return shouldProcess;
  }

  /**
   * Obtém e limpa o buffer de áudio para processamento
   * @param sessionId - ID da sessão
   * @returns Buffer combinado ou null
   */
  getAndClearBuffer(sessionId: string): Buffer | null {
    const session = this.sessions.get(sessionId);
    
    if (!session || session.buffers.length === 0) {
      return null;
    }

    // Marcar como em processamento
    session.isProcessing = true;

    // Combinar todos os buffers
    const combined = Buffer.concat(session.buffers);
    
    // Limpar buffers
    session.buffers = [];
    session.totalSize = 0;
    session.isProcessing = false;

    this.logger.log(`Buffer processado: ${combined.length} bytes para sessão ${sessionId}`);
    
    return combined;
  }

  /**
   * Força o processamento do buffer (ex: fim de fala)
   * @param sessionId - ID da sessão
   * @returns Buffer combinado ou null
   */
  forceProcess(sessionId: string): Buffer | null {
    const session = this.sessions.get(sessionId);
    
    if (!session || session.totalSize === 0) {
      return null;
    }

    return this.getAndClearBuffer(sessionId);
  }

  /**
   * Remove uma sessão
   * @param sessionId - ID da sessão
   */
  removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.logger.log(`Sessão de áudio removida: ${sessionId}`);
  }

  /**
   * Limpa sessões inativas
   * @param maxInactiveMs - Tempo máximo de inatividade em ms
   */
  cleanupInactiveSessions(maxInactiveMs: number = 300000): void {
    const now = Date.now();
    
    for (const [sessionId, session] of this.sessions.entries()) {
      const inactiveTime = now - session.lastActivity.getTime();
      
      if (inactiveTime > maxInactiveMs) {
        this.removeSession(sessionId);
      }
    }
  }
}