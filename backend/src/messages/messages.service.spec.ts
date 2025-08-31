import { Test, TestingModule } from '@nestjs/testing';
import { MessagesService, CreateMessageDto } from './messages.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { VectorService } from '../langchain/vector.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('MessagesService', () => {
  let service: MessagesService;
  /**
   * Prisma mock providing only the methods used by the MessagesService.  Each
   * method is a Jest mock to avoid the `any` type.
   */
  let prisma: {
    message: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    conversationParticipant: {
      findUnique: jest.Mock;
    };
    userReadStatus: {
      upsert: jest.Mock;
      updateMany: jest.Mock;
      findUnique: jest.Mock;
    };
  };
  /**
   * VectorService mock exposing the addMessageEmbedding method.
   */
  let vectorService: {
    addMessageEmbedding: jest.Mock;
  };
  /**
   * EventEmitter mock exposing the emit method.
   */
  let eventEmitter: {
    emit: jest.Mock;
  };

  beforeEach(async () => {
    // Set up mocks for the Prisma, VectorService and EventEmitter dependencies
    prisma = {
      message: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      conversationParticipant: {
        findUnique: jest.fn(),
      },
      userReadStatus: {
        upsert: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    vectorService = {
      addMessageEmbedding: jest.fn(),
    };
    eventEmitter = { emit: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: VectorService, useValue: vectorService },
      ],
    }).compile();
    service = module.get<MessagesService>(MessagesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createMessage', () => {
    it('should create a USER message and persist embedding', async () => {
      const dto = { content: 'hello', type: 'USER' as const, userId: 'u1', conversationId: 'c1' };
      const msg = { id: 'm1', ...dto, user: { id: 'u1' } };
      prisma.message.create.mockResolvedValue(msg);
      const result = await service.createMessage(dto);
      expect(prisma.message.create).toHaveBeenCalledWith({
        data: {
          content: dto.content,
          type: dto.type,
          userId: dto.userId,
          conversationId: dto.conversationId,
        },
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
      expect(vectorService.addMessageEmbedding).toHaveBeenCalledWith(
        msg.id,
        dto.conversationId,
        dto.content,
      );
      expect(result).toEqual(msg);
    });

    it('should not persist embedding for SYSTEM message', async () => {
      // System messages should not persist embeddings
      const dto: CreateMessageDto = {
        content: 'system',
        type: 'SYSTEM',
        conversationId: 'c1',
      };
      const msg = { id: 'm2', ...dto, user: null };
      prisma.message.create.mockResolvedValue(msg);
      const result = await service.createMessage(dto);
      expect(vectorService.addMessageEmbedding).not.toHaveBeenCalled();
      expect(result).toEqual(msg);
    });
  });

  describe('updateMessage', () => {
    it('should throw NotFoundException when message not found', async () => {
      prisma.message.findUnique.mockResolvedValue(null);
      await expect(service.updateMessage('m1', 'u1', 'new')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not owner', async () => {
      const msg = { id: 'm1', userId: 'u2', type: 'USER', conversationId: 'c1', content: 'old' };
      prisma.message.findUnique.mockResolvedValue(msg);
      await expect(service.updateMessage('m1', 'u1', 'new')).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if type is not USER', async () => {
      const msg = { id: 'm1', userId: 'u1', type: 'AI', conversationId: 'c1', content: 'old' };
      prisma.message.findUnique.mockResolvedValue(msg);
      await expect(service.updateMessage('m1', 'u1', 'new')).rejects.toThrow(ForbiddenException);
    });

    it('should update message and emit event', async () => {
      const msg = { id: 'm1', userId: 'u1', type: 'USER', conversationId: 'c1', content: 'old', user: { id: 'u1' } };
      const updated = { ...msg, content: 'new' };
      prisma.message.findUnique.mockResolvedValue(msg);
      prisma.message.update.mockResolvedValue(updated);
      const result = await service.updateMessage('m1', 'u1', 'new');
      expect(prisma.message.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { content: 'new' },
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
      expect(eventEmitter.emit).toHaveBeenCalledWith('message.updated', {
        conversationId: updated.conversationId,
        message: updated,
      });
      expect(result).toEqual(updated);
    });
  });
});