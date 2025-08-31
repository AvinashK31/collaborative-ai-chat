import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('ConversationsService', () => {
  let service: ConversationsService;
  /**
   * Prisma mock providing only the methods used by the ConversationsService.
   */
  let prisma: {
    conversation: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findMany: jest.Mock;
    };
    conversationParticipant: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    invitation: {
      updateMany: jest.Mock;
    };
  };
  /**
   * EventEmitter mock exposing the emit method.
   */
  let eventEmitter: {
    emit: jest.Mock;
  };

  beforeEach(async () => {
    // Initialise mocks for Prisma and EventEmitter dependencies
    prisma = {
      conversation: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
      conversationParticipant: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      invitation: {
        updateMany: jest.fn(),
      },
    };
    eventEmitter = { emit: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();
    service = module.get<ConversationsService>(ConversationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createConversation', () => {
    it('should create a conversation with default title', async () => {
      const userId = 'user1';
      // Use CreateConversationDto type for the input to avoid `any`
      const dto: CreateConversationDto = { title: '' };
      const conv = { id: 'conv1', title: 'New Conversation', participants: [] };
      prisma.conversation.create.mockResolvedValue(conv);
      const result = await service.createConversation(userId, dto);
      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: {
          title: dto.title || 'New Conversation',
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
      expect(result).toEqual(conv);
    });
  });

  describe('getConversationById', () => {
    it('should throw ForbiddenException if user not in conversation', async () => {
      jest.spyOn(service, 'isUserInConversation').mockResolvedValue(false);
      await expect(service.getConversationById('conv1', 'user1')).rejects.toThrow(ForbiddenException);
      expect(prisma.conversation.findUnique).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if conversation not found', async () => {
      jest.spyOn(service, 'isUserInConversation').mockResolvedValue(true);
      prisma.conversation.findUnique.mockResolvedValue(null);
      await expect(service.getConversationById('conv1', 'user1')).rejects.toThrow(NotFoundException);
      expect(prisma.conversation.findUnique).toHaveBeenCalledWith({
        where: { id: 'conv1' },
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
    });

    it('should return conversation when user is participant', async () => {
      jest.spyOn(service, 'isUserInConversation').mockResolvedValue(true);
      const conv = { id: 'conv1', title: 'Test' };
      prisma.conversation.findUnique.mockResolvedValue(conv);
      const result = await service.getConversationById('conv1', 'user1');
      expect(result).toEqual(conv);
    });
  });
});