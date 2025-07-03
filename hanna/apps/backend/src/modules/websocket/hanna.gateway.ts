import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { SessionService } from './session.service';
import { AudioBufferService } from './audio-buffer.service';
import { OpenAIService } from '../openai/openai.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';

// Interfaces para os payloads
interface StartSessionPayload {
  deviceId: string;
}

interface ConversationContext {
  sessionId: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  lastUserMessage: string;
  isProcessing: boolean;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/',
})
export class HannaGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(HannaGateway.name);
  private conversations = new Map<string, ConversationContext>();
  
  constructor(
    private readonly sessionService: SessionService,
    private readonly audioBufferService: AudioBufferService,
    private readonly openAIService: OpenAIService,
    private readonly knowledgeBaseService: KnowledgeBaseService,
  ) {
    // Limpar sessões inativas a cada 5 minutos
    setInterval(() => {
      this.audioBufferService.cleanupInactiveSessions();
    }, 300000);
  }

  // Conexão estabelecida
  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado: ${client.id}`);
  }

  // Conexão encerrada
  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado: ${client.id}`);
    const session = this.sessionService.getSessionBySocketId(client.id);
    
    if (session) {
      this.audioBufferService.removeSession(session.id);
      this.conversations.delete(session.id);
      this.sessionService.endSession(client.id);
    }
  }

  // Handler: Iniciar Sessão
  @SubscribeMessage('client:start_session')
  async handleStartSession(
    @MessageBody() payload: StartSessionPayload,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.log(`Iniciando sessão para dispositivo: ${payload.deviceId}`);
      
      // Criar nova sessão
      const session = this.sessionService.createSession(client, payload.deviceId);
      
      // Inicializar contexto da conversa
      this.conversations.set(session.id, {
        sessionId: session.id,
        messages: [
          {
            role: 'system',
            content: this.openAIService.getSystemPrompt(),
          },
        ],
        lastUserMessage: '',
        isProcessing: false,
      });
      
      // Confirmar início da sessão
      client.emit('server:session_started', {
        sessionId: session.id,
      });
      
    } catch (error) {
      this.logger.error('Erro ao iniciar sessão:', error);
      client.emit('server:error', {
        message: 'Falha ao iniciar sessão',
        code: 'SESSION_START_ERROR',
      });
    }
  }

  // Handler: Receber Audio Chunk
  @SubscribeMessage('client:audio_chunk')
  async handleAudioChunk(
    @MessageBody() audioData: ArrayBuffer,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const session = this.sessionService.getSessionBySocketId(client.id);
      if (!session) {
        throw new Error('Sessão não encontrada');
      }

      // Adicionar chunk ao buffer
      const shouldProcess = this.audioBufferService.addChunk(session.id, audioData);
      
      // Se o buffer está pronto, processar
      if (shouldProcess) {
        this.processAudioBuffer(session.id, client);
      }
      
    } catch (error) {
      this.logger.error('Erro ao processar áudio:', error);
      client.emit('server:error', {
        message: 'Falha ao processar áudio',
        code: 'AUDIO_PROCESSING_ERROR',
      });
    }
  }

  // Handler: Fim da Fala
  @SubscribeMessage('client:end_of_speech')
  async handleEndOfSpeech(@ConnectedSocket() client: Socket) {
    try {
      const session = this.sessionService.getSessionBySocketId(client.id);
      if (!session) {
        throw new Error('Sessão não encontrada');
      }

      this.logger.log('Fim da fala detectado, processando buffer final...');
      
      // Forçar processamento do buffer
      await this.processAudioBuffer(session.id, client, true);
      
    } catch (error) {
      this.logger.error('Erro ao processar fim da fala:', error);
    }
  }

  /**
   * Processa o buffer de áudio acumulado
   * @param sessionId - ID da sessão
   * @param client - Socket do cliente
   * @param force - Forçar processamento mesmo com buffer pequeno
   */
  private async processAudioBuffer(sessionId: string, client: Socket, force: boolean = false) {
    const conversation = this.conversations.get(sessionId);
    if (!conversation || conversation.isProcessing) {
      return;
    }

    try {
      conversation.isProcessing = true;

      // Obter buffer de áudio
      const audioBuffer = force 
        ? this.audioBufferService.forceProcess(sessionId)
        : this.audioBufferService.getAndClearBuffer(sessionId);

      if (!audioBuffer || audioBuffer.length < 1000) {
        this.logger.warn('Buffer muito pequeno, ignorando...');
        return;
      }

      // ETAPA 1: Transcrever áudio com Whisper
      this.logger.log('Iniciando transcrição com Whisper...');
      const transcription = await this.openAIService.transcribeAudio(audioBuffer);
      
      if (!transcription || transcription.trim().length === 0) {
        this.logger.warn('Transcrição vazia, ignorando...');
        return;
      }

      // Enviar transcrição para o cliente
      client.emit('server:user_transcript', {
        transcript: transcription,
        is_final: true,
      });

      conversation.lastUserMessage = transcription;

      // ETAPA 2: Buscar contexto no Pinecone
      this.logger.log('Buscando contexto no Pinecone...');
      const knowledgeResponse = await this.knowledgeBaseService.query(transcription);
      
      // Construir contexto relevante
      let context = '';
      if (knowledgeResponse.matches.length > 0) {
        context = 'Informações relevantes do Impact Hub:\n';
        knowledgeResponse.matches.forEach((match, index) => {
          if (match.score > 0.7) { // Apenas matches relevantes
            context += `${index + 1}. ${match.metadata.text}\n\n`;
          }
        });
      }

      // ETAPA 3: Gerar resposta com GPT-4
      this.logger.log('Gerando resposta com GPT-4...');
      
      // Construir prompt
      const userMessage = context 
        ? `Contexto: ${context}\n\nPergunta do usuário: ${transcription}`
        : transcription;

      // Adicionar mensagem do usuário ao histórico
      conversation.messages.push({
        role: 'user',
        content: userMessage,
      });

      // Gerar resposta
      const response = await this.openAIService.generateResponse(conversation.messages);
      
      // Adicionar resposta ao histórico
      conversation.messages.push({
        role: 'assistant',
        content: response,
      });

      // Enviar texto da resposta
      client.emit('server:hanna_speaking_text', {
        text_chunk: response,
      });

      // ETAPA 4: Sintetizar fala com TTS
      this.logger.log('Sintetizando fala com TTS...');
      const audioResponse = await this.openAIService.synthesizeSpeech(response);
      
      // Enviar áudio em chunks
      const chunkSize = 16384; // 16KB por chunk
      for (let i = 0; i < audioResponse.length; i += chunkSize) {
        const chunk = audioResponse.slice(i, i + chunkSize);
        client.emit('server:hanna_speaking_audio', chunk);
        
        // Pequeno delay entre chunks para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      this.logger.log('Pipeline completo executado com sucesso!');

    } catch (error) {
      this.logger.error('Erro no pipeline de processamento:', error);
      client.emit('server:error', {
        message: 'Erro ao processar sua mensagem. Por favor, tente novamente.',
        code: 'PROCESSING_ERROR',
      });
    } finally {
      if (conversation) {
        conversation.isProcessing = false;
      }
    }
  }

  /**
   * Limita o histórico de mensagens para economizar tokens
   * @param messages - Array de mensagens
   * @param maxMessages - Número máximo de mensagens (excluindo system)
   */
  private limitMessageHistory(messages: any[], maxMessages: number = 10): any[] {
    const systemMessage = messages.find(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');
    
    if (otherMessages.length > maxMessages) {
      const recentMessages = otherMessages.slice(-maxMessages);
      return systemMessage ? [systemMessage, ...recentMessages] : recentMessages;
    }
    
    return messages;
  }
}