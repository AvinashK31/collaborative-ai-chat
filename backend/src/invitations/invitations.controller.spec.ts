import { Test, TestingModule } from '@nestjs/testing';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';

describe('InvitationsController', () => {
  let controller: InvitationsController;
  let service: InvitationsService;

  const mockService = {
    createInvitation: jest.fn(),
    getUserInvitations: jest.fn(),
    acceptInvitation: jest.fn(),
    declineInvitation: jest.fn(),
    cleanupOrphanedRecords: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvitationsController],
      providers: [
        { provide: InvitationsService, useValue: mockService },
      ],
    }).compile();
    controller = module.get<InvitationsController>(InvitationsController);
    service = module.get<InvitationsService>(InvitationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendInvitation', () => {
    it('should call service.createInvitation', async () => {
      // Define a narrow request type with a user property to avoid `any`
      interface RequestWithUser { user: { id: string } }
      const req: RequestWithUser = { user: { id: 'u1' } };
      const dto: CreateInvitationDto = { email: 'test@example.com', conversationId: 'c1' };
      mockService.createInvitation.mockResolvedValue('result');
      const result = await controller.sendInvitation(req, dto);
      expect(service.createInvitation).toHaveBeenCalledWith('u1', dto);
      expect(result).toEqual('result');
    });
  });

  describe('getUserInvitations', () => {
    it('should return invitations', async () => {
      interface RequestWithUser { user: { id: string } }
      const req: RequestWithUser = { user: { id: 'u1' } };
      const invitations = [{ id: 'inv1' }];
      mockService.getUserInvitations.mockResolvedValue(invitations);
      const result = await controller.getUserInvitations(req);
      expect(service.getUserInvitations).toHaveBeenCalledWith('u1');
      expect(result).toEqual(invitations);
    });
  });

  describe('acceptInvitation', () => {
    it('should call service.acceptInvitation', async () => {
      interface RequestWithUser { user: { id: string } }
      const req: RequestWithUser = { user: { id: 'u1' } };
      mockService.acceptInvitation.mockResolvedValue({ success: true });
      const result = await controller.acceptInvitation(req, 'inv1');
      expect(service.acceptInvitation).toHaveBeenCalledWith('inv1', 'u1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('declineInvitation', () => {
    it('should call service.declineInvitation', async () => {
      interface RequestWithUser { user: { id: string } }
      const req: RequestWithUser = { user: { id: 'u1' } };
      mockService.declineInvitation.mockResolvedValue({ success: true });
      const result = await controller.declineInvitation(req, 'inv1');
      expect(service.declineInvitation).toHaveBeenCalledWith('inv1', 'u1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('cleanupOrphanedRecords', () => {
    it('should call service.cleanupOrphanedRecords when not in production', async () => {
      process.env.NODE_ENV = 'test';
      mockService.cleanupOrphanedRecords.mockResolvedValue({ orphanedParticipants: 0, orphanedInvitations: 0 });
      interface RequestWithUser { user: { id: string } }
      const req: RequestWithUser = { user: { id: 'u1' } };
      const result = await controller.cleanupOrphanedRecords(req);
      expect(service.cleanupOrphanedRecords).toHaveBeenCalled();
      expect(result).toEqual({ orphanedParticipants: 0, orphanedInvitations: 0 });
    });
  });
});