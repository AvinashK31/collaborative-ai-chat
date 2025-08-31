import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';

describe('ConversationsController', () => {
  let controller: ConversationsController;
  let service: ConversationsService;

  const mockService = {
    createConversation: jest.fn(),
    getUserConversations: jest.fn(),
    getConversationById: jest.fn(),
    updateConversation: jest.fn(),
    deleteConversation: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationsController],
      providers: [
        {
          provide: ConversationsService,
          useValue: mockService,
        },
      ],
    }).compile();
    controller = module.get<ConversationsController>(ConversationsController);
    service = module.get<ConversationsService>(ConversationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createConversation', () => {
    it('should call service.createConversation with user id and dto', async () => {
      // Use a properly typed DTO rather than casting to any
      const dto: CreateConversationDto = { title: 'Test Conversation' };
      interface RequestWithUser { user: { id: string } }
      const req: RequestWithUser = { user: { id: 'user1' } };
      const expected = { id: 'conv1' };
      mockService.createConversation.mockResolvedValue(expected);
      const result = await controller.createConversation(req, dto);
      expect(service.createConversation).toHaveBeenCalledWith('user1', dto);
      expect(result).toEqual(expected);
    });
  });

  describe('getUserConversations', () => {
    it('should return conversations for user', async () => {
      interface RequestWithUser { user: { id: string } }
      const req: RequestWithUser = { user: { id: 'user1' } };
      const conversations = [{ id: 'conv1' }];
      mockService.getUserConversations.mockResolvedValue(conversations);
      const result = await controller.getUserConversations(req);
      expect(service.getUserConversations).toHaveBeenCalledWith('user1');
      expect(result).toEqual(conversations);
    });
  });

  describe('getConversationById', () => {
    it('should return conversation when authorized', async () => {
      interface RequestWithUser { user: { id: string } }
      const req: RequestWithUser = { user: { id: 'user1' } };
      const conv = { id: 'conv1' };
      mockService.getConversationById.mockResolvedValue(conv);
      const result = await controller.getConversationById(req, 'conv1');
      expect(service.getConversationById).toHaveBeenCalledWith('conv1', 'user1');
      expect(result).toEqual(conv);
    });
  });

  describe('updateConversation', () => {
    it('should update conversation', async () => {
      interface RequestWithUser { user: { id: string } }
      const req: RequestWithUser = { user: { id: 'user1' } };
      const dto: UpdateConversationDto = { title: 'Updated' };
      const updated = { id: 'conv1', title: 'Updated' };
      mockService.updateConversation.mockResolvedValue(updated);
      const result = await controller.updateConversation(req, 'conv1', dto);
      expect(service.updateConversation).toHaveBeenCalledWith('conv1', 'user1', dto);
      expect(result).toEqual(updated);
    });
  });

  describe('deleteConversation', () => {
    it('should delete conversation and return nothing', async () => {
      interface RequestWithUser { user: { id: string } }
      const req: RequestWithUser = { user: { id: 'user1' } };
      mockService.deleteConversation.mockResolvedValue(undefined);
      const result = await controller.deleteConversation(req, 'conv1');
      expect(service.deleteConversation).toHaveBeenCalledWith('conv1', 'user1');
      expect(result).toBeUndefined();
    });
  });
});