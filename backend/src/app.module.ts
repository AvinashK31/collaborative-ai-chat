import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
// Import configuration and validation
import configuration from './config/configuration';
import { validationSchema } from './config/validation';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { ChatModule } from './chat/chat.module';
import { LangchainModule } from './langchain/langchain.module';
import { InvitationsModule } from './invitations/invitations.module';
import { WebSocketModule } from './websocket/websocket.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: true,
      },
    }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    ConversationsModule,
    MessagesModule,
    ChatModule,
    LangchainModule,
    InvitationsModule,
    WebSocketModule,
  ],
})
export class AppModule {} 