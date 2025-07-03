import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { createReadStream, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    this.openai = new OpenAI({ apiKey });
    this.logger.log('OpenAI Service inicializado');
  }

  /**
   * Transcreve áudio usando Whisper
   * @param audioBuffer - Buffer de áudio em formato PCM16
   * @param sampleRate - Taxa de amostragem (padrão 44100)
   * @returns Texto transcrito
   */
  async transcribeAudio(audioBuffer: Buffer, sampleRate: number = 44100): Promise<string> {
    const tempFilePath = join(tmpdir(), `audio-${randomUUID()}.wav`);
    
    try {
      this.logger.log(`Transcrevendo áudio: ${audioBuffer.length} bytes`);

      // Converter PCM16 para WAV
      const wavBuffer = this.pcm16ToWav(audioBuffer, sampleRate);
      
      // Salvar temporariamente
      writeFileSync(tempFilePath, wavBuffer);

      // Criar stream do arquivo
      const audioStream = createReadStream(tempFilePath);

      // Chamar Whisper API
      const response = await this.openai.audio.transcriptions.create({
        file: audioStream as any,
        model: 'whisper-1',
        language: 'pt', // Português
        response_format: 'text',
      });

      this.logger.log(`Transcrição completa: "${response}"`);
      return response;

    } catch (error) {
      this.logger.error('Erro ao transcrever áudio:', error);
      
      // Tratamento específico para erros comuns
      if (error.response?.status === 400) {
        throw new Error('Áudio muito curto ou formato inválido. Mínimo de 0.1 segundos necessário.');
      }
      
      throw error;
    } finally {
      // Limpar arquivo temporário
      try {
        unlinkSync(tempFilePath);
      } catch (e) {
        // Ignorar erro se arquivo já foi removido
      }
    }
  }

  /**
   * Gera resposta usando GPT-4
   * @param messages - Array de mensagens do chat
   * @returns Resposta do assistente
   */
  async generateResponse(messages: OpenAI.ChatCompletionMessageParam[]): Promise<string> {
    try {
      this.logger.log('Gerando resposta com GPT-4...');

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages,
        temperature: 0.7,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content || '';
      this.logger.log(`Resposta gerada: ${content.substring(0, 100)}...`);
      
      return content;

    } catch (error) {
      this.logger.error('Erro ao gerar resposta:', error);
      
      if (error.response?.status === 429) {
        throw new Error('Limite de requisições excedido. Tente novamente em alguns segundos.');
      }
      
      throw error;
    }
  }

  /**
   * Sintetiza fala usando TTS
   * @param text - Texto para sintetizar
   * @returns Buffer de áudio MP3
   */
  async synthesizeSpeech(text: string): Promise<Buffer> {
    try {
      this.logger.log(`Sintetizando fala: "${text.substring(0, 50)}..."`);

      const response = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: 'nova', // Voz feminina natural
        input: text,
        response_format: 'mp3',
        speed: 1.0,
      });

      // Converter Response para Buffer
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      this.logger.log(`Áudio sintetizado: ${buffer.length} bytes`);
      return buffer;

    } catch (error) {
      this.logger.error('Erro ao sintetizar fala:', error);
      
      if (error.response?.status === 429) {
        throw new Error('Limite de requisições TTS excedido.');
      }
      
      throw error;
    }
  }

  /**
   * Converte PCM16 para WAV adicionando header
   * @param pcmBuffer - Buffer com dados PCM16
   * @param sampleRate - Taxa de amostragem
   * @returns Buffer WAV completo
   */
  private pcm16ToWav(pcmBuffer: Buffer, sampleRate: number): Buffer {
    const channels = 1; // Mono
    const bitsPerSample = 16;
    const byteRate = sampleRate * channels * (bitsPerSample / 8);
    const blockAlign = channels * (bitsPerSample / 8);
    const dataSize = pcmBuffer.length;
    const fileSize = 44 + dataSize; // 44 bytes for WAV header

    const header = Buffer.alloc(44);

    // RIFF header
    header.write('RIFF', 0);
    header.writeUInt32LE(fileSize - 8, 4);
    header.write('WAVE', 8);

    // fmt subchunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // Subchunk1Size
    header.writeUInt16LE(1, 20); // AudioFormat (PCM)
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);

    // data subchunk
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcmBuffer]);
  }

  /**
   * Cria prompt do sistema para a Hanna
   * @returns Prompt do sistema
   */
  getSystemPrompt(): string {
    return `Você é a Hanna, a recepcionista virtual do Impact Hub Florianópolis.

Sua personalidade:
- Amigável, profissional e acolhedora
- Conhece profundamente o Impact Hub e seus serviços
- Fala português brasileiro de forma natural
- Responde de forma concisa e objetiva (máximo 3 frases)
- Sempre oferece ajuda adicional

Diretrizes:
1. Use o contexto fornecido para responder com precisão
2. Se não souber algo, admita e ofereça buscar a informação
3. Mantenha um tom conversacional e caloroso
4. Foque em ser útil e resolver a necessidade do visitante
5. Termine sempre perguntando se pode ajudar em mais alguma coisa`;
  }
}