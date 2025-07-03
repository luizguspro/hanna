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
