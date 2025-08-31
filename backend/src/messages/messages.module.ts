import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { LangchainModule } from '../langchain/langchain.module';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [LangchainModule, WebSocketModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {} 