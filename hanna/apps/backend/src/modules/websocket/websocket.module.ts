import { Module } from '@nestjs/common';
import { HannaGateway } from './hanna.gateway';
import { SessionService } from './session.service';
import { AudioBufferService } from './audio-buffer.service';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { OpenAIModule } from '../openai/openai.module';

@Module({
  imports: [
    KnowledgeBaseModule,
    OpenAIModule,
  ],
  providers: [
    HannaGateway,
    SessionService,
    AudioBufferService,
  ],
})
export class WebsocketModule {}