# Script para aplicar correção robusta no service

$serviceContent = @'
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
      const pineconeApiKey = this.configService.get<string>('PINECONE_API_KEY');
      if (!pineconeApiKey) {
        throw new Error('PINECONE_API_KEY nao esta configurada');
      }

      this.pinecone = new Pinecone({
        apiKey: pineconeApiKey,
      });

      const indexList = await this.pinecone.listIndexes();
      const indexExists = indexList.indexes?.some(index => index.name === this.indexName);
      
      if (!indexExists) {
        throw new Error(`Indice ${this.indexName} nao encontrado no Pinecone`);
      }

      const openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');
      if (!openaiApiKey) {
        throw new Error('OPENAI_API_KEY nao esta configurada');
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

  async query(userQuestion: string): Promise<QueryResponseDto> {
    try {
      this.logger.log(`Processando pergunta: ${userQuestion}`);

      const embedding = await this.generateEmbedding(userQuestion);
      const index = this.pinecone.index(this.indexName);

      const queryResponse = await index.query({
        vector: embedding,
        topK: 3,
        includeMetadata: true,
      });

      const matches: QueryMatch[] = queryResponse.matches
        .filter(match => match.metadata) // Garantir que metadata existe
        .map(match => ({
          id: match.id,
          score: match.score || 0,
          metadata: this.validateMetadata(match.metadata),
        }));

      this.logger.log(`Encontrados ${matches.length} resultados relevantes`);

      return new QueryResponseDto(matches, userQuestion);

    } catch (error) {
      this.logger.error('Erro ao consultar base de conhecimento:', error);
      throw error;
    }
  }

  private validateMetadata(metadata: any): KnowledgeMetadata {
    // Validar e garantir que o metadata tem a estrutura esperada
    return {
      question: metadata?.question || '',
      source: metadata?.source || '',
      summary: metadata?.summary || '',
      tags: Array.isArray(metadata?.tags) ? metadata.tags : [],
      text: metadata?.text || '',
    };
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text,
        encoding_format: 'float',
      });

      const embedding = response.data[0].embedding;
      
      if (embedding.length !== 1536) {
        throw new Error(`Embedding com dimensoes incorretas: ${embedding.length} (esperado: 1536)`);
      }

      return embedding;
    } catch (error) {
      this.logger.error('Erro ao gerar embedding:', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const index = this.pinecone.index(this.indexName);
      const stats = await index.describeIndexStats();
      
      this.logger.log('Estatisticas do indice:', {
        dimension: stats.dimension,
        totalVectorCount: stats.totalRecordCount,
        namespaces: stats.namespaces,
      });

      return true;
    } catch (error) {
      this.logger.error('Erro ao testar conexao:', error);
      return false;
    }
  }
}
'@

# Salvar o arquivo corrigido
$serviceContent | Out-File -FilePath "src\modules\knowledge-base\knowledge-base.service.ts" -Encoding UTF8

Write-Host "✅ Service atualizado com validacao robusta!" -ForegroundColor Green
Write-Host "🛡️ Agora o metadata sera validado antes de usar" -ForegroundColor Yellow
Write-Host "🚀 Execute: pnpm dev" -ForegroundColor Cyan