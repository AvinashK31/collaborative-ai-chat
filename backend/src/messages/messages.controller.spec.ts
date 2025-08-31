import { Test, TestingModule } from '@nestjs/testing';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { LangchainService } from '../langchain/langchain.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ForbiddenException } from '@nestjs/common';
import { UpdateMessageDto } from './dto/update-message.dto';

describe('MessagesController', () => {
  let controller: MessagesController;
  let messagesService: MessagesService;
  let langchainService: LangchainService;
  let eventEmitter: EventEmitter2;

  const mockMessagesService = {
    isUserInConversation: jest.fn(),
    getConversationMessages: jest.fn(),
    getUnreadCounts: jest.fn(),
    updateUserReadStatus: jest.fn(),
    updateMessage: jest.fn(),
    createMessage: jest.fn(),
  };

  const mockLangchainService = {
    generateStreamingResponse: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [
        { provide: MessagesService, useValue: mockMessagesService },
        { provide: LangchainService, useValue: mockLangchainService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();
    controller = module.get<MessagesController>(MessagesController);
    messagesService = module.get<MessagesService>(MessagesService);
    langchainService = module.get<LangchainService>(LangchainService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getConversationMessages', () => {
    it('should throw ForbiddenException if user not participant', async () => {
      mockMessagesService.isUserInConversation.mockResolvedValue(false);
      interface RequestWithUser { user: { id: string } }
      const req: RequestWithUser = { user: { id: 'u1' } };
      await expect(controller.getConversationMessages(req, 'conv1')).rejects.toThrow(ForbiddenException);
    });

    it('should return messages when authorized', async () => {
      mockMessagesService.isUserInConversation.mockResolvedValue(true);
      const msgs = [{ id: 'm1' }];
      mockMessagesService.getConversationMessages.mockResolvedValue(msgs);
      interface RequestWithUser { user: { id: string } }
      const req: RequestWithUser = { user: { id: 'u1' } };
      const result = await controller.getConversationMessages(req, 'conv1');
      expect(mockMessagesService.getConversationMessages).toHaveBeenCalledWith('conv1');
      expect(result).toEqual(msgs);
    });
  });

  describe('getUnreadCounts', () => {
    it('should return unread counts', async () => {
      const counts = { conv1: 3 };
      mockMessagesService.getUnreadCounts.mockResolvedValue(counts);
      interface RequestWithUser { user: { id: string } }
      const req: RequestWithUser = { user: { id: 'u1' } };
      const result = await controller.getUnreadCounts(req);
      expect(mockMessagesService.getUnreadCounts).toHaveBeenCalledWith('u1');
      expect(result).toEqual(counts);
    });
  });

  describe('markConversationAsRead', () => {
    it('should mark conversation as read and return success', async () => {
      interface RequestWithUser { user: { id: string } }
      const req: RequestWithUser = { user: { id: 'u1' } };
      mockMessagesService.updateUserReadStatus.mockResolvedValue(undefined);
      const result = await controller.markConversationAsRead(req, 'conv1');
      expect(mockMessagesService.updateUserReadStatus).toHaveBeenCalledWith('u1', 'conv1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('updateMessage', () => {
    it('should call service.updateMessage and return result', async () => {
      interface RequestWithUser { user: { id: string } }
      const req: RequestWithUser = { user: { id: 'u1' } };
      const updatedMsg = { id: 'm1', content: 'new' };
      mockMessagesService.updateMessage.mockResolvedValue(updatedMsg);
      const dto: UpdateMessageDto = { content: 'new' };
      const result = await controller.updateMessage(req, 'm1', dto);
      expect(mockMessagesService.updateMessage).toHaveBeenCalledWith('m1', 'u1', 'new');
      expect(result).toEqual(updatedMsg);
    });
  });
});