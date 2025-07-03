# Script para criar todos os arquivos necessários
# Execute este script no PowerShell na pasta apps\backend

# Criar estrutura de pastas
New-Item -ItemType Directory -Force -Path "src\modules"
New-Item -ItemType Directory -Force -Path "src\modules\knowledge-base"
New-Item -ItemType Directory -Force -Path "src\modules\knowledge-base\dto"

# Criar query-response.dto.ts
$dtoContent = @'
export interface KnowledgeMetadata {
  question: string;
  source: string;
  summary: string;
  tags: string[];
  text: string;
}

export interface QueryMatch {
  id: string;
  score: number;
  metadata: KnowledgeMetadata;
}

export class QueryResponseDto {
  matches: QueryMatch[];
  userQuestion: string;
  timestamp: Date;

  constructor(matches: QueryMatch[], userQuestion: string) {
    this.matches = matches;
    this.userQuestion = userQuestion;
    this.timestamp = new Date();
  }
}
'@
$dtoContent | Out-File -FilePath "src\modules\knowledge-base\dto\query-response.dto.ts" -Encoding UTF8

# Criar knowledge-base.module.ts
$moduleContent = @'
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KnowledgeBaseService } from './knowledge-base.service';
import { KnowledgeBaseController } from './knowledge-base.controller';

@Module({
  imports: [ConfigModule],
  controllers: [KnowledgeBaseController],
  providers: [KnowledgeBaseService],
  exports: [KnowledgeBaseService],
})
export class KnowledgeBaseModule {}
'@
$moduleContent | Out-File -FilePath "src\modules\knowledge-base\knowledge-base.module.ts" -Encoding UTF8

# Criar knowledge-base.controller.ts
$controllerContent = @'
import { Controller, Post, Body, Get } from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';
import { QueryResponseDto } from './dto/query-response.dto';

@Controller('knowledge-base')
export class KnowledgeBaseController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @Post('query')
  async query(@Body('question') question: string): Promise<QueryResponseDto> {
    return this.knowledgeBaseService.query(question);
  }

  @Get('test-connection')
  async testConnection(): Promise<{ connected: boolean }> {
    const connected = await this.knowledgeBaseService.testConnection();
    return { connected };
  }
}
'@
$controllerContent | Out-File -FilePath "src\modules\knowledge-base\knowledge-base.controller.ts" -Encoding UTF8

Write-Host "Arquivos basicos criados! Criando o service..." -ForegroundColor Green

# O service é muito grande, vamos salvá-lo em partes
$serviceStart = @'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import { QueryResponseDto, QueryMatch, KnowledgeMetadata } from './dto/query-response.dto';
'@

$serviceClass = @'

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
'@

$serviceInitMethod = @'

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
'@

$serviceQueryMethod = @'

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

      const matches: QueryMatch[] = queryResponse.matches.map(match => ({
        id: match.id,
        score: match.score || 0,
        metadata: match.metadata as KnowledgeMetadata,
      }));

      this.logger.log(`Encontrados ${matches.length} resultados relevantes`);

      return new QueryResponseDto(matches, userQuestion);

    } catch (error) {
      this.logger.error('Erro ao consultar base de conhecimento:', error);
      throw error;
    }
  }
'@

$serviceEmbeddingMethod = @'

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
'@

$serviceTestMethod = @'

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

# Combinar todas as partes do service
$fullService = $serviceStart + $serviceClass + $serviceInitMethod + $serviceQueryMethod + $serviceEmbeddingMethod + $serviceTestMethod
$fullService | Out-File -FilePath "src\modules\knowledge-base\knowledge-base.service.ts" -Encoding UTF8

Write-Host "SUCESSO! Todos os arquivos foram criados!" -ForegroundColor Green
Write-Host "Estrutura criada em: src\modules\knowledge-base\" -ForegroundColor Yellow
Write-Host "Agora execute: pnpm dev" -ForegroundColor Cyan