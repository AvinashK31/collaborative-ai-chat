import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';

@Injectable()
export class ConversationsService {
  constructor(private prisma: PrismaService, private eventEmitter: EventEmitter2) {}

  async createConversation(userId: string, createConversationDto: CreateConversationDto) {
    const conversation = await this.prisma.conversation.create({
      data: {
        title: createConversationDto.title || 'New Conversation',
        participants: {
          create: {
            userId: userId,
          },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return conversation;
  }

  async getUserConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            userId: userId,
          },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return conversations;
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

  async getConversationById(conversationId: string, userId: string) {
    // First check if user is part of this conversation
    const isUserInConversation = await this.isUserInConversation(userId, conversationId);
    
    if (!isUserInConversation) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  async updateConversation(conversationId: string, userId: string, updateConversationDto: UpdateConversationDto) {
    // Check if user has access to this conversation
    const isUserInConversation = await this.isUserInConversation(userId, conversationId);
    if (!isUserInConversation) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    const updatedConversation = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { title: updateConversationDto.title },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Emit event for real-time updates
    this.eventEmitter.emit('conversation.title-updated', {
      conversationId,
      conversation: updatedConversation,
    });

    return updatedConversation;
  }

  async deleteConversation(conversationId: string, userId: string) {
    // Check if user has access to this conversation
    const isUserInConversation = await this.isUserInConversation(userId, conversationId);
    if (!isUserInConversation) {
      throw new ForbiddenException('You do not have access to this conversation');
    }

    // Get conversation details before deletion for event emission
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Delete the conversation (CASCADE will handle related data)
    await this.prisma.conversation.delete({
      where: { id: conversationId },
    });

    // Clean up any orphaned invitations for this conversation
    await this.prisma.invitation.updateMany({
      where: {
        conversationId,
        status: 'PENDING',
      },
      data: {
        status: 'EXPIRED',
      },
    });

    // Emit event for real-time updates
    this.eventEmitter.emit('conversation.deleted', {
      conversationId,
      conversation,
    });

    return { success: true };
  }
} 