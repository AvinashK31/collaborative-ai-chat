import { Controller, Get, Post, Body, UseGuards, Request, Param } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('invitations')
@ApiBearerAuth('JWT-auth')
@Controller('invitations')
@UseGuards(JwtAuthGuard)
export class InvitationsController {
  constructor(
    private readonly invitationsService: InvitationsService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Send invitation', description: 'Sends an invitation to add a user to a conversation' })
  @ApiBody({ type: CreateInvitationDto })
  @ApiResponse({ status: 201, description: 'Invitation sent successfully' })
  @ApiResponse({ status: 409, description: 'Conflict: duplicate or unauthorized invitation' })
  async sendInvitation(@Request() req, @Body() createInvitationDto: CreateInvitationDto) {
    return this.invitationsService.createInvitation(req.user.id, createInvitationDto);
  }

  @Get()
  @ApiOperation({ summary: "Get user's pending invitations", description: 'Returns all pending invitations for the authenticated user' })
  @ApiResponse({ status: 200, description: 'List of invitations returned' })
  async getUserInvitations(@Request() req) {
    return this.invitationsService.getUserInvitations(req.user.id);
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Accept invitation', description: 'Accepts a pending invitation and adds the user to the conversation' })
  @ApiParam({ name: 'id', description: 'Invitation ID' })
  @ApiResponse({ status: 200, description: 'Invitation accepted successfully' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  @ApiResponse({ status: 409, description: 'Conflict: unauthorized or already handled' })
  async acceptInvitation(@Request() req, @Param('id') invitationId: string) {
    return this.invitationsService.acceptInvitation(invitationId, req.user.id);
  }

  @Post(':id/decline')
  @ApiOperation({ summary: 'Decline invitation', description: 'Declines a pending invitation' })
  @ApiParam({ name: 'id', description: 'Invitation ID' })
  @ApiResponse({ status: 200, description: 'Invitation declined successfully' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  @ApiResponse({ status: 409, description: 'Conflict: unauthorized or already handled' })
  async declineInvitation(@Request() req, @Param('id') invitationId: string) {
    return this.invitationsService.declineInvitation(invitationId, req.user.id);
  }

  @Post('cleanup')
  @ApiOperation({ summary: 'Clean up orphaned records', description: 'Cleans up participant records and invitations for conversations that no longer exist (dev only)' })
  @ApiResponse({ status: 200, description: 'Cleanup completed' })
  async cleanupOrphanedRecords(@Request() req) {
    // Only allow cleanup for development or admin users
    // Use ConfigService to avoid direct access to process.env
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    if (nodeEnv === 'production') {
      throw new Error('Cleanup not allowed in production');
    }
    return this.invitationsService.cleanupOrphanedRecords();
  }
} 