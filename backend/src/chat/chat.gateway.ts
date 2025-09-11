import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MessagesService } from '../messages/messages.service';
import { LangchainService } from '../langchain/langchain.service';
import { WebSocketService } from '../websocket/websocket.service';

// Derive allowed WebSocket origins with sensible defaults and support for CORS_ORIGIN
const WS_ALLOWED_ORIGINS = [
  process.env.CORS_ORIGIN,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:4040',
  'http://127.0.0.1:4040',
].filter(Boolean) as string[];

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

interface UserActivity {
  userId: string;
  lastActivity: Date;
  status: 'online' | 'away' | 'offline';
  socketIds: Set<string>;
}

@WebSocketGateway({
  cors: {
    origin: WS_ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, string>(); // socketId -> userId
  private userActivities = new Map<string, UserActivity>(); // userId -> UserActivity
  private userConversations = new Map<string, Set<string>>(); // userId -> Set of conversationIds
  private activityCheckInterval: NodeJS.Timeout;

  constructor(
    private messagesService: MessagesService,
    private langchainService: LangchainService,
    private jwtService: JwtService,
    private eventEmitter: EventEmitter2,
    private webSocketService: WebSocketService,
  ) {}

  /**
   * Compute the set of socket IDs that should receive AI events.
   * - Single-user conversations: include all sockets (same user across tabs)
   * - Multi-user conversations: include all sockets only when the conversation's
   *   AI is enabled; otherwise, none.
   */
  private async getAiRecipientSocketIds(conversationId: string): Promise<Set<string>> {
    const roomSockets = await this.server.in(conversationId).allSockets();
    const recipients = new Set<string>();
    try {
      const participantCount = await this.messagesService.getParticipantCount(conversationId);
      if (participantCount <= 1) {
        roomSockets.forEach((id) => recipients.add(id));
        return recipients;
      }
      const aiOn = await this.messagesService.getConversationAiEnabled(conversationId);
      if (!aiOn) return recipients; // empty set when AI disabled
      roomSockets.forEach((id) => recipients.add(id));
    } catch (e) {
      console.error('getAiRecipientSocketIds error:', e);
      roomSockets.forEach((id) => recipients.add(id));
    }
    return recipients;
  }

  onModuleInit() {
    // Start activity checking timer - check every minute
    this.activityCheckInterval = setInterval(() => {
      this.checkUserActivity();
    }, 60000); // Check every 60 seconds
    
    // Set the server in WebSocketService after a short delay to ensure server is initialized
    setTimeout(() => {
      this.webSocketService.setServer(this.server);
      console.log(' WebSocketService server initialized');
    }, 1000);
  }

  onModuleDestroy() {
    if (this.activityCheckInterval) {
      clearInterval(this.activityCheckInterval);
    }
  }

  private checkUserActivity() {
    const now = new Date();
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000); // 2 minutes ago
    
    for (const [userId, activity] of this.userActivities.entries()) {
      const oldStatus = activity.status;
      
      if (activity.lastActivity < twoMinutesAgo && activity.status === 'online') {
        // User is inactive for more than 2 minutes, mark as away
        activity.status = 'away';
        console.log(`User ${userId} marked as away due to inactivity`);
        this.broadcastUserStatusWithState(userId, 'away');
      }
    }
  }

  private updateUserActivity(userId: string) {
    const activity = this.userActivities.get(userId);
    if (activity) {
      const oldStatus = activity.status;
      activity.lastActivity = new Date();
      
      // If user was away, bring them back online
      if (oldStatus === 'away') {
        activity.status = 'online';
        console.log(`User ${userId} back online from away status`);
        this.broadcastUserStatusWithState(userId, 'online');
      }
    }
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      console.log('🔄 New WebSocket connection attempt...')
      console.log('Client ID:', client.id)
      console.log('Handshake auth:', client.handshake.auth)
      console.log('Handshake headers auth:', client.handshake.headers.authorization)
      
      // Extract token from handshake
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];
      
      console.log('Extracted token:', token ? 'Present (' + token.substring(0, 20) + '...)' : 'Missing')
      
      if (!token) {
        console.log('❌ No token provided, disconnecting client:', client.id)
        client.disconnect();
        return;
      }

      // Verify JWT token and get user info
      try {
        console.log('🔍 Verifying JWT token...')
        const payload = this.jwtService.verify(token);
        console.log('✅ JWT verified, payload:', { userId: payload.userId, email: payload.email })
        
        const user = {
          id: payload.userId,
          email: payload.email,
          name: payload.name || payload.email,
        };
        
        client.user = user;
        this.connectedUsers.set(client.id, user.id);
        
        // Track user sockets
        if (!this.userActivities.has(user.id)) {
          this.userActivities.set(user.id, {
            userId: user.id,
            lastActivity: new Date(),
            status: 'online',
            socketIds: new Set(),
          });
        } else {
          // User reconnecting, update their status to online
          const activity = this.userActivities.get(user.id);
          activity.status = 'online';
          activity.lastActivity = new Date();
        }
        this.userActivities.get(user.id).socketIds.add(client.id);
        
        console.log(`✅ User ${user.email} connected with socket ${client.id}, userId: ${user.id}`);
        
        // Auto-join user to all their conversations for global notifications
        try {
          const userConversations = await this.messagesService.getUserConversations(user.id);
          userConversations.forEach(conversation => {
            client.join(conversation.id);
            console.log(`🏠 Auto-joined user ${user.email} to conversation ${conversation.id}`);
          });
          
          // Track user conversations
          if (!this.userConversations.has(user.id)) {
            this.userConversations.set(user.id, new Set());
          }
          userConversations.forEach(conversation => {
            this.userConversations.get(user.id).add(conversation.id);
          });
        } catch (error) {
          console.error('Error auto-joining conversations:', error);
        }
        
        // Broadcast user online status to all their conversations after a short delay
        // to ensure they've joined their conversation rooms
        setTimeout(() => {
          this.broadcastUserStatusWithState(user.id, 'online');
        }, 1000);
      } catch (tokenError) {
        console.log('❌ Invalid token, disconnecting client:', client.id)
        console.error('Token error:', tokenError.message);
        client.disconnect();
        return;
      }

    } catch (error) {
      console.error('❌ Connection error:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = this.connectedUsers.get(client.id);
    if (userId) {
      this.connectedUsers.delete(client.id);
      
      // Remove socket from user's socket set
      const userActivity = this.userActivities.get(userId);
      if (userActivity) {
        userActivity.socketIds.delete(client.id);
        
        // If user has no more sockets, they're offline
        if (userActivity.socketIds.size === 0) {
          userActivity.status = 'offline';
          this.broadcastUserStatusWithState(userId, 'offline');
          // Clean up after broadcasting
          this.userActivities.delete(userId);
          console.log(`User ${userId} went offline`);
        }
      }
      
      console.log(`User ${userId} disconnected`);
    }
  }

  @SubscribeMessage('join-conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.user) {
      console.log('No user found in client, disconnecting');
      return;
    }

    try {
      console.log(`User ${client.user.email} attempting to join conversation ${data.conversationId}`);
      
      // Check if user is a participant in this conversation
      const isParticipant = await this.messagesService.isUserInConversation(client.user.id, data.conversationId);
      if (!isParticipant) {
        console.log(`User ${client.user.email} is not a participant in conversation ${data.conversationId}`);
        client.emit('error', { message: 'Not authorized to join this conversation' });
        return;
      }

      // Join the conversation room
      await client.join(data.conversationId);
      console.log(`User ${client.user.email} successfully joined room ${data.conversationId}`);
      
      // Track user's conversation membership
      if (!this.userConversations.has(client.user.id)) {
        this.userConversations.set(client.user.id, new Set());
      }
      this.userConversations.get(client.user.id)!.add(data.conversationId);

      // Load and send conversation messages
      const messages = await this.messagesService.getConversationMessages(data.conversationId);
      console.log(`Sending ${messages.length} messages to user ${client.user.email}`);
      client.emit('conversation-messages', { messages });

      // Send online users status
      const onlineUsers = this.getOnlineUsersInConversation(data.conversationId);
      client.emit('users-status', { conversationId: data.conversationId, onlineUsers });

      // Send detailed user status
      const usersStatus = await this.getUsersStatusInConversationFromDB(data.conversationId);
      client.emit('users-status-detailed', { conversationId: data.conversationId, usersStatus });
      
      // Mark conversation as read when user joins
      await this.messagesService.updateUserReadStatus(client.user.id, data.conversationId);
      
      // Update user activity since they joined a conversation
      this.updateUserActivity(client.user.id);

      // Confirm to the user that they successfully joined
      client.emit('user-joined-conversation', { conversationId: data.conversationId });

      // Send room AI status for the conversation
      try {
        const participantCount = await this.messagesService.getParticipantCount(data.conversationId);
        const aiEnabled = participantCount <= 1 ? true : await this.messagesService.getConversationAiEnabled(data.conversationId);
        client.emit('conversation-ai', { conversationId: data.conversationId, aiEnabled, participantCount });
      } catch (prefErr) {
        console.error('Failed to load AI preference on join:', prefErr);
        client.emit('conversation-ai', { conversationId: data.conversationId, aiEnabled: true });
      }
      
      // Notify other participants that user joined and broadcast current user's status
      console.log(`Broadcasting user-joined event for ${client.user.email} to room ${data.conversationId}`);
      client.to(data.conversationId).emit('user-joined', {
        conversationId: data.conversationId,
        user: {
          id: client.user.id,
          name: client.user.name,
          email: client.user.email,
        },
        joinedAt: new Date().toISOString(),
      });

      // Also broadcast this user's current status to others in the conversation
      this.broadcastUserStatusWithState(client.user.id, 'online');
      
      console.log(`User ${client.user.email} joined conversation ${data.conversationId}`);
    } catch (error) {
      console.error('Error joining conversation:', error);
      client.emit('error', { message: 'Failed to join conversation' });
    }
  }

  @SubscribeMessage('send-message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; content: string; messageId: string },
  ) {
    if (!client.user) return;

    try {
      console.log(`User ${client.user.email} sending message to conversation ${data.conversationId}`);
      
      // Update user activity
      this.updateUserActivity(client.user.id);
      
      // This is for broadcasting user messages to other participants only
      // AI responses are now handled by the streaming API endpoint
      
      const messageToSend = {
        id: data.messageId,
        content: data.content,
        type: 'USER',
        userId: client.user.id,
        conversationId: data.conversationId, // Add conversationId for frontend handling
        user: {
          id: client.user.id,
          name: client.user.name,
          email: client.user.email,
        },
        createdAt: new Date().toISOString(),
      };

      console.log(`Broadcasting message to room ${data.conversationId}:`, messageToSend);
      
      // Broadcast user message to other participants (not sender)
      client.to(data.conversationId).emit('new-message', messageToSend);

    } catch (error) {
      console.error('Error broadcasting message:', error);
      client.emit('error', { message: 'Failed to broadcast message' });
    }
  }

  @SubscribeMessage('send-message-with-ai')
  async handleSendMessageWithAI(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; content: string; messageId: string },
  ) {
    if (!client.user) {
      console.log('❌ No user found in client for send-message-with-ai');
      return;
    }

    try {
      console.log(`🤖 User ${client.user.email} sending message with AI to conversation ${data.conversationId}`);
      console.log(`🤖 Message data:`, JSON.stringify(data, null, 2));
      
      // Update user activity
      this.updateUserActivity(client.user.id);
      
      // Verify membership
      const allowed = await this.messagesService.isUserInConversation(client.user.id, data.conversationId);
      if (!allowed) {
        client.emit('error', { message: 'Unauthorized to send messages to this conversation' });
        return;
      }

      // Persist the user message
      const senderAiPref = await this.messagesService.getUserAiPreference(client.user.id, data.conversationId);
      const userMessage = await this.messagesService.createMessage({
        content: data.content,
        type: 'USER',
        userId: client.user.id,
        conversationId: data.conversationId,
        metadata: {
          origin: 'HUMAN',
          aiEnabledAtSend: senderAiPref,
        },
      });

      // Validate save in 1-2 lines
      if (!userMessage?.id || userMessage.content !== data.content) {
        console.error('message.save.failed', { stage: 'user', conversationId: data.conversationId });
      } else {
        console.log('message.save.ok', { id: userMessage.id, type: userMessage.type });
      }

      // Broadcast user message to all participants (including sender)
      const messageToSend = {
        id: userMessage.id,
        content: userMessage.content,
        type: 'USER',
        userId: client.user.id,
        conversationId: data.conversationId, // Add conversationId for frontend handling
        user: {
          id: client.user.id,
          name: client.user.name,
          email: client.user.email,
        },
        createdAt: userMessage.createdAt.toISOString(),
      };

      console.log(`Broadcasting user message to room ${data.conversationId}:`, messageToSend);
      // Exclude the sender to prevent duplicate (temp + broadcast) messages on their UI
      client.to(data.conversationId).emit('new-message', messageToSend);

      // Room-level AI gating
      const participantCount = await this.messagesService.getParticipantCount(data.conversationId);
      const aiAllowed = participantCount <= 1 ? true : await this.messagesService.getConversationAiEnabled(data.conversationId);
      if (!aiAllowed) {
        console.log(`🤖 AI disabled for conversation ${data.conversationId}; skipping generation`);
        return;
      }

      // Notify AI thinking to recipients
      console.log(`🤖 Broadcasting AI thinking start selectively in conversation ${data.conversationId}`);
      const thinkingRecipients = await this.getAiRecipientSocketIds(data.conversationId);
      for (const sid of thinkingRecipients) this.server.to(sid).emit('ai-thinking', { conversationId: data.conversationId, isThinking: true });

      // Generate AI response and stream to all participants
      try {
        let fullResponse = '';
        const aiMessageId = `ai-${Date.now()}`;
        
        console.log(`🤖 Starting AI streaming for message ${aiMessageId}`);
        
        // Send initial AI message structure to allowed participants
        const initialAiMessage = {
          id: aiMessageId,
          content: '',
          type: 'AI',
          userId: null,
          user: null,
          createdAt: new Date().toISOString(),
          isStreaming: true,
        };
        console.log(`🤖 Broadcasting AI streaming start selectively to conversation ${data.conversationId}:`, initialAiMessage);
        for (const sid of thinkingRecipients) {
          this.server.to(sid).emit('ai-streaming-start', initialAiMessage);
        }

        // Stream AI response tokens to all participants
        console.log(`🤖 Starting token streaming for conversation ${data.conversationId}`);
        for await (const token of this.langchainService.generateStreamingResponse(
          data.conversationId,
          data.content,
        )) {
          fullResponse += token;
          // Re-evaluate recipients so live toggles take effect
          const tokenRecipients = await this.getAiRecipientSocketIds(data.conversationId);
          // Broadcast token to recipients in real-time
          if (token.trim()) console.log(`🤖 Token broadcast to ${tokenRecipients.size} recipients`);
          for (const sid of tokenRecipients) {
            this.server.to(sid).emit('ai-streaming-token', {
              messageId: aiMessageId,
              token,
              fullContent: fullResponse,
            });
          }
        }

        // Persist complete AI message
        const aiMessage = await this.messagesService.createMessage({
          content: fullResponse,
          type: 'AI',
          conversationId: data.conversationId,
          metadata: {
            origin: 'AI',
            triggeredByUserId: client.user.id,
            conversationAiEnabledAtSend: aiAllowed,
          },
        });

        // Validate save in 1-2 lines
        if (!aiMessage?.id) {
          console.error('message.save.failed', { stage: 'ai', conversationId: data.conversationId });
        } else {
          console.log('message.save.ok', { id: aiMessage.id, type: aiMessage.type });
        }

        // Send final AI message to all participants
        const finalAiMessage = {
          id: aiMessage.id,
          content: aiMessage.content,
          type: 'AI',
          userId: null,
          user: null,
          createdAt: aiMessage.createdAt.toISOString(),
          isStreaming: false,
        };

        const finalRecipients = await this.getAiRecipientSocketIds(data.conversationId);
        for (const sid of finalRecipients) {
          this.server.to(sid).emit('ai-streaming-complete', finalAiMessage);
        }

      } catch (error) {
        console.error('AI generation error:', error);
        const errorRecipients = await this.getAiRecipientSocketIds(data.conversationId);
        const payload = { 
          error: 'Failed to generate AI response',
          conversationId: data.conversationId,
        };
        for (const sid of errorRecipients) this.server.to(sid).emit('ai-error', payload);
      } finally {
        // Stop AI thinking indicator
        console.log(`🤖 Broadcasting AI thinking stop selectively to conversation ${data.conversationId}`);
        const stopRecipients = await this.getAiRecipientSocketIds(data.conversationId);
        for (const sid of stopRecipients) {
          this.server.to(sid).emit('ai-thinking', { conversationId: data.conversationId, isThinking: false });
        }
      }

    } catch (error) {
      console.error('Error handling AI message:', error);
      client.emit('error', { message: 'Failed to process message with AI' });
    }
  }

  @SubscribeMessage('leave-conversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    await client.leave(data.conversationId);
    
    // Remove conversation from user's tracked conversations
    if (client.user) {
      const userConversations = this.userConversations.get(client.user.id);
      if (userConversations) {
        userConversations.delete(data.conversationId);
        if (userConversations.size === 0) {
          this.userConversations.delete(client.user.id);
        }
      }
    }
    
    // Notify other participants that user left
      if (client.user) {
      client.to(data.conversationId).emit('user-left', {
        conversationId: data.conversationId,
        user: {
          id: client.user.id,
          name: client.user.name,
          email: client.user.email,
        },
        leftAt: new Date().toISOString(),
      });
    }
    
    console.log(`User ${client.user?.email} left conversation ${data.conversationId}`);
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; isTyping: boolean },
  ) {
    if (!client.user) {
      console.log('❌ No user found in client for typing event');
      return;
    }

    console.log(`⌨️ User ${client.user.email} typing event:`, data);

    // Update user activity when typing
    if (data.isTyping) {
      this.updateUserActivity(client.user.id);
    }

    // Broadcast typing status to other participants
    console.log(`⌨️ Broadcasting typing status to conversation ${data.conversationId}:`, {
      userId: client.user.id,
      userName: client.user.name || client.user.email,
      isTyping: data.isTyping,
      conversationId: data.conversationId,
    });
    
    client.to(data.conversationId).emit('user-typing', {
      userId: client.user.id,
      userName: client.user.name || client.user.email,
      isTyping: data.isTyping,
      conversationId: data.conversationId,
    });
  }

  @SubscribeMessage('editing-message')
  async handleEditingMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; messageId: string; isEditing: boolean },
  ) {
    if (!client.user) return;

    // Update user activity when editing
    if (data.isEditing) {
      this.updateUserActivity(client.user.id);
    }

    console.log(`User ${client.user.email} ${data.isEditing ? 'started' : 'stopped'} editing message ${data.messageId}`);

    // Broadcast editing status to other participants (not the editor)
    client.to(data.conversationId).emit('user-editing-message', {
      messageId: data.messageId,
      userId: client.user.id,
      userName: client.user.name || client.user.email,
      isEditing: data.isEditing,
      conversationId: data.conversationId,
    });
  }

  @SubscribeMessage('editing-conversation-title')
  async handleEditingConversationTitle(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; isEditing: boolean },
  ) {
    if (!client.user) return;

    // Update user activity when editing title
    if (data.isEditing) {
      this.updateUserActivity(client.user.id);
    }

    console.log(`User ${client.user.email} ${data.isEditing ? 'started' : 'stopped'} editing conversation title for ${data.conversationId}`);

    // Broadcast editing status to other participants (not the editor)
    client.to(data.conversationId).emit('user-editing-conversation-title', {
      conversationId: data.conversationId,
      userId: client.user.id,
      userName: client.user.name || client.user.email,
      isEditing: data.isEditing,
    });
  }

  @SubscribeMessage('user-activity')
  async handleUserActivity(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { type: 'active' | 'inactive' | 'visible' | 'hidden' | 'logout' },
  ) {
    if (!client.user) return;

    console.log(`User ${client.user.email} activity: ${data.type}`);

    if (data.type === 'logout') {
      // Handle logout - mark user as offline
      const activity = this.userActivities.get(client.user.id);
      if (activity) {
        activity.status = 'offline';
        this.broadcastUserStatusWithState(client.user.id, 'offline');
      }
    } else if (data.type === 'active' || data.type === 'visible') {
      // Only update activity for meaningful interactions
      this.updateUserActivity(client.user.id);
    }
  }

  // Method to broadcast messages to all participants in a conversation
  broadcastToConversation(conversationId: string, event: string, data: unknown) {
    console.log(`Broadcasting ${event} to conversation ${conversationId}:`, data);
    this.server.to(conversationId).emit(event, data);
  }

  // Event listeners for message broadcasting
  @OnEvent('message.created')
  handleMessageCreated(payload: { conversationId: string; message: Record<string, unknown> }) {
    console.log(`WebSocket: Broadcasting new message to conversation ${payload.conversationId}:`, payload.message.id);
    console.log(`WebSocket: Message type:`, payload.message.type);
    console.log(`WebSocket: Message user:`, payload.message.userId);

    // Add conversationId to the message for frontend handling
      const messageWithConversationId: Record<string, unknown> = {
        ...payload.message,
        conversationId: payload.conversationId,
      };

    // For AI messages, gate delivery by user preference (SSE path)
    if (String(payload.message.type) === 'AI') {
      this.getAiRecipientSocketIds(payload.conversationId)
        .then(recips => {
          for (const sid of recips) {
            this.server.to(sid).emit('new-message', messageWithConversationId);
          }
          console.log(`WebSocket: gated AI message to ${recips.size} sockets for conversation ${payload.conversationId}`);
        })
        .catch(err => {
          console.error('AI gated broadcast failed, falling back to room:', err);
          this.server.to(payload.conversationId).emit('new-message', messageWithConversationId);
        });
      return;
    }

    // Non-AI: broadcast to all clients in the conversation
    const room = this.server.sockets.adapter.rooms.get(payload.conversationId);
    const clientCount = room ? room.size : 0;
    console.log(`WebSocket: Conversation ${payload.conversationId} has ${clientCount} connected clients`);
    this.server.to(payload.conversationId).emit('new-message', messageWithConversationId);
    console.log(`WebSocket: new-message event emitted to conversation ${payload.conversationId}`);
  }

  @OnEvent('ai.thinking')
  async handleAiThinking(payload: { conversationId: string; isThinking: boolean }) {
    console.log(`Broadcasting AI thinking status (gated) to conversation ${payload.conversationId}:`, payload.isThinking);
    try {
      const recips = await this.getAiRecipientSocketIds(payload.conversationId);
      for (const sid of recips) {
        this.server.to(sid).emit('ai-thinking', { conversationId: payload.conversationId, isThinking: payload.isThinking });
      }
    } catch (e) {
      console.error('ai.thinking gated broadcast failed, falling back to room:', e);
      this.server.to(payload.conversationId).emit('ai-thinking', { conversationId: payload.conversationId, isThinking: payload.isThinking });
    }
  }

  @SubscribeMessage('set-conversation-ai')
  async handleSetConversationAi(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; aiEnabled: boolean },
  ) {
    if (!client.user) return;
    try {
      // Enforce: single-user chatrooms always AI on
      const count = await this.messagesService.getParticipantCount(data.conversationId);
      const desired = count <= 1 ? true : !!data.aiEnabled;
      const updated = await this.messagesService.setConversationAiEnabled(data.conversationId, desired);

      if (!updated || updated.aiEnabled !== desired) {
        console.error('ai.conversation.save.failed', { conversationId: data.conversationId });
        client.emit('conversation-ai-error', { conversationId: data.conversationId, error: 'Failed to update AI setting' });
        return;
      }
      console.log('ai.conversation.save.ok', { conversationId: data.conversationId, aiEnabled: updated.aiEnabled });

      // Notify whole room about the change
      this.server.to(data.conversationId).emit('conversation-ai-updated', { conversationId: data.conversationId, aiEnabled: updated.aiEnabled });
    } catch (err) {
      console.error('ai.conversation.error', { err: String(err) });
      client.emit('conversation-ai-error', { conversationId: data.conversationId, error: 'Unable to update setting' });
    }
  }

  @OnEvent('message.updated')
  handleMessageUpdated(payload: { conversationId: string; message: Record<string, unknown> }) {
    console.log(`Broadcasting updated message to conversation ${payload.conversationId}:`, payload.message.id);
    this.server.to(payload.conversationId).emit('message-updated', { message: payload.message });
  }

  @OnEvent('conversation.title-updated')
  handleConversationTitleUpdated(payload: { conversationId: string; conversation: Record<string, unknown> }) {
    console.log(`Broadcasting updated conversation title to conversation ${payload.conversationId}:`, payload.conversation.title);
    this.server.to(payload.conversationId).emit('conversation-title-updated', { conversation: payload.conversation });
  }

  @OnEvent('conversation.deleted')
  handleConversationDeleted(payload: { conversationId: string; conversation: Record<string, unknown> }) {
    console.log(`Broadcasting conversation deletion to conversation ${payload.conversationId}`);
    this.server.to(payload.conversationId).emit('conversation-deleted', { 
      conversationId: payload.conversationId,
      conversation: payload.conversation 
    });
  }

  broadcastUserStatus(userId: string, isOnline: boolean) {
    // Get all conversations this user is part of
    const userConversations = this.userConversations.get(userId) || new Set();
    
    // Broadcast status change to all their conversations
    userConversations.forEach(conversationId => {
      console.log(`Broadcasting user ${userId} status (${isOnline ? 'online' : 'offline'}) to conversation ${conversationId}`);
      this.server.to(conversationId).emit('user-status-changed', {
        userId,
        isOnline,
        status: isOnline ? 'online' : 'offline',
        conversationId
      });
    });
  }

  broadcastUserStatusWithState(userId: string, status: 'online' | 'away' | 'offline') {
    // Get all conversations this user is part of
    const userConversations = this.userConversations.get(userId) || new Set();
    
    console.log(`Broadcasting user ${userId} status (${status}) to ${userConversations.size} conversations`);
    
    // Broadcast status change to all their conversations
    userConversations.forEach(conversationId => {
      console.log(`Broadcasting user ${userId} status (${status}) to conversation ${conversationId}`);
      
      // Get number of clients in the room for debugging
      const room = this.server.sockets.adapter.rooms.get(conversationId);
      const clientCount = room ? room.size : 0;
      console.log(`Conversation ${conversationId} has ${clientCount} connected clients`);
      
      this.server.to(conversationId).emit('user-status-changed', {
        userId,
        isOnline: status !== 'offline',
        status,
        conversationId
      });
    });
    
    // Also broadcast to all sockets for debugging
    console.log(`Total conversations for user ${userId}:`, Array.from(userConversations));
  }

  getOnlineUsersInConversation(conversationId: string): string[] {
    const onlineUsers: string[] = [];
    
    // Check all connected users to see if they're in this conversation
    for (const [userId, conversations] of this.userConversations.entries()) {
      if (conversations.has(conversationId) && this.userActivities.has(userId)) {
        onlineUsers.push(userId);
      }
    }
    
    return onlineUsers;
  }

  getUsersStatusInConversation(conversationId: string): { userId: string, status: 'online' | 'away' | 'offline' }[] {
    const usersStatus: { userId: string, status: 'online' | 'away' | 'offline' }[] = [];
    
    // Check all users in this conversation
    for (const [userId, conversations] of this.userConversations.entries()) {
      if (conversations.has(conversationId)) {
        const activity = this.userActivities.get(userId);
        const status = activity ? activity.status : 'offline';
        usersStatus.push({ userId, status });
      }
    }
    
    return usersStatus;
  }

  async getUsersStatusInConversationFromDB(conversationId: string): Promise<{ userId: string, status: 'online' | 'away' | 'offline' }[]> {
    try {
      // Get all participants in this conversation from database
      const participants = await this.messagesService.getConversationParticipants(conversationId);
      
      return participants.map(participant => {
        const activity = this.userActivities.get(participant.userId);
        const status = activity ? activity.status : 'offline';
        return { userId: participant.userId, status };
      });
    } catch (error) {
      console.error('Error getting conversation participants:', error);
      return [];
    }
  }
} 
