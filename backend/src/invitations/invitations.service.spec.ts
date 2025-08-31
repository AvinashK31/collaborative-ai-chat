import { Test, TestingModule } from '@nestjs/testing';
import { InvitationsService } from './invitations.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('InvitationsService', () => {
  let service: InvitationsService;
  /**
   * Prisma mock providing only the methods used by the InvitationsService.
   * Each property is a Jest mock to avoid using `any`.
   */
  let prisma: {
    conversationParticipant: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      deleteMany: jest.Mock;
      create: jest.Mock;
    };
    conversation: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
    };
    invitation: {
      findFirst: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  /**
   * EmailService mock containing only the sendInvitationEmail method.
   */
  let emailService: {
    sendInvitationEmail: jest.Mock;
  };

  beforeEach(async () => {
    // Initialise the prisma mock with jest.fn() methods
    prisma = {
      conversationParticipant: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      conversation: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      invitation: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    emailService = {
      sendInvitationEmail: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();
    service = module.get<InvitationsService>(InvitationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createInvitation', () => {
    it('should throw ConflictException if sender not participant', async () => {
      prisma.conversationParticipant.findUnique.mockResolvedValue(null);
      await expect(
        service.createInvitation('user1', { email: 'target@example.com', conversationId: 'conv1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create invitation and send email', async () => {
      // Sender is participant
      prisma.conversationParticipant.findUnique.mockResolvedValue({ id: 'cp1' });
      // Conversation exists
      prisma.conversation.findUnique.mockResolvedValue({ id: 'conv1', title: 'Test' });
      // Sender exists
      prisma.user.findUnique.mockResolvedValue({ id: 'user1', name: 'Sender', email: 'sender@example.com' });
      // Receiver exists
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'receiver1' });
      // No existing participant
      prisma.conversationParticipant.findUnique.mockResolvedValueOnce(null);
      // No existing pending invitation
      prisma.invitation.findFirst.mockResolvedValue(null);
      // updateMany resolves
      prisma.invitation.updateMany.mockResolvedValue({});
      const created = {
        id: 'inv1',
        email: 'target@example.com',
        sender: { id: 'user1', email: 'sender@example.com', name: 'Sender' },
        receiver: { id: 'receiver1', email: 'target@example.com', name: 'Target' },
        conversation: { id: 'conv1', title: 'Test' },
      };
      prisma.invitation.create.mockResolvedValue(created);
      emailService.sendInvitationEmail.mockResolvedValue(undefined);
      const result = await service.createInvitation('user1', {
        email: 'target@example.com',
        conversationId: 'conv1',
      });
      // Ensure invitation created
      expect(prisma.invitation.create).toHaveBeenCalled();
      // Ensure email sent
      expect(emailService.sendInvitationEmail).toHaveBeenCalled();
      expect(result).toEqual(created);
    });
  });

  describe('declineInvitation', () => {
    it('should decline invitation', async () => {
      prisma.invitation.findUnique.mockResolvedValue({ id: 'inv1', receiverId: 'user1', status: 'PENDING' });
      prisma.invitation.update.mockResolvedValue({});
      const result = await service.declineInvitation('inv1', 'user1');
      expect(prisma.invitation.update).toHaveBeenCalledWith({
        where: { id: 'inv1' },
        data: { status: 'DECLINED' },
      });
      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException when invitation not found', async () => {
      prisma.invitation.findUnique.mockResolvedValue(null);
      await expect(service.declineInvitation('inv1', 'user1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserInvitations', () => {
    it('should return user invitations', async () => {
      const invitations = [{ id: 'inv1' }];
      prisma.invitation.findMany.mockResolvedValue(invitations);
      const result = await service.getUserInvitations('user1');
      expect(prisma.invitation.findMany).toHaveBeenCalledWith({
        where: {
          receiverId: 'user1',
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
      expect(result).toEqual(invitations);
    });
  });
});