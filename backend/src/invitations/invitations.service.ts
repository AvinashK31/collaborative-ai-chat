import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';

@Injectable()
export class InvitationsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async createInvitation(senderId: string, createInvitationDto: CreateInvitationDto) {
    const { email, conversationId } = createInvitationDto;

    // Check if sender is participant in conversation
    const isParticipant = await this.prisma.conversationParticipant.findUnique({
      where: {
        userId_conversationId: {
          userId: senderId,
          conversationId,
        },
      },
    });

    if (!isParticipant) {
      throw new ConflictException('You are not a participant in this conversation');
    }

    // Get conversation and sender details
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, title: true },
    });

    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      select: { id: true, name: true, email: true },
    });

    if (!conversation || !sender) {
      throw new NotFoundException('Conversation or sender not found');
    }

    // Find receiver by email
    const receiver = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!receiver) {
      throw new NotFoundException('User with this email not found');
    }

    // Check if user is already a participant
    const existingParticipant = await this.prisma.conversationParticipant.findUnique({
      where: {
        userId_conversationId: {
          userId: receiver.id,
          conversationId,
        },
      },
    });

    if (existingParticipant) {
      throw new ConflictException('User is already a participant in this conversation');
    }

    // Check if invitation already exists and is still pending
    const existingInvitation = await this.prisma.invitation.findFirst({
      where: {
        email,
        conversationId,
        status: 'PENDING',
      },
    });

    if (existingInvitation) {
      throw new ConflictException('Invitation already sent to this user');
    }

    // Clean up any old invitations for this user and conversation
    await this.prisma.invitation.updateMany({
      where: {
        email,
        conversationId,
        status: { in: ['ACCEPTED', 'DECLINED', 'EXPIRED'] },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    const invitation = await this.prisma.invitation.create({
      data: {
        email,
        senderId,
        receiverId: receiver.id,
        conversationId,
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        receiver: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        conversation: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Send invitation email
    try {
      await this.emailService.sendInvitationEmail(
        email,
        sender.name || sender.email,
        conversation.title || 'Untitled Conversation',
        invitation.id,
      );
    } catch (error) {
      console.error('Failed to send invitation email:', error);
      // Continue even if email fails - the invitation is still created
    }

    return invitation;
  }

  async getUserInvitations(userId: string) {
    const invitations = await this.prisma.invitation.findMany({
      where: {
        receiverId: userId,
        status: 'PENDING',
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        conversation: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invitations;
  }

  async acceptInvitation(invitationId: string, userId: string) {
    // Use a transaction to ensure atomicity
    return await this.prisma.$transaction(async (prisma) => {
      const invitation = await prisma.invitation.findUnique({
        where: { id: invitationId },
      });

      if (!invitation) {
        throw new NotFoundException('Invitation not found');
      }

      if (invitation.receiverId !== userId) {
        throw new ConflictException('You are not authorized to accept this invitation');
      }

      if (invitation.status !== 'PENDING') {
        throw new ConflictException('Invitation is no longer pending');
      }

      // Verify the conversation still exists
      const conversation = await prisma.conversation.findUnique({
        where: { id: invitation.conversationId },
      });

      if (!conversation) {
        throw new NotFoundException('Conversation no longer exists');
      }

      // Check if user is already a participant
      const existingParticipant = await prisma.conversationParticipant.findUnique({
        where: {
          userId_conversationId: {
            userId,
            conversationId: invitation.conversationId,
          },
        },
      });

      if (existingParticipant) {
        // User is already a participant, just update invitation status
        await prisma.invitation.update({
          where: { id: invitationId },
          data: { status: 'ACCEPTED' },
        });
        return { success: true, message: 'Already a participant' };
      }

      // Create new participant record
      await prisma.conversationParticipant.create({
        data: {
          userId,
          conversationId: invitation.conversationId,
        },
      });

      // Update invitation status
      await prisma.invitation.update({
        where: { id: invitationId },
        data: { status: 'ACCEPTED' },
      });

      return { success: true };
    });
  }

  async declineInvitation(invitationId: string, userId: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.receiverId !== userId) {
      throw new ConflictException('You are not authorized to decline this invitation');
    }

    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: 'DECLINED' },
    });

    return { success: true };
  }

  /**
   * Clean up orphaned participant records and expired invitations
   * This method should be called periodically or when needed
   */
  async cleanupOrphanedRecords() {
    // Get all conversation IDs that exist
    const existingConversations = await this.prisma.conversation.findMany({
      select: { id: true },
    });
    const existingConversationIds = existingConversations.map(c => c.id);

    // Clean up participant records for conversations that no longer exist
    const orphanedParticipants = await this.prisma.conversationParticipant.findMany({
      where: {
        conversationId: {
          notIn: existingConversationIds,
        },
      },
    });

    if (orphanedParticipants.length > 0) {
      await this.prisma.conversationParticipant.deleteMany({
        where: {
          conversationId: {
            notIn: existingConversationIds,
          },
        },
      });
      console.log(`Cleaned up ${orphanedParticipants.length} orphaned participant records`);
    }

    // Clean up invitations for conversations that no longer exist
    const orphanedInvitations = await this.prisma.invitation.findMany({
      where: {
        conversationId: {
          notIn: existingConversationIds,
        },
      },
    });

    if (orphanedInvitations.length > 0) {
      await this.prisma.invitation.updateMany({
        where: {
          conversationId: {
            notIn: existingConversationIds,
          },
        },
        data: {
          status: 'EXPIRED',
        },
      });
      console.log(`Cleaned up ${orphanedInvitations.length} orphaned invitations`);
    }

    return {
      orphanedParticipants: orphanedParticipants.length,
      orphanedInvitations: orphanedInvitations.length,
    };
  }
} 