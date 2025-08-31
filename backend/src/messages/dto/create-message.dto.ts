import { IsString, IsOptional, IsIn } from 'class-validator';

/**
 * Data Transfer Object for creating a new message.  Only the content
 * and conversationId are required when a user sends a message.
 * The message type may be supplied when creating system messages
 * programmatically.  Validation rules ensure correct types are
 * provided.
 */
export class CreateMessageDto {
  /**
   * The textual content of the message.
   */
  @IsString()
  content: string;

  /**
   * The identifier of the conversation this message belongs to.
   */
  @IsString()
  conversationId: string;

  /**
   * Optional message type.  Typically omitted for user messages (the
   * controller/service will set type appropriately).  Accepted
   * values are 'USER', 'AI' or 'SYSTEM'.
   */
  @IsOptional()
  @IsIn(['USER', 'AI', 'SYSTEM'])
  type?: 'USER' | 'AI' | 'SYSTEM';

  /**
   * Optional context type.  This field is currently unused by the
   * backend but accepted for forward compatibility.  The frontend
   * may supply values such as 'CONVERSATION' to influence AI
   * behaviour.  Additional context types can be added in future
   * versions.
   */
  @IsOptional()
  @IsString()
  contextType?: string;
}