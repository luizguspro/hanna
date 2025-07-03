import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import { QueryResponseDto, QueryMatch, KnowledgeMetadata } from './dto/query-response.dto';

@Injectable()
export class KnowledgeBaseService implements OnModuleInit {
  private readonly logger = new Logger(KnowledgeBaseService.name);
  private pinecone: Pinecone;
  private openai: OpenAI;
  private indexName: string;
  private embeddingModel: string;

  constructor(private configService: ConfigService) {
    this.indexName = this.configService.get<string>('PINECONE_INDEX_NAME', 'hanna-knowledge-base');
    this.embeddingModel = this.configService.get<string>('EMBEDDING_MODEL', 'text-embedding-3-large');
  }

  async onModuleInit() {
    await this.initializeClients();
  }

  private async initializeClients() {
    try {
      // Inicializar cliente Pinecone
      const pineconeApiKey = this.configService.get<string>('PINECONE_API_KEY');
      if (!pineconeApiKey) {
        throw new Error('PINECONE_API_KEY não está configurada');
      }

      this.pinecone = new Pinecone({
        apiKey: pineconeApiKey,
      });

      // Verificar se o índice existe
      const indexList = await this.pinecone.listIndexes();
      const indexExists = indexList.indexes?.some(index => index.name === this.indexName);
      
      if (!indexExists) {
        throw new Error(`Índice ${this.indexName} não encontrado no Pinecone`);
      }

      // Inicializar cliente OpenAI
      const openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');
      if (!openaiApiKey) {
        throw new Error('OPENAI_API_KEY não está configurada');
      }

      this.openai = new OpenAI({
        apiKey: openaiApiKey,
      });

      this.logger.log('Clientes Pinecone e OpenAI inicializados com sucesso');
    } catch (error) {
      this.logger.error('Erro ao inicializar clientes:', error);
      throw error;
    }
  }

  /**
   * Consulta a base de conhecimento usando busca vetorial
   * @param userQuestion - Pergunta do usuário em linguagem natural
   * @returns QueryResponseDto com os metadados dos resultados encontrados
   */
  async query(userQuestion: string): Promise<QueryResponseDto> {
    try {
      this.logger.log(`Processando pergunta: ${userQuestion}`);

      // Etapa 1: Gerar embedding da pergunta usando OpenAI
      const embedding = await this.generateEmbedding(userQuestion);

      // Etapa 2: Conectar ao índice do Pinecone
      const index = this.pinecone.index(this.indexName);

      // Etapa 3: Executar busca vetorial
      const queryResponse = await index.query({
        vector: embedding,
        topK: 3,
        includeMetadata: true,
      });

      // Etapa 4: Processar e formatar resultados
      const matches: QueryMatch[] = queryResponse.matches
        .filter(match => match.metadata) // Garantir que metadata existe
        .map(match => ({
          id: match.id,
          score: match.score || 0,
          metadata: this.validateMetadata(match.metadata),
        }));

      this.logger.log(`Encontrados ${matches.length} resultados relevantes`);

      // Etapa 5: Retornar metadados formatados
      return new QueryResponseDto(matches, userQuestion);

    } catch (error) {
      this.logger.error('Erro ao consultar base de conhecimento:', error);
      throw error;
    }
  }

  /**
   * Valida e garante que o metadata tem a estrutura esperada
   * @param metadata - Metadata retornado pelo Pinecone
   * @returns KnowledgeMetadata validado
   */
  private validateMetadata(metadata: any): KnowledgeMetadata {
    return {
      question: metadata?.question || '',
      source: metadata?.source || '',
      summary: metadata?.summary || '',
      tags: Array.isArray(metadata?.tags) ? metadata.tags : [],
      text: metadata?.text || '',
    };
  }

  /**
   * Gera embedding de um texto usando o modelo text-embedding-3-large da OpenAI
   * @param text - Texto para gerar embedding
   * @returns Array de 1536 dimensões representando o vetor
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text,
        encoding_format: 'float',
        dimensions: 1536,  // IMPORTANTE: Especificar 1536 dimensões para compatibilidade com Pinecone
      });

      const embedding = response.data[0].embedding;
      
      // Validar dimensões
      if (embedding.length !== 1536) {
        throw new Error(`Embedding com dimensões incorretas: ${embedding.length} (esperado: 1536)`);
      }

      return embedding;
    } catch (error) {
      this.logger.error('Erro ao gerar embedding:', error);
      throw error;
    }
  }

  /**
   * Método auxiliar para testar a conexão com Pinecone
   */
  async testConnection(): Promise<boolean> {
    try {
      const index = this.pinecone.index(this.indexName);
      const stats = await index.describeIndexStats();
      
      this.logger.log('Estatísticas do índice:', {
        dimension: stats.dimension,
        totalVectorCount: stats.totalRecordCount,
        namespaces: stats.namespaces,
      });

      return true;
    } catch (error) {
      this.logger.error('Erro ao testar conexão:', error);
      return false;
    }
  }
}