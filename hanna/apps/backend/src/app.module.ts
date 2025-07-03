import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KnowledgeBaseModule } from './modules/knowledge-base/knowledge-base.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { OpenAIModule } from './modules/openai/openai.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    KnowledgeBaseModule,
    OpenAIModule,
    WebsocketModule,
  ],
})
export class AppModule {}