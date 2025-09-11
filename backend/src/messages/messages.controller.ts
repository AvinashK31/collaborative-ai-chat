import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
  Res,
  Patch,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';
import { Response } from 'express';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MessagesService } from './messages.service';
import { LangchainService } from '../langchain/langchain.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { WebSocketService } from '../websocket/websocket.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('messages')
@ApiBearerAuth('JWT-auth')
@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(
    private messagesService: MessagesService,
    private langchainService: LangchainService,
    private eventEmitter: EventEmitter2,
    private webSocketService: WebSocketService,
    private configService: ConfigService,
  ) {}

  @Get('conversation/:conversationId')
  @ApiOperation({ summary: 'Get messages for a conversation', description: 'Returns the list of messages for a conversation if the user is a participant' })
  @ApiParam({ name: 'conversationId', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'List of messages returned' })
  @ApiResponse({ status: 403, description: 'Forbidden: user is not a participant of this conversation' })
  async getConversationMessages(@Request() req, @Param('conversationId') conversationId: string) {
    const allowed = await this.messagesService.isUserInConversation(req.user.id, conversationId);
    if (!allowed) {
      throw new ForbiddenException('Unauthorized to access this conversation');
    }
    return this.messagesService.getConversationMessages(conversationId);
  }

  @Post('send-with-ai')
  @ApiOperation({ summary: 'Send a user message and generate AI response (streaming)', description: 'Sends a message on behalf of the user and streams back an AI-generated response via server-sent events' })
  @ApiBody({ type: CreateMessageDto })
  @ApiResponse({ status: 201, description: 'Message sent and AI response streaming started' })
  @ApiResponse({ status: 403, description: 'Forbidden: user is not a participant of this conversation' })
  async sendMessageWithAI(
    @Request() req,
    @Body() createMessageDto: CreateMessageDto,
    @Res() res: Response,
  ) {
    // Verify membership
    const allowed = await this.messagesService.isUserInConversation(req.user.id, createMessageDto.conversationId);
    if (!allowed) {
      throw new ForbiddenException('Unauthorized to send messages to this conversation');
    }
    // Configure server‑sent event headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // Align with CORS configuration while remaining permissive for SSE
    const corsOrigin = this.configService.get<string>('CORS_ORIGIN') || '*';
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Cache-Control, Content-Type');
    // Persist the user message
    const userMessage = await this.messagesService.createMessage({
      ...createMessageDto,
      userId: req.user.id,
      type: 'USER',
    });
    
    console.log('📨 User message created:', userMessage.id, 'for conversation:', createMessageDto.conversationId);
    console.log('📨 Original userMessage object:', JSON.stringify(userMessage, null, 2));
    console.log('📨 Broadcasting user message directly via WebSocket');
    console.log('📨 WebSocketService available:', !!this.webSocketService);
    
    // Broadcast user message directly via WebSocket to ALL participants (including sender's other tabs)
    const messageWithConversationId = {
      ...userMessage,
      conversationId: createMessageDto.conversationId
    };
    
    console.log('📨 Message with conversationId added:', JSON.stringify(messageWithConversationId, null, 2));
    console.log('📨 Broadcasting to conversation ID:', createMessageDto.conversationId);
    this.webSocketService.broadcastToConversation(createMessageDto.conversationId, 'new-message', messageWithConversationId);
    
    console.log('📨 WebSocket new-message event emitted via WebSocketService');
    
    // Send user message to original sender via SSE
    res.write(`data: ${JSON.stringify({ type: 'user_message', message: userMessage })}\n\n`);
    // Notify AI thinking
    res.write(`data: ${JSON.stringify({ type: 'ai_start', message: 'AI is thinking...' })}\n\n`);
    this.eventEmitter.emit('ai.thinking', {
      conversationId: createMessageDto.conversationId,
      isThinking: true,
    });
    try {
      let full = '';
      for await (const token of this.langchainService.generateStreamingResponse(
        createMessageDto.conversationId,
        createMessageDto.content,
      )) {
        full += token;
        res.write(`data: ${JSON.stringify({ type: 'ai_token', token })}\n\n`);
      }
      // Persist AI message
      const aiMessage = await this.messagesService.createMessage({
        content: full,
        type: 'AI',
        conversationId: createMessageDto.conversationId,
      });
      this.eventEmitter.emit('message.created', {
        conversationId: createMessageDto.conversationId,
        message: aiMessage,
      });
      res.write(`data: ${JSON.stringify({ type: 'ai_response', message: aiMessage })}\n\n`);
    } catch (err) {
      console.error('AI generation error:', err);
      res.write(`data: ${JSON.stringify({ type: 'ai_error', error: 'Failed to generate AI response' })}\n\n`);
    } finally {
      this.eventEmitter.emit('ai.thinking', {
        conversationId: createMessageDto.conversationId,
        isThinking: false,
      });
      res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
      res.end();
    }
  }

  @Get('unread-counts')
  @ApiOperation({ summary: 'Get unread message counts', description: 'Returns a mapping of conversation IDs to the number of unread messages for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Unread counts returned' })
  async getUnreadCounts(@Request() req) {
    return this.messagesService.getUnreadCounts(req.user.id);
  }

  @Post('mark-read/:conversationId')
  @ApiOperation({ summary: 'Mark conversation as read', description: 'Marks all messages in the given conversation as read for the authenticated user' })
  @ApiParam({ name: 'conversationId', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'Conversation marked as read' })
  async markConversationAsRead(@Request() req, @Param('conversationId') conversationId: string) {
    await this.messagesService.updateUserReadStatus(req.user.id, conversationId);
    return { success: true };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update message', description: 'Updates the content of a user message if the authenticated user authored it' })
  @ApiParam({ name: 'id', description: 'Message ID' })
  @ApiBody({ type: UpdateMessageDto })
  @ApiResponse({ status: 200, description: 'Message updated successfully' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({ status: 403, description: 'Forbidden: cannot edit this message' })
  async updateMessage(
    @Request() req,
    @Param('id') messageId: string,
    @Body() updateMessageDto: UpdateMessageDto,
  ) {
    return this.messagesService.updateMessage(messageId, req.user.id, updateMessageDto.content);
  }
} 
