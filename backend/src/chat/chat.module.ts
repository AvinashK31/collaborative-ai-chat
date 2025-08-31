import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway';
import { MessagesModule } from '../messages/messages.module';
import { LangchainModule } from '../langchain/langchain.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    MessagesModule,
    LangchainModule,
    WebSocketModule,
    // Import ConfigModule to make ConfigService available here
    ConfigModule,
    // Register JwtModule asynchronously to read config values
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: configService.get<string>('jwt.expiresIn') || '7d',
        },
      }),
    }),
  ],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class ChatModule {}