import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { VectorService } from '../langchain/vector.service';

export interface CreateMessageDto {
  content: string;
  type: 'USER' | 'AI' | 'SYSTEM';
  userId?: string;
  conversationId: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private vectorService: VectorService,
  ) {}

  async createMessage(createMessageDto: CreateMessageDto) {
    const message = await this.prisma.message.create({
      data: {
        content: createMessageDto.content,
        type: createMessageDto.type,
        userId: createMessageDto.userId,
        conversationId: createMessageDto.conversationId,
        metadata: createMessageDto.metadata,
      },
      select: {
        id: true,
        content: true,
        type: true,
        userId: true,
        conversationId: true,
        createdAt: true,
        metadata: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
    // Persist embedding for user and AI messages.  System messages are not
    // embedded because they often contain administrative notices.
    if (message.type !== 'SYSTEM') {
      try {
        await this.vectorService.addMessageEmbedding(message.id, message.conversationId, message.content);
      } catch (err) {
        // Log but do not disrupt message creation if embeddings fail
        console.warn('Failed to store message embedding', err);
      }
    }
    return message;
  }

  /**
   * Get whether the given user has AI responses enabled in a conversation.
   * Defaults to true if no record is found.
   */
  async getUserAiPreference(userId: string, conversationId: string): Promise<boolean> {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { userId_conversationId: { userId, conversationId } },
      select: { aiEnabled: true },
    });
    return participant?.aiEnabled ?? true;
  }

  /**
   * Set whether a user wants to receive AI responses in a conversation.
   */
  async setUserAiPreference(userId: string, conversationId: string, enabled: boolean) {
    return this.prisma.conversationParticipant.update({
      where: { userId_conversationId: { userId, conversationId } },
      data: { aiEnabled: enabled },
      select: { userId: true, conversationId: true, aiEnabled: true },
    });
  }

  /**
   * Return the user IDs in a conversation who currently have AI enabled.
   */
  async getAiEnabledUserIds(conversationId: string): Promise<string[]> {
    const rows = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, aiEnabled: true },
      select: { userId: true },
    });
    return rows.map(r => r.userId);
  }

  /** Count the current number of participants in a conversation. */
  async getParticipantCount(conversationId: string): Promise<number> {
    return this.prisma.conversationParticipant.count({ where: { conversationId } });
  }

  async getConversationMessages(conversationId: string, limit: number = 50) {
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return messages;
  }

  async isUserInConversation(userId: string, conversationId: string): Promise<boolean> {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        userId_conversationId: {
          userId,
          conversationId,
        },
      },
    });

    return !!participant;
  }

  async getConversationParticipants(conversationId: string) {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return participants.map(p => ({ userId: p.userId, user: p.user }));
  }

  async getUserConversations(userId: string) {
    const participations = await this.prisma.conversationParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
          select: {
            id: true,
            title: true,
            aiEnabled: true,
          },
        },
      },
    });

    return participations.map(p => p.conversation);
  }

  async updateMessage(messageId: string, userId: string, content: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.userId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    if (message.type !== 'USER') {
      throw new ForbiddenException('You can only edit user messages');
    }

    const updatedMessage = await this.prisma.message.update({
      where: { id: messageId },
      data: { content },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    // Emit event for real-time updates
    this.eventEmitter.emit('message.updated', {
      conversationId: updatedMessage.conversationId,
      message: updatedMessage,
    });

    return updatedMessage;
  }

  async updateUserReadStatus(userId: string, conversationId: string) {
    try {
      // Defensive checks: ensure conversation exists and user is a participant
      if (!conversationId || !userId) return;
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { id: true },
      });
      if (!conversation) {
        console.warn(`Read status skipped: conversation ${conversationId} not found`);
        return;
      }
      const participant = await this.prisma.conversationParticipant.findUnique({
        where: { userId_conversationId: { userId, conversationId } },
        select: { id: true },
      });
      if (!participant) {
        console.warn(`Read status skipped: user ${userId} not in conversation ${conversationId}`);
        return;
      }

      // Update or create the read status record
      await this.prisma.userReadStatus.upsert({
        where: {
          userId_conversationId: {
            userId,
            conversationId,
          },
        },
        create: {
          userId,
          conversationId,
          lastReadAt: new Date(),
        },
        update: {
          lastReadAt: new Date(),
        },
      });
    } catch (error: unknown) {
      // Handle unique constraint errors gracefully (race conditions)
      const e = error as { code?: string };
      if (e?.code === 'P2002') {
        console.log(`Read status already exists for user ${userId} in conversation ${conversationId}, trying update only`);
        try {
          await this.prisma.userReadStatus.updateMany({
            where: { userId, conversationId },
            data: { lastReadAt: new Date() },
          });
        } catch (updateError) {
          console.error('Failed to update read status:', updateError);
        }
      } else if (e?.code === 'P2003') {
        // Foreign key violation: conversation or user missing. Log and skip.
        console.warn(`Read status skipped due to FK constraint for user ${userId} / conversation ${conversationId}`);
      } else {
        console.error('Unexpected error updating read status:', error);
      }
    }
  }

  async getUnreadCounts(userId: string): Promise<{ [conversationId: string]: number }> {
    // Get all conversations the user is part of
    const participations = await this.prisma.conversationParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
          select: { id: true }
        }
      },
    });

    const unreadCounts: { [conversationId: string]: number } = {};

    for (const participation of participations) {
      const conversationId = participation.conversation.id;
      
      // Get the user's last read timestamp for this conversation
      const readStatus = await this.prisma.userReadStatus.findUnique({
        where: {
          userId_conversationId: {
            userId,
            conversationId,
          },
        },
      });

      // If no read status exists, count all messages since they joined
      const cutoffTime = readStatus?.lastReadAt || participation.joinedAt;

      // Count messages after the cutoff time (excluding user's own USER messages)
      const unreadCount = await this.prisma.message.count({
        where: {
          conversationId,
          createdAt: {
            gt: cutoffTime,
          },
          OR: [
            // Include AI messages
            { type: 'AI' },
            // Include messages from other users
            {
              type: 'USER',
              userId: {
                not: userId,
              },
            },
          ],
        },
      });

      unreadCounts[conversationId] = unreadCount;
    }

    return unreadCounts;
  }

  async getUnreadCountForConversation(userId: string, conversationId: string): Promise<number> {
    // Check if user is part of this conversation
    const participation = await this.prisma.conversationParticipant.findUnique({
      where: {
        userId_conversationId: {
          userId,
          conversationId,
        },
      },
    });

    if (!participation) {
      return 0;
    }

    // Get the user's last read timestamp for this conversation
    const readStatus = await this.prisma.userReadStatus.findUnique({
      where: {
        userId_conversationId: {
          userId,
          conversationId,
        },
      },
    });

    // If no read status exists, count all messages since they joined
    const cutoffTime = readStatus?.lastReadAt || participation.joinedAt;

    // Count messages after the cutoff time (excluding user's own USER messages)
    const unreadCount = await this.prisma.message.count({
      where: {
        conversationId,
        createdAt: {
          gt: cutoffTime,
        },
        OR: [
          // Include AI messages
          { type: 'AI' },
          // Include messages from other users
          {
            type: 'USER',
            userId: {
              not: userId,
            },
          },
        ],
      },
    });

    return unreadCount;
  }

  async getConversationAiEnabled(conversationId: string): Promise<boolean> {
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { aiEnabled: true } });
    return conv?.aiEnabled ?? true;
  }

  async setConversationAiEnabled(conversationId: string, enabled: boolean) {
    return this.prisma.conversation.update({ where: { id: conversationId }, data: { aiEnabled: enabled }, select: { id: true, aiEnabled: true } });
  }
}
