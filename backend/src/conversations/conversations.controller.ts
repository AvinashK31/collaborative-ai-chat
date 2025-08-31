import { Controller, Get, Post, Body, UseGuards, Request, Param, Patch, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('conversations')
@ApiBearerAuth('JWT-auth')
@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private conversationsService: ConversationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new conversation', description: 'Creates a new conversation for the authenticated user' })
  @ApiBody({ type: CreateConversationDto })
  @ApiResponse({ status: 201, description: 'Conversation created successfully' })
  async createConversation(@Request() req, @Body() createConversationDto: CreateConversationDto) {
    return this.conversationsService.createConversation(req.user.id, createConversationDto);
  }

  @Get()
  @ApiOperation({ summary: "Get user's conversations", description: 'Returns all conversations the authenticated user is part of' })
  @ApiResponse({ status: 200, description: 'List of conversations' })
  async getUserConversations(@Request() req) {
    return this.conversationsService.getUserConversations(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get conversation by ID', description: 'Returns the conversation details if the user is a participant' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'Conversation details returned' })
  @ApiResponse({ status: 403, description: 'Forbidden: user is not a participant of this conversation' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getConversationById(@Request() req, @Param('id') conversationId: string) {
    return this.conversationsService.getConversationById(conversationId, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update conversation title', description: 'Updates the title of an existing conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiBody({ type: UpdateConversationDto })
  @ApiResponse({ status: 200, description: 'Conversation updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: user is not a participant of this conversation' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async updateConversation(
    @Request() req,
    @Param('id') conversationId: string,
    @Body() updateConversationDto: UpdateConversationDto,
  ) {
    return this.conversationsService.updateConversation(conversationId, req.user.id, updateConversationDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete conversation', description: 'Deletes a conversation if the user is a participant' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 204, description: 'Conversation deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: user is not a participant of this conversation' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConversation(@Request() req, @Param('id') conversationId: string) {
    await this.conversationsService.deleteConversation(conversationId, req.user.id);
  }
} 